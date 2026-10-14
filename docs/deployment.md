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

## 升级

```sh
git pull
docker compose up -d --build
```

启动时自动执行未应用的迁移；已应用迁移的校验和不一致或数据库含未登记的表时拒绝启动，不会自动改写数据。升级前先做一次 SQLite 备份。

## 本机不用 Docker

```sh
pnpm install --frozen-lockfile
pnpm build
NODE_ENV=production WEB_ORIGIN=https://cal.example.com SQLITE_PATH=./data/timenote.sqlite pnpm start
```

同样需要部署方自备 HTTPS 反向代理。用进程管理器（systemd、pm2 等）保证单实例与自动重启。
