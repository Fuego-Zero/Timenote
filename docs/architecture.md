# 架构说明

## 进程与端口

```text
浏览器 / iPhone 日历
        │  HTTPS（生产经反向代理）
        ▼
apps/web  Node HTTP 服务  :8720（WEB_BIND_HOST）
  ├─ /            index.html（每次请求生成 CSP nonce）
  ├─ /assets/*    静态资源（生产，immutable 缓存）/ Vite 中间件（开发）
  └─ /api/*       同源反代 ───────────────┐
                                           ▼
                         apps/api  Fastify  127.0.0.1:8721
                           ├─ 会话、同源校验、限流、helmet
                           ├─ 账号 / 事件 / 订阅地址 / 备份接口
                           └─ /api/feeds/<token>.ics 订阅输出
                                           │
                                           ▼
                         packages/runtime  SQLite（WAL，单文件）
```

`scripts/dev.ts` 在同一进程内依次执行：读取 `.env` → 校验配置 → 迁移 → 打开 Repository → 按需创建首个管理员 → 启动 API → 启动 Web。`scripts/start.ts` 只是在检查 `apps/web/dist` 后以 `--built` 复用同一入口。SQLite 只允许单实例写入，不要同时运行多个进程指向同一数据库。

Web 反代只转发白名单请求头（`content-type`、`cookie`、`origin`、`sec-fetch-site`、`if-none-match`、`user-agent`），用套接字地址覆盖 `x-forwarded-for`，并只回传白名单响应头和 `set-cookie`。API 只信任来自 `127.0.0.1` 的这一跳。

## 工作区包

| 包                   | 职责                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------- |
| `packages/contracts` | Zod 契约：事件、账号、订阅地址、备份、错误码；网页表单、API 和备份文件共用              |
| `packages/calendar`  | 规则引擎：公历/农历发生日、标题模板、提醒换算、ICS 生成；无 Node 依赖，前端预览直接复用 |
| `packages/runtime`   | 配置、SQLite 与迁移、Repository、密码与 token 哈希、Fastify 基座、请求日志              |
| `apps/api`           | 业务接口与权限：会话、管理员后台、事件、订阅地址、订阅输出、备份                        |
| `apps/web`           | `server/`：Node 静态服务与反代；`src/`：React + Ant Design 界面                         |

所有日期与 ICS 逻辑只在 `packages/calendar`；预览、订阅和导出调用同一个 `expandEvent` / `upcomingOccurrences`，展开结果只用于输出，不写回原始事件（见 `.cursor/rules/01-architecture-first.mdc`）。

## 数据模型

四张表都以 JSON `payload` 保存完整实体，读出时用 Zod 重新校验；表上的 `CHECK` 约束保证主键、归属列与 payload 一致，并禁止 payload 出现明文 `password` 或订阅 `token` 字段。删除账号通过外键级联删除其会话、事件与订阅地址。

| 表            | 内容                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| `user`        | 用户名、显示名称、角色、停用状态、时区、scrypt 密码哈希                |
| `app_session` | 会话 token 的 SHA-256、归属账号、最后活跃与过期时间                    |
| `event`       | 事件可编辑字段 + `id`、`ownerId`、`revision`、`createdAt`、`updatedAt` |
| `feed_token`  | 订阅地址名称、token 明文（用于再次显示）、SHA-256、创建与轮换时间；可选 `eventScope` / `eventIds`（见下） |

迁移清单在 `packages/runtime/src/migrate.ts`，按顺序执行并记录 SHA-256 校验和；已应用的迁移被改动或数据库里有未登记的表时拒绝启动。

## 订阅输出

每个订阅地址是账号下的一条私密 URL（`/api/feeds/<token>.ics`）；事件只挂在账号上，不挂 `feedId`。订阅可配置输出范围：

- `eventScope`：`all`（账号全部事件）或 `selected`（仅 `eventIds` 列表）。缺字段或 `null` 按 `all`；`selected` + 空数组表示空日历，**禁止**回退为 `all`。
- `eventIds`：仅在 `selected` 时有意义；写入时必须都属于当前账号，否则 `INVALID_INPUT` 400。存库时 `all` 会去掉 `eventIds`（与「未设置」区分于空数组）。
- 列可选、无强制 migration；旧数据按 `all`。生成 ICS 时跳过已删除的 id。

`GET /api/feeds/<43 位 token>.ics`：

1. 用 token 的 SHA-256 查找订阅地址；不存在、已撤销、账号已停用都返回同样的 JSON 404。
2. 按账号时区取当前年份，窗口为「过去 `FEED_WINDOW_PAST_YEARS` 年 ～ 未来 `FEED_WINDOW_FUTURE_YEARS` 年」的逻辑年份；普通事件不受窗口限制。再按该订阅的 `eventScope` / `eventIds` 过滤事件。
3. 事件按 `createdAt`、`id` 稳定排序后逐个展开，生成 RFC 5545 文本（CRLF、75 字节折行、转义）。
4. 响应头 `Cache-Control: private, no-cache` 与内容 SHA-256 的强 ETag；`If-None-Match` 命中返回 304。

稳定性约定（日历 App 依赖这些字段判断「同一个事件」）：

| 字段                      | 取值                                         |
| ------------------------- | -------------------------------------------- |
| `UID`（周年类）           | `<事件 ID>-<逻辑年份>@timenote`              |
| `UID`（普通事件）         | `<事件 ID>@timenote`                         |
| `SEQUENCE`                | 事件 `revision`，每次修改 +1                 |
| `DTSTAMP`/`LAST-MODIFIED` | 事件 `updatedAt`（取整到秒），不使用请求时刻 |
| `DTSTART`/`DTEND`         | `VALUE=DATE` 全天事件，`DTEND` 为排他结束日  |
| `TRIGGER`                 | `VALUE=DATE-TIME` 的绝对 UTC 时间            |

因此相同数据在任意时刻生成的字节完全一致，ETag 只在事件、账号名称/时区或窗口跨年时变化。

## 前端

`App` 先请求 `/api/auth/session`，未登录显示登录页；登录后 `AppShell` 以标签页呈现「事件 / 订阅 / 备份 / 账号管理（仅管理员）」。数据请求统一走 `api/client.ts`，收到 `AUTH_REQUIRED` 时广播事件回到登录页。事件编辑抽屉在手机宽度全屏，表单校验调用与服务端相同的契约和日历库校验。订阅页创建/编辑时可选择范围（全部或勾选事件）；列表展示「全部」或「已选 N」。
