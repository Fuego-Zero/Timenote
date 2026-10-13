# Timenote 多容器 Compose 部署方案（草案）

> 状态：**仅方案，未改** `compose.yml` / `Dockerfile` / 应用代码。  
> **口径（覆盖此前「宿主机 Nginx 进方案主路径」）**：
>
> 1. **项目不配置 Nginx / SSL**——仓库不提供、不维护「必须装宿主机 Nginx」的部署主路径。
> 2. **Compose 暴露必要端口**，由**部署方自行反代**（Nginx、Caddy、云负载均衡等均可）。
> 3. 仓库**只提供一份**示例配置：[`deploy/nginx.example.conf`](../deploy/nginx.example.conf)，供开源用户参考。
> 4. **证书与域名由部署方自理**；本仓库不申请、不挂载、不轮换证书。  
>    对照现状：单容器 `app`（Web 8720 + 进程内 API 8721 + SQLite），见 [`deployment.md`](./deployment.md) 与下方「当前 compose 暴露端口」。  
>    实施约束（多容器落地时）：api 容器内绑 **`0.0.0.0:8721`**；**不对公网裸映射** api（避免 `8721:8721` 绑 `0.0.0.0`）；默认仅环回发布供本机反代；`TRUST_PROXY`；Cookie `Secure` + `SameSite=Lax`；SPA fallback 落在 **web**；实验栈 **`-p timenote-multi`**。

### 口径一览

| 层         | 做什么                                       | 不做什么                                                    |
| ---------- | -------------------------------------------- | ----------------------------------------------------------- |
| compose    | 启动应用服务并**暴露必要端口**（见端口清单） | 不定义 nginx/caddy 服务；不在项目内配置 TLS                 |
| 部署方反代 | 自选软件终结 HTTPS、分流、安全头             | 不强制必须用 Nginx；不强制跟仓库示例一字不差                |
| 仓库示例   | `deploy/nginx.example.conf` 仅供参考         | 不假装已部署 SSL；不把示例写成「现网站点必装文件」          |
| 废弃表述   | —                                            | 「宿主机 Nginx 为唯一主路径」「compose 内边缘反代为主方案」 |

---

## 当前 compose 暴露端口清单（只读，以仓库 `compose.yml` 为准）

| 宿主机映射                | 容器端口 | 用途                                   |
| ------------------------- | -------- | -------------------------------------- |
| **`127.0.0.1:8720:8720`** | `8720`   | 单服务 `app`：Web + 同源 `/api/*` 反代 |

说明：

- API 进程内监听 `8721`，**当前 compose 未把 8721 发布到宿主机**；对外只经 `8720` 的同源反代。
- 绑定 `127.0.0.1` 表示仅本机可达，便于部署方在同机做反代；**不要**在未加认证的前提下改成 `0.0.0.0:8720` 直接对公网。
- 多容器草案若落地，预期另增环回映射（见第 2 节）；**在改 compose 之前，以本表为准**。

---

## 1. 服务拆分与共享 SQLite（多容器目标态）

| 角色               | 职责                                         | 建议进程内行为                                                          |
| ------------------ | -------------------------------------------- | ----------------------------------------------------------------------- |
| **api**            | Fastify API、鉴权、SQLite 读写、备份脚本入口 | 容器内绑 **`0.0.0.0:8721`**；**唯一**写库                               |
| **web**            | 前端静态资源（SPA build 产物）               | 只提供静态 + **SPA fallback**；**不**直连 SQLite                        |
| **部署方反代**     | 对外 HTTPS、路由、压缩、安全头               | **不在 compose / 本项目配置范围内**；可参考 `deploy/nginx.example.conf` |
| **（可选后续）db** | 若将来迁离 SQLite                            | 本方案**不引入**独立 DB 容器                                            |

### 共享 SQLite 用法

- 命名卷（例如 `timenote_data`）**仅**挂给 `api`，路径建议 `/data`。
- `web` **不要**挂载数据库卷。
- 库文件：`/data/timenote.sqlite`（及 `-wal` / `-shm`）；日志：`/data/logs/`（若由 api 写）。
- SQLite 单写者；生产长期 **一个** api 实例。
- 备份：在 **api** 容器内执行现有 `scripts/backup.ts`，再 `compose cp` 拷出。

### 进程模型变化（相对现状）

现状：`scripts/start.ts` 单进程同时起 Web + API。  
目标：compose 内两个服务——`web`（静态）+ `api`；TLS / 域名 / 证书全部由部署方自理。

---

## 2. Compose：仅 web / api（无边缘 nginx）

### 服务名（建议，实验栈）

| compose service | 镜像/构建                                                                                    | 建议宿主机映射                      | 容器内监听         |
| --------------- | -------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------ |
| `api`           | 现有 runtime，CMD 仅 API                                                                     | **`127.0.0.1:8721:8721`**（仅环回） | **`0.0.0.0:8721`** |
| `web`           | 静态文件服务（node static 等；可用官方 nginx **镜像仅托管 dist**，但它**不是**项目边缘反代） | **`127.0.0.1:8080:80`**（仅环回）   | `80`               |

要点：

- **不要**在 compose 里定义边缘反代服务（nginx/caddy 等）或映射宿主机 `80`/`443`。
- **宿主机不对公网裸映射 api**：禁止 `ports: ["8721:8721"]`（会绑 `0.0.0.0`）。
- api **必须**在容器内监听 **`0.0.0.0:8721`**（不要只绑容器内 `127.0.0.1`）。
- 默认发布方式：环回端口，供**同机**反代访问。若改为「反代加入同一 Docker 网络、零端口发布」，需另开方案。

### 网络与项目名

- compose 默认 bridge 即可。
- **实验栈必须独立项目名**，避免覆盖现网卷/容器：  
  `COMPOSE_PROJECT_NAME=timenote-multi`  
  或 `docker compose -p timenote-multi -f compose.multi.yml up -d`
- 实验数据卷建议加前缀（如 `timenote_multi_data`），与现网 `timenote_data` 区分。
- 现网继续用现有 `compose.yml` + 默认项目名，直至切换完成。

### 端口映射示意（非最终文件；落地前勿当作已暴露）

```yaml
# compose.multi.yml 示意 —— 仅 web + api，无 nginx 服务
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: api # 或等价拆分方式；名称以落地为准
    environment:
      NODE_ENV: production
      SQLITE_PATH: /data/timenote.sqlite
      LOG_DIR: /data/logs
      API_PORT: "8721"
      HOST: "0.0.0.0"
      TRUST_PROXY: "1"
      WEB_ORIGIN: "https://cal.example.com" # 填部署方真实对外地址
    ports:
      - "127.0.0.1:8721:8721"
    volumes:
      - timenote_multi_data:/data
    restart: unless-stopped
    init: true
    stop_grace_period: 20s
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://127.0.0.1:8721/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))",
        ]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s

  web:
    build:
      context: .
      dockerfile: Dockerfile
      target: web
    ports:
      - "127.0.0.1:8080:80"
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1/ >/dev/null || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  timenote_multi_data:
```

环境变量补充：

- `WEB_ORIGIN` = 浏览器看到的 HTTPS 源（部署方域名）
- api：`TRUST_PROXY=1`（或 Fastify `trustProxy: true`），以便识别 `X-Forwarded-*`
- Cookie（经 HTTPS 反代后）：`Secure=true`、`SameSite=Lax`
- web：无需 DB；前端 API 基址优先相对路径 `/api`

### 健康检查（路径拆清）

| 探针位置             | 路径                 | 用途                                        |
| -------------------- | -------------------- | ------------------------------------------- |
| api 容器内           | `GET /health`        | compose `api` healthcheck；**不对公网暴露** |
| web 容器内           | `GET /`              | compose `web` healthcheck                   |
| 经部署方反代（可选） | `GET /api/health` 等 | 须与 api 真实路由一致                       |

### 卷与权限

- `timenote_multi_data`（实验）或现网等价卷：仅挂 `api`。
- 首次部署前 `chmod 600 .env`；首个管理员在空库时经 Web 首次引导创建（`POST /api/setup/admin`），不经环境变量注入。

---

## 3. 反代示例（仅供参考）

**路径：** [`deploy/nginx.example.conf`](../deploy/nginx.example.conf)

- **不是** compose 的一部分，**不是**项目必装组件。
- 示例默认反代到**当前**已暴露的 `127.0.0.1:8720`（单容器）。
- 文末注释给出多容器分流（`/api/` → `8721`，其余 → `8080`）的示意；仅在 compose 真正发布这些端口后使用。
- **证书路径、域名、`server_name`、ACME 目录均由部署方填写**；仓库不提供证书，也不假装 SSL 已部署。
- 也可用 Caddy、Traefik、云厂商 LB 等，只要把 HTTPS 流量转到 compose 暴露的端口，并保留 `Host` / `Origin` / `Cookie` / `If-None-Match` 等头。

部署方自检建议：

- `WEB_ORIGIN` 与浏览器地址栏一致（含 `https://`）。
- 不要对 `/api/` 开响应缓存；订阅为 `private, no-cache`。
- 访问日志含订阅 token，按敏感日志处理。

---

## 4. 与现有单容器方案的兼容 / 迁移步骤

原则：**先文档与并行验证，再切换；保留旧 `app` 与旧卷可回滚。** TLS/域名切换由部署方在自有反代上完成。

1. **冻结变更窗口**
   - 备份：`docker compose exec -e SQLITE_BACKUP_PATH=/data/backup-YYYYMMDD.sqlite app node --import tsx scripts/backup.ts`，再 `compose cp` 到 `./backups/`。

2. **并行准备**
   - 落地实验用 `compose.multi.yml`（仅 web/api）；**暂不覆盖**生产 `compose.yml`。
   - `docker compose -p timenote-multi -f compose.multi.yml up -d --build`
   - 确认本机：`curl 127.0.0.1:8721/health`、`curl 127.0.0.1:8080/`。
   - 部署方在自有反代上用临时域名或未 reload 的配置做语法检查（参考示例即可）。

3. **数据迁移**
   - 停写旧栈：`docker compose stop app`。
   - **复制**旧卷中的 sqlite（及 wal/shm）到实验卷 / 新 `api` 的 `/data`。

4. **切换**
   - 部署方将反代上游从 `127.0.0.1:8720` 改为分流（`8721` / `8080`）或按当时端口清单调整。
   - 验收：HTTPS、登录、`/api/`、前端刷新深链（SPA fallback）。
   - 确认空库走首次引导创建管理员（不再使用环境变量种子）。

5. **回滚**
   - 反代改回 `127.0.0.1:8720`。
   - `docker compose start app`。
   - 实验栈可 `docker compose -p timenote-multi down`（**先确认未误删共享卷**）。

6. **文档与脚本**
   - 生产文档以「compose 暴露端口 + 部署方自理反代/证书」为准。
   - 备份/`exec` 服务名 `app` → `api`。

---

## 5. 风险与待确认项

| 项                | 说明                                  | 需要确认                             |
| ----------------- | ------------------------------------- | ------------------------------------ |
| **证书与域名**    | **部署方自理**；项目不配置            | 正式域名？证书如何申请/续期？        |
| **WEB_ORIGIN**    | 必须与浏览器地址栏一致                | 是否仍为 `https://cal.example.com`？ |
| **API 路径前缀**  | 多容器草案按 `/api/`                  | 实际是否都以 `/api` 开头？           |
| **前端 API 基址** | 相对路径 `/api` 最省事                | 前端如何拼 API URL？                 |
| **环回端口**      | 实验栈建议 `127.0.0.1:8721` / `8080`  | 是否与现网其它服务冲突？             |
| **公网入口**      | 由部署方反代暴露；compose 不占 80/443 | 是否维持「仅环回 + 自有反代」？      |
| **SPA fallback**  | 必须在 **web** 容器内                 | 构建产物路径？                       |
| **SQLite 单实例** | 共享卷不可水平扩展 api                | 是否接受？                           |
| **开发体验**      | 本地是否也拆 web/api                  | 本地是否继续 `pnpm dev`？            |

---

## 6. 建议的下一步改哪些文件（清单，仍不执行）

1. **本文档** — 口径：compose 暴露端口 + 部署方反代；项目不配置 Nginx/SSL
2. **实验用** `compose.multi.yml` — 仅 `web` + `api`；`-p timenote-multi`；只映射 `127.0.0.1`；**无 nginx 服务**；**暂不替换**现网 `compose.yml`
3. **`deploy/nginx.example.conf`** — 已提供，仅供参考（对应当前 `8720`；注释含多容器分流）
4. **拆分构建** — `Dockerfile` 增加 `api` / `web` target；web 镜像内 SPA fallback
5. **启动入口** — 支持仅 API / 仅静态
6. **`.env.example`** — `WEB_ORIGIN`、`TRUST_PROXY`、Cookie、绑定说明
7. **运维脚本** — 备份服务名 `app` → `api`

明确 **本轮不做**：改现网 `compose.yml`、改 `Dockerfile` 生产行为、改应用代码、代部署方改其 Nginx/证书/DNS。

---

## 附录 A：与现状对照

| 现状                                              | 多容器目标                                                    |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `compose.yml` → 单一 `app`，暴露 `127.0.0.1:8720` | 实验 compose：`web` + `api`；端口仅 `127.0.0.1`               |
| 部署方反代 → `127.0.0.1:8720`（整站）             | 部署方反代可分流：`/api/`=`8721`，其余=`8080`（参考示例注释） |
| 无独立静态容器                                    | `web` 容器托管 SPA + fallback                                 |
| 卷挂在 `app`                                      | 卷仅挂 `api`                                                  |

## 不采用的方案（禁止写入主路径）

1. **把「宿主机 Nginx」写成项目唯一/强制主路径**（已覆盖；改为部署方自选反代 + 示例参考）。
2. **compose 内边缘 Nginx/Caddy 容器**（终止 TLS、反代 `/api` 与静态）。
3. **由 compose 映射宿主机 `80`/`443`**。

对外 TLS、域名与证书只属于**部署方**；应用镜像与本仓库不承担对外证书。
