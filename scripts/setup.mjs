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
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=${randomBytes(18).toString("base64url")}
`,
  { mode: 0o600, flag: "wx" }
);
console.log("已生成本机 .env（Git 忽略），未输出密码。");
console.log(
  "初始管理员账号和随机密码见 .env；首次启动后请登录并修改密码。手机订阅调试需把 WEB_ORIGIN 改为局域网地址。"
);
