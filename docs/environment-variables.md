# 环境变量

本机开发由 `pnpm env:init` 生成 `.env`；部署时从 [`.env.example`](../.env.example) 复制后修改。留空等同于未配置，使用默认值。配置在启动时一次性校验（`packages/runtime/src/config.ts`），不合法时直接退出并给出变量名。首个管理员不通过环境变量配置，空库时用 Web 首次引导（`POST /api/setup/admin`）创建。

| 变量                       | 默认值                                 | 说明                                                                                                   |
| -------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                 | `development`                          | `production` 时强制 `https://` 的 `WEB_ORIGIN` 与安全 Cookie；`test` 时不写日志文件                    |
| `WEB_ORIGIN`               | `http://127.0.0.1:8720`                | 浏览器访问的同源地址，也是订阅链接基址；只含协议、主机、端口，不带路径和结尾斜杠                       |
| `WEB_BIND_HOST`            | `127.0.0.1`                            | Web 监听地址；`env:init` 写入 `0.0.0.0` 方便局域网调试，Docker 中为 `0.0.0.0`                          |
| `WEB_PORT`                 | `8720`                                 | Web 端口                                                                                               |
| `API_PORT`                 | `8721`                                 | API 端口，固定只监听 `127.0.0.1`                                                                       |
| `SQLITE_PATH`              | 必填                                   | SQLite 文件路径，不接受 `:memory:`；Docker 中为 `/data/timenote.sqlite`                                |
| `SQLITE_BACKUP_PATH`       | —                                      | 仅 `pnpm db:backup` 使用，必须是尚不存在的文件                                                         |
| `LOG_DIR`                  | `.tmp/logs`                            | 请求日志目录，按 `web/`、`api/` 分目录、按天分 JSONL 文件；Docker 中为 `/data/logs`                    |
| `DEFAULT_TIME_ZONE`        | `Asia/Shanghai`                        | 新账号的默认 IANA 时区                                                                                 |
| `COOKIE_SECURE`            | 生产 `true`，否则 `false`              | 仅开发环境可改；生产设为 `false` 会拒绝启动                                                            |
| `SESSION_TTL_SECONDS`      | `2592000`（30 天）                     | 登录会话有效期，活跃使用时滚动续期；300 ～ 1 年                                                        |
| `LOGIN_RATE_LIMIT`         | `10`                                   | 每分钟每个来源地址的登录尝试次数；1 到 1000                                                            |
| `REGISTER_RATE_LIMIT`      | `5`                                    | 每分钟每个来源地址的公开注册次数；1 到 1000；建议 ≤ `LOGIN_RATE_LIMIT`                                 |
| `PUBLIC_REGISTER_ENABLED`  | `false`                                | 是否开放公开自助注册（`true` / `false`）；开启后新注册账号默认停用                                     |
| `SIGN_MASTER_KEY`          | development/test 可空；production 必填 | 请求完整性 MAC 的 HKDF 主密钥，base64url 且解码 ≥32 字节。缺省时 development/test 使用固定开发派生密钥 |
| `REQUEST_BODY_LIMIT`       | `1048576`（1 MiB）                     | 请求体上限，影响备份导入大小；1 KiB ～ 16 MiB                                                          |
| `FEED_WINDOW_PAST_YEARS`   | `1`                                    | 订阅输出包含过去几年的周年；0 ～ 10                                                                    |
| `FEED_WINDOW_FUTURE_YEARS` | `20`                                   | 订阅输出包含未来几年的周年；1 ～ 50                                                                    |

## 订阅地址与 `WEB_ORIGIN`

订阅链接 = `WEB_ORIGIN` + `/api/feeds/<token>.ics`。修改 `WEB_ORIGIN` 不会让已发出的 token 失效，但设备上保存的是旧主机名；换域名后需在设备上重新添加订阅（或保留旧域名转发）。
