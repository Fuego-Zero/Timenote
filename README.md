# 岁时记 Timenote

岁时记（Timenote）是自托管的生日与纪念日订阅服务：在网页里录入生日、纪念日和普通事件，按公历或农历规则自动展开每年的发生日，并以私密 ICS 地址订阅到任何支持 ICS/webcal 订阅的日历客户端（如苹果日历、Google 日历、Outlook）。

- 多账号：空库时在 Web 首次引导页创建首个管理员（`POST /api/setup/admin`），不经 `INITIAL_ADMIN` 等环境变量；公开自助注册默认关闭（`PUBLIC_REGISTER_ENABLED`），开启后新号是否停用由 `REGISTER_DEFAULT_DISABLED` 决定（默认停用，须管理员启用）；管理员在「账号管理」中创建、启停、重置密码和删除账号；各账号的事件与订阅地址互相隔离。
- 事件类型：生日（N 岁）、纪念日（第 N 周年）、普通事件（只发生一次）；支持年份未知、2 月 29 日、农历闰月与三十、跨天事件和最多两条提醒。
- 保存前预览「未来 5 次」发生日，预览、订阅和导出共用同一套规则引擎（`packages/calendar`）。
- 每台设备一个订阅地址，可随时轮换或撤销，旧地址立即返回 404；地址里不含姓名、生日或日期。

功能参考自 TimeMark（只读，见 `.cursor/rules/02-timemark-readonly.mdc`），工程体系照搬 mm-agent：pnpm 工作区、TypeScript strict、Fastify + SQLite、React + Ant Design、Vitest + Playwright。架构、数据流和 UID 策略见[架构说明](docs/architecture.md)。

## 从空环境启动

安装 Node.js 22.21.1（或更新的 Node 22 / Node 24），然后运行：

```sh
npm install --global pnpm@10.28.0
cd <当前仓库路径>
pnpm install --frozen-lockfile
pnpm env:init
pnpm dev
```

`env:init` 只在 `.env` 不存在时生成基础配置，不覆盖已有文件；`.env` 已被 Git 忽略。打开 [岁时记 Timenote](http://127.0.0.1:8720)，空库时用首次引导创建管理员账号。全部变量见[环境变量](docs/environment-variables.md)。

| 服务                | 地址                         |
| ------------------- | ---------------------------- |
| Web 与同源 API 反代 | http://127.0.0.1:8720        |
| API 健康检查        | http://127.0.0.1:8721/health |

一个进程内启动两个监听器：Web（开发时挂 Vite 中间件，生产时提供静态文件）和只绑 `127.0.0.1` 的 Fastify API；浏览器与日历 App 都只访问 Web，`/api/*` 由 Web 同源反代。开发环境 Web 默认绑 `0.0.0.0` 并在启动日志打印局域网地址，手机调试订阅时把 `WEB_ORIGIN` 改成该局域网地址后重启。

检查生产静态构建：

```sh
pnpm build
pnpm start
```

## 使用流程

1. 管理员在「账号管理」为家人创建账号（可选时区，提醒按账号时区换算）。
2. 在「事件」里新建生日/纪念日/普通事件，表单下方实时显示未来 5 次的日期、标题和提醒时间。
3. 在「订阅」里为设备创建订阅地址。地址会留在列表里，可以随时复制；泄露后轮换或撤销，旧地址立即失效。
4. 在日历客户端里用订阅地址添加订阅日历（各客户端步骤见 [docs/subscription-acceptance.md](docs/subscription-acceptance.md)）。
5. 「备份」可导出/导入 JSON（只含自己的事件；导入前先显示将新增和覆盖的数量，确认后才写入）；数据库级备份用 `pnpm db:backup`。

农历、闰月、三十、2 月 29 日等规则的精确定义见[纪念日规则](docs/anniversary-rules.md)。

## 质量检查

```sh
pnpm check        # typecheck、lint、format:check、Vitest、build
pnpm test:e2e     # Playwright（本机 Microsoft Edge），自动以临时 SQLite 启动 pnpm dev
pnpm verify       # 以上全部，并在 .tmp/verification-results/latest 保存源码哈希、退出码、日志与测试 JSON
```

测试数据库、截图和报告都写在 `.tmp/` 下。自动化测试覆盖规则引擎、ICS 往返解析、接口权限边界、日志脱敏与端到端流程，但不能替代真机验收：各日历客户端的刷新周期、提醒弹出和显示效果需按[验收清单](docs/subscription-acceptance.md)手工确认。

## 部署

单实例 Docker + 命名卷持久化。发布由 GitHub Actions 完成：Pull Request 合并进 `main` 后编译镜像并推到 `ghcr.io/fuego-zero/timenote`，再 SSH 到服务器拉取启动。服务器上不克隆仓库。HTTPS / 证书由部署方自理（示例见 [deploy/nginx.example.conf](deploy/nginx.example.conf)）。密钥、首次切换和回滚见[部署说明](docs/deployment.md)，安全约束见[安全说明](docs/security.md)。

## AI 工程

规则在 `.cursor/rules/`，总览见 `AGENTS.md`。Cursor 使用 `.cursor/hooks.json`；Codex 使用 `.codex/hooks.json`，两者共用 `.cursor/hooks/afterAgent.mjs`，在每轮结束时用 Prettier 格式化本轮修改的文件。Codex 首次使用或修改 hook 定义后，需要在 CLI 的 `/hooks` 中审阅并信任。
