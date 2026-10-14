import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

if (existsSync(".env")) {
  console.log(".env 已存在，保留原文件");
  process.exit(0);
}

writeFileSync(
  ".env",
  `NODE_ENV=development
SQLITE_PATH=./data/timenote.sqlite
WEB_ORIGIN=http://127.0.0.1:8720
WEB_BIND_HOST=0.0.0.0
DEFAULT_TIME_ZONE=Asia/Shanghai
SIGN_MASTER_KEY=${randomBytes(32).toString("base64url")}
`,
  { mode: 0o600, flag: "wx" }
);
console.log("已生成本地 .env（Git 忽略）。");
console.log("空库首次打开 Web 时走引导创建管理员。手机订阅日历时把 WEB_ORIGIN 改为可访问地址。");
