import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { startWeb } from "../../apps/web/server/index.js";
import type { FeedToken } from "../../packages/contracts/src/index.js";
import { buildSignHeaders } from "../../packages/runtime/src/index.js";
import { adminPassword, harness, type Harness } from "../helpers.js";

let h: Harness;
let web: Awaited<ReturnType<typeof startWeb>>;
let base: string;
const lines: string[] = [];

beforeEach(async () => {
  lines.length = 0;
  h = await harness({ NODE_ENV: "development" });
  await h.app.listen({ host: "127.0.0.1", port: 0 });
  const address = h.app.server.address();
  const apiPort = typeof address === "object" && address ? address.port : 0;
  web = await startWeb(`http://127.0.0.1:${apiPort}`, 0, true, {
    host: "127.0.0.1",
    logging: { env: "development", logSink: { write: line => lines.push(line) } },
  });
  base = `http://127.0.0.1:${web.port}`;
});
afterEach(async () => {
  await web.close();
  await h.close();
});

async function mintAnon(originBase: string) {
  const res = await fetch(originBase + "/api/setup", {
    headers: { origin: "http://127.0.0.1:8720" },
  });
  const json = (await res.json()) as {
    anonSign?: { anonKeyId: string; signKey: string; expiresAt: number };
  };
  if (!json.anonSign) {
    throw new Error("无法获取匿名签名密钥");
  }

  return json.anonSign;
}

function send(path: string, init: RequestInit & { cookie?: string } = {}) {
  const { cookie, headers, ...rest } = init;
  return fetch(base + path, {
    ...rest,
    headers: { origin: "http://127.0.0.1:8720", ...(cookie ? { cookie } : {}), ...headers },
  });
}

describe("Web 同源反代", () => {
  it("透传会话 Cookie、缓存头与 ETag 条件请求，并加安全响应头", async () => {
    const anon = await mintAnon(base);
    const body = JSON.stringify({ username: "admin", password: adminPassword });
    const login = await send("/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...buildSignHeaders({
          method: "POST",
          url: "/api/auth/login",
          bodyText: body,
          signKeyBase64Url: anon.signKey,
          anonKeyId: anon.anonKeyId,
          nowMs: h.clock.now,
        }),
      },
      body,
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.getSetCookie()[0]!.split(";")[0]!;
    expect(login.headers.get("x-content-type-options")).toBe("nosniff");

    const sessionRes = await send("/api/auth/session", { cookie });
    const sessionJson = (await sessionRes.json()) as { signKey?: string };
    if (!sessionJson.signKey) {
      throw new Error("登录后缺少会话签名密钥");
    }

    const createBody = JSON.stringify({ name: "iPhone" });
    const issued = (await (
      await send("/api/feed-tokens", {
        method: "POST",
        cookie,
        headers: {
          "content-type": "application/json",
          ...buildSignHeaders({
            method: "POST",
            url: "/api/feed-tokens",
            bodyText: createBody,
            signKeyBase64Url: sessionJson.signKey,
            nowMs: h.clock.now,
          }),
        },
        body: createBody,
      })
    ).json()) as { feed: FeedToken };
    const path = new URL(issued.feed.url!).pathname;

    const feed = await fetch(base + path);
    expect(feed.status).toBe(200);
    expect(feed.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(feed.headers.get("cache-control")).toBe("private, no-cache");
    const etag = feed.headers.get("etag")!;
    expect((await fetch(base + path, { headers: { "if-none-match": etag } })).status).toBe(304);

    const log = lines.join("\n");
    expect(log).not.toContain(path.slice("/api/feeds/".length, -".ics".length));
    expect(log).not.toContain(adminPassword);
    expect(log).not.toContain("BEGIN:VCALENDAR");
  });

  it("客户端伪造的 X-Forwarded-For 被覆盖，不能绕过登录限流", async () => {
    const limited = await harness({ NODE_ENV: "development", LOGIN_RATE_LIMIT: "2" });
    await limited.app.listen({ host: "127.0.0.1", port: 0 });
    const address = limited.app.server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const proxy = await startWeb(`http://127.0.0.1:${port}`, 0, true, { host: "127.0.0.1" });
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        const anon = await mintAnon(`http://127.0.0.1:${proxy.port}`);
        const body = JSON.stringify({ username: "admin", password: "wrong-password" });
        const res = await fetch(`http://127.0.0.1:${proxy.port}/api/auth/login`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://127.0.0.1:8720",
            "x-forwarded-for": `10.0.0.${i}`,
            ...buildSignHeaders({
              method: "POST",
              url: "/api/auth/login",
              bodyText: body,
              signKeyBase64Url: anon.signKey,
              anonKeyId: anon.anonKeyId,
              nowMs: limited.clock.now,
            }),
          },
          body,
        });
        statuses.push(res.status);
      }

      expect(statuses).toEqual([401, 401, 429]);
    } finally {
      await proxy.close();
      await limited.close();
    }
  });

  it("API 不可达时返回 JSON 502 而不是挂起", async () => {
    const orphan = await startWeb("http://127.0.0.1:9", 0, true, { host: "127.0.0.1" });
    try {
      const res = await fetch(`http://127.0.0.1:${orphan.port}/api/auth/session`);
      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({ code: "INTERNAL_ERROR" });
    } finally {
      await orphan.close();
    }
  });
});
