# 安全说明

## 账号与会话

- 默认可选关闭的公开注册（`PUBLIC_REGISTER_ENABLED`，默认 `false`）。关闭时 `POST /api/auth/register` 返回 `FORBIDDEN`，登录页不展示注册入口。开启后允许自助注册：新号 `role=user`，是否停用由 `REGISTER_DEFAULT_DISABLED` 决定（默认 `true`，即停用）。注册请求必须带上浏览器算完的 ALTCHA 结果，服务端用 `SIGN_MASTER_KEY` 派生的密钥核对，同一道题只能用一次；没有有效结果不建账号。两种情况下都不创建会话、不写 Cookie。默认停用时须管理员在账号管理启用后方可登录；设为 `false` 时注册后可立即登录。未启用/停用与错密登录返回同一提示，不暴露账号状态。
- 首个管理员只经首次引导创建：空库时 `GET /api/setup` 返回 `needed: true`，`POST /api/setup/admin` 创建并建立会话。不使用环境变量种子管理员。生产环境引导创建要求强密码（≥16 位且至少三类字符，避开常见弱口令）。公开注册**不替代**首次引导。管理员后台新建账号仍默认启用。所有管理接口在服务端 `requireAdmin` 校验，不依赖前端隐藏。
- 密码用 scrypt（N=2^15、r=8、p=1、16 字节随机盐）哈希，存为 `scrypt$N$r$p$salt$hash`；数据库约束禁止出现明文 `password` 字段。
- 登录时账号不存在、已停用、密码错误返回同一提示；账号不存在时也对占位哈希做一次校验，避免用响应时间探测用户名。
- 用户 payload 含 `lastLoginAt`（epoch ms，可 null）：仅在 `POST /api/auth/login` 与 `POST /api/setup/admin` 鉴权成功后由 `recordLogin` 写入；会话活跃续期、登出、改密、密码错误或账号停用均不更新。管理员 `GET /api/admin/users` 列表可见该字段。
- 会话 Cookie 是 32 字节随机 token，数据库只存其 SHA-256。属性：`HttpOnly`、`SameSite=Lax`、`Path=/`；生产强制 `Secure` 并使用 `__Host-timenote` 前缀。会话活跃时每 10 分钟滚动续期。
- 改密后除当前会话外全部失效；管理员重置密码、停用账号会立即踢出该账号所有会话。
- 管理员不能停用、降级或删除自己；任何变更都不能让系统失去最后一个启用的管理员。

会话 Cookie 仍不使用独立的「会话签名密钥」：token 本身是不可猜测的随机值，服务端按哈希查找校验。这与下文「请求完整性 MAC」不是同一件事——MAC 保护的是单次 HTTP 请求的完整性，密钥由服务端主密钥经 HKDF 派生，详见「请求完整性 MAC（SIGN）」节。

## 请求完整性 MAC（SIGN）

请求完整性 MAC（下称 SIGN）**不是**会话 Cookie 的签名密钥，也不替代 Cookie 会话或 Origin 校验；三者叠加，用于提高篡改已登录（及 login/setup）请求的成本。目标是防御纵深，不防扒包。

### 范围

- 需登录的 `/api/*`（读+写）强制 SIGN。
- `POST /api/auth/login`、`POST /api/auth/register`、`POST /api/setup/admin` **必须**使用匿名短时 signKey。
- 仅 `GET /api/auth/session`、`GET /api/auth/register-challenge`、`GET /api/setup`（及同类只读探测）可不签或只校 Origin。
- `/health`、`/api/feeds/*` 不签（feed 仍只凭 URL token）。

### 密钥形态（HKDF-SHA256）

- 服务端主密钥仅来自环境变量 `SIGN_MASTER_KEY`（base64url，解码后 ≥32 字节）。production 必填；development/test 缺省时使用固定派生开发密钥（不可用于生产）。
- 对 `sessionId`（匿名则为 `anonKeyId`）做 HKDF-SHA256 派生 `signKey`：
  - salt：`timenote-request-mac-v1`（UTF-8）
  - info：`session:<id>` 或 `anon:<id>`
  - 长度：32 字节
- 客户端只拿到派生后的 `signKey`（内存）；服务端验签时再派生。不在库内存储 signKey 哈希。
- 单进程可不落库；多实例靠同一主密钥派生即可对齐。进程重启后客户端须重新领取（`GET /api/auth/session` 或重新 login）。

### 匿名 key

- `GET /api/auth/session`（未登录）与 `GET /api/setup`（`needed: true`）可下发 `{ anonKeyId, signKey, expiresAt }`。
- 有效期约 5 分钟；进程内登记，超过存活上限拒发（限流）。login/register/setup 请求头须带 `x-timenote-anon-id`。

### 会话 key

- 登录/首次引导成功响应与已登录的 `GET /api/auth/session` 返回会话 `signKey`。
- `signKey` 绑定 `sessionId`；新登录换新会话即换 key。TTL 续期不改 `sessionId`，故不换 key。

### 算法与头

- HMAC-SHA256；规范串为 `METHOD\nPATH\nQUERY\nTIMESTAMP\nNONCE\nBODY_SHA256_HEX`。
- PATH 去 query、非根去尾 `/`；QUERY 按键排序后 `k=v&...`；BODY 为原始请求体的 SHA-256（无体则为空串哈希）。
- 头：`x-timenote-timestamp`（Unix 秒）、`x-timenote-nonce`、`x-timenote-signature`（base64url）；匿名另加 `x-timenote-anon-id`。
- 时间窗约 60 秒；nonce 进程内去重（多实例不共享 nonce 存储）。

### 失败

- `SIGN_INVALID` / `SIGN_EXPIRED` / `SIGN_REPLAY` → HTTP 403，响应含稳定 `code`、`message` 与 `requestId`。

## 跨站请求

- 所有写请求（POST/PUT/PATCH/DELETE）必须带与 `WEB_ORIGIN` 一致的 `Origin`；任何请求带了不一致的 `Origin`，或 `Sec-Fetch-Site: cross-site`，都返回 403。开发环境额外接受私有局域网地址，方便手机调试。
- 订阅输出 `/api/feeds/*` 和 `/health` 不走 Cookie 会话与同源校验，只凭 URL 中的 token 鉴权。

## 订阅地址

- token 为 32 字节随机值（43 位 base64url）。数据库同时保存明文和 SHA-256：明文只用于登录后再次显示地址，拉取订阅仍按哈希查找。升级前创建、且之后没有轮换的地址没有明文，需要轮换一次才能再次显示。
- URL 里只有 token，不含姓名、生日、日期或账号信息。
- 撤销或轮换后旧地址立即返回 404；账号停用或删除后其全部地址返回 404。不存在、格式错误、已撤销的 token 返回同样的响应，不暴露区别。
- 订阅响应 `Cache-Control: private, no-cache`：共享缓存（CDN、反向代理缓存）不得存储，客户端每次用 ETag 条件请求重新校验。反向代理不要对 `/api/` 开启缓存。
- 每个账号最多 10 个订阅地址。

把订阅地址当作密码对待：任何拿到地址的人都能读取该账号的全部事件标题、日期与备注。

## 输入与输出

- 事件名称、标题模板、前缀、备注都有长度上限，并拒绝除换行外的控制字符；ICS 生成由 ical-generator 负责转义与折行，测试用 ical.js 往返解析验证无法注入额外属性或组件。
- 标题模板只做 `{{name}}`、`{{years}}` 的字面替换，不执行表达式；其他花括号一律拒绝。
- 所有接口返回稳定的错误码与中文提示，5xx 不暴露内部错误详情，只返回 `requestId` 便于在日志中定位。

## 日志

- 开发环境记录全部请求并附带脱敏后的请求/响应体；生产和测试只记录失败请求，不附带请求体。
- 键名包含 `password`、`token`、`authorization`、`cookie`、`url` 的字段整体替换为 `[redacted]`；订阅路径只保留 token 前 4 位；ICS 正文不写入日志。测试锁定了日志中不出现密码、会话 token 或完整订阅 token。

## 浏览器侧

- `index.html` 每次请求生成 CSP nonce：`script-src`、`style-src` 只允许同源与 nonce，`worker-src` 允许同源和 `blob:`（注册页的计算题在浏览器里开 Worker），`img-src` 为同源与 `data:`，`object-src 'none'`、`frame-ancestors 'none'`、`base-uri 'none'`；Ant Design 的运行时样式统一带 nonce。配置了回声反馈时，`connect-src` 额外允许该服务的 Origin，`img-src` 额外允许 `blob:`，供面板预览用户自己选择的图片。反馈面板使用同一个 nonce，不放宽为任意来源或 `unsafe-inline` 脚本。
- API 使用 helmet 默认安全头；Web 对所有响应加 `X-Content-Type-Options: nosniff` 与 `Referrer-Policy: no-referrer`（避免订阅地址经 Referer 泄露）。

## 限流

- 全局每个来源地址每分钟 120 次请求；登录接口每分钟 `LOGIN_RATE_LIMIT` 次（默认 10）；公开注册接口每分钟 `REGISTER_RATE_LIMIT` 次（默认 5，建议 ≤ 登录桶）。注册计算题走全局限额，提交注册仍受注册桶限制。
- 已知限制：来源地址取 Web 反代看到的上一跳。部署在反向代理或 Docker 端口映射之后时，所有客户端会共用同一个来源地址，登录限流变为全站共享——遭遇撞库时可能短时间内阻止正常登录。家庭规模使用可以接受；需要按真实客户端限流时，应在反向代理层做限流。

## 运维边界

- 不提供无鉴权的管理接口、调试后门或「重置为初始管理员」的开关。
- 数据库、`.env`、日志目录都应只对运行用户可读；Docker 镜像以 `node` 用户运行，`/data` 权限为 700。
