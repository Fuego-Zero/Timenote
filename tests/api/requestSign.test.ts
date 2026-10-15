import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { requestSignWindowSeconds } from "../../packages/contracts/src/index.js";
import { buildSignHeaders } from "../../packages/runtime/src/index.js";
import { adminPassword, harness, type Harness, webOrigin } from "../helpers.js";

describe("请求完整性 SIGN", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await harness();
  });
  afterEach(async () => {
    await h.close();
  });

  it("登录与后续读写强制 SIGN；缺签名返回 SIGN_INVALID", async () => {
    const raw = await h.app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin: webOrigin, "content-type": "application/json" },
      payload: JSON.stringify({ username: "admin", password: adminPassword }),
    });
    expect(raw.statusCode).toBe(403);
    expect(raw.json()).toMatchObject({ code: "SIGN_INVALID", requestId: expect.any(String) });

    const b = h.browser();
    const login = await b.login();
    expect(login.status).toBe(200);
    expect((login.json as { signKey?: string }).signKey).toMatch(/^[A-Za-z0-9_-]+$/);
    expect((await b.request("GET", "/api/events")).status).toBe(200);

    const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
    const unsigned = await h.app.inject({
      method: "GET",
      url: "/api/events",
      headers: { origin: webOrigin, cookie },
    });
    expect(unsigned.statusCode).toBe(403);
    expect(unsigned.json()).toMatchObject({ code: "SIGN_INVALID" });
  });

  it("过期时间窗返回 SIGN_EXPIRED；重放 nonce 返回 SIGN_REPLAY", async () => {
    const b = h.browser();
    const login = await b.login();
    const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
    const signKey = (login.json as { signKey: string }).signKey;

    const expiredHeaders = buildSignHeaders({
      method: "GET",
      url: "/api/events",
      signKeyBase64Url: signKey,
      nowMs: h.clock.now - (requestSignWindowSeconds + 5) * 1000,
    });
    const expired = await h.app.inject({
      method: "GET",
      url: "/api/events",
      headers: { origin: webOrigin, cookie, ...expiredHeaders },
    });
    expect(expired.statusCode).toBe(403);
    expect(expired.json()).toMatchObject({ code: "SIGN_EXPIRED", requestId: expect.any(String) });

    const nonce = "replay-nonce-test-001234567890ab";
    const firstHeaders = buildSignHeaders({
      method: "GET",
      url: "/api/events",
      signKeyBase64Url: signKey,
      nowMs: h.clock.now,
      nonce,
    });
    expect(
      (
        await h.app.inject({
          method: "GET",
          url: "/api/events",
          headers: { origin: webOrigin, cookie, ...firstHeaders },
        })
      ).statusCode
    ).toBe(200);

    const replayHeaders = buildSignHeaders({
      method: "GET",
      url: "/api/events",
      signKeyBase64Url: signKey,
      nowMs: h.clock.now,
      nonce,
    });
    const replay = await h.app.inject({
      method: "GET",
      url: "/api/events",
      headers: { origin: webOrigin, cookie, ...replayHeaders },
    });
    expect(replay.statusCode).toBe(403);
    expect(replay.json()).toMatchObject({ code: "SIGN_REPLAY", requestId: expect.any(String) });
  });

  it("health 与 session/setup GET 不要求 SIGN", async () => {
    expect((await h.app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect(
      (await h.app.inject({ method: "GET", url: "/api/auth/session", headers: { origin: webOrigin } })).statusCode
    ).toBe(200);
    expect((await h.app.inject({ method: "GET", url: "/api/setup", headers: { origin: webOrigin } })).statusCode).toBe(
      200
    );
  });

  it("setup/admin 必须带匿名 SIGN", async () => {
    const empty = await harness({}, { seedAdmin: false });
    try {
      const unsigned = await empty.app.inject({
        method: "POST",
        url: "/api/setup/admin",
        headers: { origin: webOrigin, "content-type": "application/json" },
        payload: JSON.stringify({ username: "owner", password: "owner-password-1" }),
      });
      expect(unsigned.statusCode).toBe(403);
      expect(unsigned.json()).toMatchObject({ code: "SIGN_INVALID" });

      const created = await empty.browser().request("POST", "/api/setup/admin", {
        username: "owner",
        password: "owner-password-1",
      });
      expect(created.status).toBe(200);
      expect((created.json as { signKey?: string }).signKey).toBeTruthy();
    } finally {
      await empty.close();
    }
  });

  it("register 必须带匿名 SIGN", async () => {
    const on = await harness({ PUBLIC_REGISTER_ENABLED: "true" });
    try {
      const unsigned = await on.app.inject({
        method: "POST",
        url: "/api/auth/register",
        headers: { origin: webOrigin, "content-type": "application/json" },
        payload: JSON.stringify({ username: "signeduser", password: "signed-password" }),
      });
      expect(unsigned.statusCode).toBe(403);
      expect(unsigned.json()).toMatchObject({ code: "SIGN_INVALID" });

      const ok = await on.browser().request("POST", "/api/auth/register", {
        username: "signeduser",
        password: "signed-password",
      });
      expect(ok.status).toBe(200);
      expect(ok.json).toEqual({ success: true });
    } finally {
      await on.close();
    }
  });
});
