import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PublicUser } from "../../packages/contracts/src/index.js";
import { isStrongAdminPassword } from "../../packages/runtime/src/passwordPolicy.js";
import { buildSignHeaders } from "../../packages/runtime/src/index.js";
import { harness, type Harness, webOrigin } from "../helpers.js";

async function signedSetupAdmin(app: Harness["app"], origin: string, body: Record<string, string>, nowMs: number) {
  const anonRes = await app.inject({ method: "GET", url: "/api/setup", headers: { origin } });
  const anonSign = (anonRes.json() as { anonSign: { anonKeyId: string; signKey: string } }).anonSign;
  const bodyText = JSON.stringify(body);
  const signHeaders = buildSignHeaders({
    method: "POST",
    url: "/api/setup/admin",
    bodyText,
    signKeyBase64Url: anonSign.signKey,
    anonKeyId: anonSign.anonKeyId,
    nowMs,
  });
  return app.inject({
    method: "POST",
    url: "/api/setup/admin",
    headers: { origin, "content-type": "application/json", ...signHeaders },
    payload: bodyText,
  });
}

describe("password policy", () => {
  it("rejects short, single-class, and blacklisted admin passwords", () => {
    expect(isStrongAdminPassword("short")).toBe(false);
    expect(isStrongAdminPassword("aaaaaaaaaaaaaaaa")).toBe(false);
    expect(isStrongAdminPassword("change-me-to-a-long-random-password")).toBe(false);
    expect(isStrongAdminPassword("GoodAdminPass1!xx")).toBe(true);
  });
});

describe("首次引导 setup", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await harness({}, { seedAdmin: false });
  });
  afterEach(async () => {
    await h.close();
  });

  it("空库时不种子；setup.needed 为 true", async () => {
    expect(h.repo.users.listUsers()).toEqual([]);
    const status = await h.browser().request<{ needed: boolean }>("GET", "/api/setup");
    expect(status.status).toBe(200);
    expect(status.json).toMatchObject({ needed: true });
    expect((await h.browser().request("GET", "/api/auth/session")).json).toMatchObject({ user: null });
  });

  it("空库可创建首个 admin 并建立会话 Cookie；再次创建被拒绝", async () => {
    const b = h.browser();
    const created = await b.request<{ user: PublicUser }>("POST", "/api/setup/admin", {
      username: "owner",
      password: "owner-password-1",
      displayName: "主人",
    });
    expect(created.status).toBe(200);
    expect(created.json.user).toMatchObject({ username: "owner", role: "admin" });
    expect(String(created.headers["set-cookie"])).toMatch(/timenote\.session=/);
    expect((await b.request("GET", "/api/events")).status).toBe(200);
    expect((await b.request("GET", "/api/setup")).json).toMatchObject({ needed: false });

    const again = await h.browser().request("POST", "/api/setup/admin", {
      username: "other",
      password: "other-password-1",
    });
    expect(again.status).toBe(403);
  });

  it("写请求仍校验 Origin；无 Origin 拒绝", async () => {
    const noOrigin = await h.app.inject({
      method: "POST",
      url: "/api/setup/admin",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ username: "owner", password: "owner-password-1" }),
    });
    expect(noOrigin.statusCode).toBe(403);

    const evil = await h.app.inject({
      method: "POST",
      url: "/api/setup/admin",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      payload: JSON.stringify({ username: "owner", password: "owner-password-1" }),
    });
    expect(evil.statusCode).toBe(403);
  });

  it("production 拒绝弱密码；development 无 admin 时 bypass 不注入", async () => {
    const weak = await signedSetupAdmin(
      h.app,
      webOrigin,
      { username: "owner", password: "owner-password-1" },
      h.clock.now
    );
    // harness 默认 NODE_ENV=test，弱密码规则只在 production 强制；此处先确认 test 可创建
    expect(weak.statusCode).toBe(200);

    const prod = await harness(
      {
        NODE_ENV: "production",
        WEB_ORIGIN: "https://cal.example.com",
        SIGN_MASTER_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        COOKIE_SECURE: "true",
      },
      { seedAdmin: false }
    );
    try {
      const res = await signedSetupAdmin(
        prod.app,
        "https://cal.example.com",
        { username: "owner", password: "passwordpassword" },
        prod.clock.now
      );
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: "INVALID_INPUT", fields: { password: expect.any(String) } });

      const ok = await signedSetupAdmin(
        prod.app,
        "https://cal.example.com",
        { username: "owner", password: "GoodAdminPass1!xxxx" },
        prod.clock.now
      );
      expect(ok.statusCode).toBe(200);
    } finally {
      await prod.close();
    }

    const emptyDev = await harness({ NODE_ENV: "development" }, { seedAdmin: false });
    try {
      expect(emptyDev.config.devAuthBypass).toBe(true);
      expect((await emptyDev.browser().request("GET", "/api/auth/session")).json).toMatchObject({ user: null });
      expect((await emptyDev.browser().request("GET", "/api/setup")).json).toMatchObject({ needed: true });
    } finally {
      await emptyDev.close();
    }
  });
});
