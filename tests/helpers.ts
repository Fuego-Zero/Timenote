import { join } from "node:path";

import { createApiServer } from "../apps/api/src/index.js";
import { ensureInitialAdmin, loadConfig, type LogSink, openRepository } from "../packages/runtime/src/index.js";
import { migrate } from "../packages/runtime/src/migrate.js";
import { temporaryDirectory } from "./fixtures.js";

export const webOrigin = "http://127.0.0.1:8720";
export const adminPassword = "admin-password-1";

/** 真实 SQLite 文件 + Fastify inject；时钟可拨动，用于验证跨年窗口。 */
export async function harness(env: NodeJS.Dict<string> = {}, options: { logSink?: LogSink } = {}) {
  const dir = await temporaryDirectory("api-");
  const sqlitePath = join(dir, "timenote.sqlite");
  const config = loadConfig({
    NODE_ENV: "test",
    SQLITE_PATH: sqlitePath,
    WEB_ORIGIN: webOrigin,
    INITIAL_ADMIN_USERNAME: "admin",
    INITIAL_ADMIN_PASSWORD: adminPassword,
    ...env,
  });
  config.logSink = options.logSink;
  migrate(sqlitePath);
  const repo = openRepository(sqlitePath);
  await ensureInitialAdmin(repo, config);
  const clock = { now: Date.UTC(2026, 9, 2, 4, 0, 0) };
  const app = await createApiServer(config, repo, { now: () => clock.now });

  function browser() {
    let cookie: string | undefined;
    async function request<T = unknown>(
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      url: string,
      body?: unknown,
      headers: Record<string, string> = {}
    ) {
      const res = await app.inject({
        method,
        url,
        headers: {
          origin: webOrigin,
          ...(cookie ? { cookie } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...headers,
        },
        ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
      });
      const setCookie = res.headers["set-cookie"];
      const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      if (first) {
        const pair = first.split(";")[0]!;
        cookie = pair.endsWith("=") ? undefined : pair;
      }

      const json = res.headers["content-type"]?.toString().includes("json") ? (res.json() as T) : undefined;
      return { status: res.statusCode, headers: res.headers, body: res.body, json: json as T };
    }

    async function login(username = "admin", password = adminPassword) {
      const res = await request("POST", "/api/auth/login", { username, password });
      if (res.status !== 200) {
        throw new Error(`登录失败：${res.status} ${res.body}`);
      }

      return res;
    }

    return { request, login };
  }

  async function close() {
    await app.close();
    repo.close();
  }

  return { app, browser, clock, close, config, repo };
}

export type Harness = Awaited<ReturnType<typeof harness>>;
