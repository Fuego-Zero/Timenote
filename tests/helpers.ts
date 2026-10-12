import { join } from "node:path";

import { createApiServer } from "../apps/api/src/index.js";
import {
  buildSignHeaders,
  ensureInitialAdmin,
  isSignExemptPath,
  loadConfig,
  type LogSink,
  openRepository,
} from "../packages/runtime/src/index.js";
import { migrate } from "../packages/runtime/src/migrate.js";
import { temporaryDirectory } from "./fixtures.js";

export const webOrigin = "http://127.0.0.1:8720";
export const adminPassword = "admin-password-1";

/** 真实 SQLite 文件 + Fastify inject；时钟可拨以便验证签名时间窗。 */
export async function harness(
  env: NodeJS.Dict<string> = {},
  options: { logSink?: LogSink; seedAdmin?: boolean } = {}
) {
  const dir = await temporaryDirectory("api-");
  const sqlitePath = join(dir, "timenote.sqlite");
  const config = loadConfig({
    NODE_ENV: "test",
    SQLITE_PATH: sqlitePath,
    WEB_ORIGIN: webOrigin,
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
    let sessionSignKey: string | undefined;
    let anonSign: { anonKeyId: string; signKey: string; expiresAt: number } | undefined;

    async function mintAnon() {
      const res = await app.inject({
        method: "GET",
        url: "/api/setup",
        headers: { origin: config.webOrigin },
      });
      const json = res.json() as { anonSign?: { anonKeyId: string; signKey: string; expiresAt: number } };
      if (!json.anonSign) {
        throw new Error("无法获取匿名签名密钥");
      }

      anonSign = json.anonSign;
      return anonSign;
    }

    async function refreshSessionSign() {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/session",
        headers: { origin: config.webOrigin, ...(cookie ? { cookie } : {}) },
      });
      const json = res.json() as {
        signKey?: string;
        anonSign?: { anonKeyId: string; signKey: string; expiresAt: number };
      };
      if (json.signKey) {
        sessionSignKey = json.signKey;
      }

      if (json.anonSign) {
        anonSign = json.anonSign;
      }

      return json;
    }

    async function request<T = unknown>(
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      url: string,
      body?: unknown,
      headers: Record<string, string> = {}
    ) {
      const path = url.split("?")[0] ?? url;
      const bodyText = body === undefined ? undefined : JSON.stringify(body);
      const signHeaders: Record<string, string> = {};
      if (!isSignExemptPath(method, path)) {
        const needAnon =
          (method === "POST" && path === "/api/auth/login") || (method === "POST" && path === "/api/setup/admin");
        if (needAnon) {
          if (!anonSign || anonSign.expiresAt <= clock.now) {
            await mintAnon();
          }

          Object.assign(
            signHeaders,
            buildSignHeaders({
              method,
              url,
              bodyText,
              signKeyBase64Url: anonSign!.signKey,
              anonKeyId: anonSign!.anonKeyId,
              nowMs: clock.now,
            })
          );
        } else {
          if (!sessionSignKey) {
            await refreshSessionSign();
          }

          if (sessionSignKey) {
            Object.assign(
              signHeaders,
              buildSignHeaders({
                method,
                url,
                bodyText,
                signKeyBase64Url: sessionSignKey,
                nowMs: clock.now,
              })
            );
          }
        }
      }

      const res = await app.inject({
        method,
        url,
        headers: {
          origin: config.webOrigin,
          ...(cookie ? { cookie } : {}),
          ...(bodyText === undefined ? {} : { "content-type": "application/json" }),
          ...signHeaders,
          ...headers,
        },
        ...(bodyText === undefined ? {} : { payload: bodyText }),
      });
      const setCookie = res.headers["set-cookie"];
      const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      if (first) {
        const pair = first.split(";")[0]!;
        cookie = pair.endsWith("=") ? undefined : pair;
      }

      const json = res.headers["content-type"]?.toString().includes("json") ? (res.json() as T) : undefined;
      if (json && typeof json === "object") {
        const row = json as { signKey?: string; anonSign?: typeof anonSign };
        if (typeof row.signKey === "string") {
          sessionSignKey = row.signKey;
          anonSign = undefined;
        }

        if (row.anonSign) {
          anonSign = row.anonSign;
        }
      }

      if (res.statusCode === 401) {
        sessionSignKey = undefined;
      }

      return { status: res.statusCode, headers: res.headers, body: res.body, json: json as T };
    }

    async function login(username = "admin", password = adminPassword) {
      const res = await request("POST", "/api/auth/login", { username, password });
      if (res.status !== 200) {
        throw new Error(`登录失败：${res.status} ${res.body}`);
      }

      return res;
    }

    return { request, login, mintAnon, refreshSessionSign };
  }

  if (options.seedAdmin !== false) {
    const seeded = await browser().request("POST", "/api/setup/admin", {
      username: "admin",
      password: adminPassword,
      displayName: "管理员",
    });
    if (seeded.status !== 200) {
      throw new Error(`种子管理员失败：${seeded.status} ${seeded.body}`);
    }
  }

  async function close() {
    await app.close();
    repo.close();
  }

  return { app, browser, clock, close, config, repo };
}

export type Harness = Awaited<ReturnType<typeof harness>>;
