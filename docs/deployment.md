# 部署说明

岁时记（Timenote）是单进程、单 SQLite 文件的服务，按单实例部署：一个容器、一个命名卷。  
**项目不配置 Nginx / SSL**；Compose 只暴露必要端口，由**部署方自行反代**并自理证书与域名。仓库仅提供一份 Nginx 示例供参考：[`deploy/nginx.example.conf`](../deploy/nginx.example.conf)。不要横向扩容或让多个进程共用同一数据库文件。

## 准备

1. 一个解析到服务器的域名（例如 `cal.example.com`）。日历客户端订阅需要有效 HTTPS 证书——**证书由部署方申请与续期**。
2. 服务器上安装 Docker 与 Docker Compose。
3. 复制环境文件并修改：

```sh
cp .env.example .env
chmod 600 .env
```

至少修改：

```dotenv
NODE_ENV=production
WEB_ORIGIN=https://cal.example.com
```

`compose.yml` 会覆盖 `SQLITE_PATH`、`LOG_DIR`、端口与监听地址，`.env` 里这些值不生效。

## 启动

```sh
docker compose up -d --build
docker compose ps        # 状态应为 healthy
docker compose logs -f   # 启动日志打印订阅基址与数据库路径
```

容器以 `node` 用户运行，数据在命名卷 `timenote_data`（容器内 `/data`，权限 700）：

| 路径                    | 内容                        |
| ----------------------- | --------------------------- |
| `/data/timenote.sqlite` | 数据库（含 `-wal`、`-shm`） |
| `/data/logs/{web,api}/` | 失败请求日志（JSONL，按天） |

### Compose 暴露端口清单

| 宿主机映射                | 容器端口 | 说明                                               |
| ------------------------- | -------- | -------------------------------------------------- |
| **`127.0.0.1:8720:8720`** | `8720`   | Web + 同源 `/api/*` 反代；仅本机可达，供部署方反代 |

进程内 API 监听 `8721`，**未**由 compose 发布到宿主机。健康检查同时探测 Web `/` 与 API `/health`。

## 反向代理与 HTTPS（部署方自理）

本仓库**不**安装、不维护 Nginx/Caddy，也**不**申请或挂载证书。请把 HTTPS 流量转到上表端口。可参考 [`deploy/nginx.example.conf`](../deploy/nginx.example.conf)（仅示例）。

以 Caddy 为例（自动申请证书，仍属部署方配置）：

```caddyfile
cal.example.com {
	encode gzip
	reverse_proxy 127.0.0.1:8720
}
```

若用 Nginx：核心是 `proxy_pass http://127.0.0.1:8720;`，保留 `Host`、`Origin`、`Cookie`、`If-None-Match` 等请求头；证书路径与 `server_name` 自行填写。无论哪种代理：

- 不要对 `/api/` 开启响应缓存；订阅响应是 `private, no-cache`。
- 不要改写 `Origin`，写请求依赖它与 `WEB_ORIGIN` 一致。
- 访问日志会包含订阅地址里的完整 token，按敏感日志处理或在代理层对 `/api/feeds/` 路径脱敏。

多容器拆分草案见 [`deployment-compose-multi.md`](./deployment-compose-multi.md)（未改现网 compose）。

## 首次登录

首次打开站点时按引导创建管理员账号（生产环境要求强密码），再到「账号管理」为家人建号。首个管理员只在空库时通过 `POST /api/setup/admin` 创建一次。

## 备份与恢复

两种方式互补：

- **JSON 导出**（每个账号在「备份」页自己操作）：只含该账号事件的可编辑字段，适合迁移或回滚个别事件；不含账号、密码和订阅地址。当前导出格式为 v2（含重复规则、公历缺日策略、里程碑与里程碑标题模板字段）；v1 备份文件不再接受导入，需要用升级前的版本重新导出。
- **SQLite 一致性备份**（运维操作）：在线复制整个数据库，含全部账号与订阅地址。

```sh
docker compose exec -e SQLITE_BACKUP_PATH=/data/backup-$(date +%Y%m%d).sqlite app \
  node --import tsx scripts/backup.ts
docker compose cp app:/data/backup-$(date +%Y%m%d).sqlite ./backups/
```

目标文件已存在时拒绝覆盖。备份文件含密码哈希与订阅 token 哈希，按敏感数据保管。

从 SQLite 备份恢复（会替换现有全部数据，先确认备份正确并另存当前数据库）：

```sh
docker compose stop app
docker compose cp ./backups/backup-20260101.sqlite app:/data/timenote.sqlite
# 同时删除旧的 -wal / -shm，避免与新文件不一致
docker compose run --rm --entrypoint sh app -c 'rm -f /data/timenote.sqlite-wal /data/timenote.sqlite-shm'
docker compose start app
```

## 发布

正式发布不在服务器上拉取仓库或构建镜像。Pull Request 合并进 `main` 之后，[`.github/workflows/release-image.yml`](../.github/workflows/release-image.yml) 才在 GitHub Actions 中编译 `linux/amd64` 镜像，推到 `ghcr.io/fuego-zero/timenote`（同时打 `latest`、`package.json` 的 `version` 和合并提交的 40 位 sha），再 SSH 到服务器：先做 SQLite 备份，按 sha 拉取镜像，在本地标成 `timenote:{版本号}` 后才用 [`deploy/compose.yml`](../deploy/compose.yml) 替换目录里的 Compose 并 `up`。直接推送到 `main` 或其他分支不会发布。拉取失败时，服务器上原来的 Compose 和正在运行的容器保持不动。镜像里包含应用源码，包保持 Private。合并请使用 Merge commit 或 Squash and merge，这样镜像标签才是 `main` 上的那次提交。要更换 `docker ps` 里的版本号，修改仓库根目录 `package.json` 的 `version` 后再合并。

服务器目录里放 `.env` 和由 Actions 上传的 Compose。数据库与日志在该目录的 `data/` 子目录（容器内仍是 `/data`），不使用 Docker 命名卷。`DEPLOY_PATH` 填这个目录的绝对路径。Actions 用密钥 `COMPOSE_PROJECT_NAME` 固定项目名，不要在 `deploy/compose.yml` 里写 `name`。目录里还没有正在运行的容器时，发布会跳过 SQLite 备份。

仓库 Settings → Actions → General → Workflow permissions 选 **Read and write permissions**，否则 `GITHUB_TOKEN` 不能推送镜像。然后在 Settings → Secrets and variables → Actions 添加：

| 密钥                   | 内容                                              |
| ---------------------- | ------------------------------------------------- |
| `SSH_HOST`             | 搬瓦工 IP                                         |
| `SSH_PORT`             | 面板里的 SSH 端口                                 |
| `SSH_USER`             | 能直接运行 Docker 的用户，通常是 `root`           |
| `SSH_PRIVATE_KEY`      | 专用部署私钥全文（含 BEGIN/END 行）               |
| `SSH_KNOWN_HOSTS`      | `ssh-keyscan -p <端口> <IP>` 的主机密钥行         |
| `DEPLOY_PATH`          | 服务器上的部署目录绝对路径，例如 `/data/Timenote` |
| `COMPOSE_PROJECT_NAME` | Compose 项目名，例如 `timenote`                   |
| `GHCR_USER`            | GitHub 用户名                                     |
| `GHCR_TOKEN`           | 只读 Packages 的 Personal Access Token            |

`GHCR_TOKEN` 用 classic token，只勾选 `read:packages`。镜像是私有的，服务器每次发布用它登录 GHCR，成功后会 `docker logout`。

日常发布：开 Pull Request 合入 `main`，合并成功后等 Actions 的 `release-image` 成功。未合并就关闭的 PR 不会发布。容器启动时执行未应用的迁移；校验和不匹配或库里有未登记的表时拒绝启动。回滚：在 `main` 分支上手动运行该工作流，`image_sha` 填已发布过的 40 位 sha。迁移已经写入数据库时，用升级前的 SQLite 备份恢复，不能只换旧镜像。备份文件留在部署目录的 `data/backup-<UTC时间>.sqlite`。

有源码的机器仍可用仓库根目录的 `compose.yml` 本地构建：`docker compose up -d --build`。这不是搬瓦工上的发布路径。

## 本机不用 Docker

```sh
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production WEB_ORIGIN=https://cal.example.com SQLITE_PATH=./data/timenote.sqlite pnpm start
```

同样需要部署方自备 HTTPS 反向代理。用进程管理器（systemd、pm2 等）保证单实例与自动重启。
