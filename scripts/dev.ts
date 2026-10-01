import { networkInterfaces } from "node:os";

import { createApiServer } from "../apps/api/src/index.js";
import { startWeb } from "../apps/web/server/index.js";
import {
  createFileLogSink,
  ensureInitialAdmin,
  loadConfig,
  loadDotenv,
  openRepository,
  resolveLogRoot,
} from "../packages/runtime/src/index.js";
import { migrate } from "../packages/runtime/src/migrate.js";

loadDotenv(".env");
const config = loadConfig();
const logRoot = resolveLogRoot();
config.logSink = config.logSink ?? createFileLogSink(logRoot, config.env);

migrate(config.sqlitePath);
const repo = openRepository(config.sqlitePath);
await ensureInitialAdmin(repo, config);
const api = await createApiServer(config, repo);
// API 只在本机回环地址监听，浏览器和日历客户端统一经 Web 同源反代访问。
await api.listen({ host: "127.0.0.1", port: config.apiPort });
const web = await startWeb(`http://127.0.0.1:${config.apiPort}`, config.webPort, process.argv.includes("--built"), {
  host: config.webBindHost,
  logging: { logSink: config.logSink, env: config.env },
});
const lan = Object.values(networkInterfaces())
  .flatMap(addrs => addrs ?? [])
  .filter(addr => !addr.internal && addr.family === "IPv4")
  .map(addr => `http://${addr.address}:${web.port}`);
const lanHint = config.webBindHost === "127.0.0.1" || !lan.length ? "" : `；局域网 ${lan.join(" ")}`;
console.log(
  `Web 已启动：http://127.0.0.1:${web.port}${lanHint}；订阅基址=${config.webOrigin}；数据库=${config.sqlitePath}；日志=${logRoot}/{web,api}/`
);
let closing = false;
async function close() {
  if (closing) {
    return;
  }

  closing = true;
  await web.close();
  await api.close();
  repo.close();
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void close();
  });
}
