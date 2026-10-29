import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { encodeSolvedAltcha } from "../../apps/api/src/registerChallenge.js";
import type { PublicUser } from "../../packages/contracts/src/index.js";
import { storedUserSchema } from "../../packages/runtime/src/entities.js";
import { adminPassword, harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

async function createUser(admin: ReturnType<Harness["browser"]>, username: string, role: "admin" | "user" = "user") {
  const res = await admin.request<{ user: PublicUser }>("POST", "/api/admin/users", {
    username,
    displayName: username,
    password: `${username}-password`,
    role,
  });
  expect(res.status).toBe(201);
  return res.json.user;
}

describe("登录与会话", () => {
  it("账号不存在、停用与密码错误返回同一提示；会话 Cookie 为 HttpOnly + SameSite=Lax", async () => {
    const b = h.browser();
    const wrong = await b.request("POST", "/api/auth/login", { username: "admin", password: "wrong-password" });
    const missing = await b.request("POST", "/api/auth/login", { username: "nobody", password: "wrong-password" });
    expect([wrong.status, missing.status]).toEqual([401, 401]);
    expect(wrong.json).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(missing.json).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(missing.json).not.toHaveProperty("message");
    expect(wrong.json).not.toHaveProperty("message");

    const ok = await b.login();
    const cookie = String(ok.headers["set-cookie"]);
    expect(cookie).toMatch(/^timenote\.session=[\w-]{43};/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(h.repo.users.listUsers()[0]).not.toHaveProperty("password");
  });

  it("写请求必须同源，跨站请求即使带有效 Cookie 也被拒绝", async () => {
    const b = h.browser();
    await b.login();
    const evil = await b.request("POST", "/api/feed-tokens", { name: "x" }, { origin: "https://evil.example" });
    expect(evil.status).toBe(403);
    const crossSite = await b.request("GET", "/api/events", undefined, { "sec-fetch-site": "cross-site" });
    expect(crossSite.status).toBe(403);
    const noOrigin = await h.app.inject({ method: "POST", url: "/api/auth/logout" });
    expect(noOrigin.statusCode).toBe(403);
  });

  it("退出登录后会话失效；改密后其他会话失效，当前会话保留", async () => {
    const phone = h.browser();
    const laptop = h.browser();
    await phone.login();
    await laptop.login();
    const changed = await laptop.request("POST", "/api/auth/password", {
      currentPassword: adminPassword,
      newPassword: "new-admin-password",
    });
    expect(changed.status).toBe(200);
    expect((await phone.request("GET", "/api/events")).status).toBe(401);
    expect((await laptop.request("GET", "/api/events")).status).toBe(200);

    await laptop.request("POST", "/api/auth/logout");
    expect((await laptop.request("GET", "/api/events")).status).toBe(401);
  });

  it("改密时当前密码错误定位到字段", async () => {
    const b = h.browser();
    await b.login();
    const res = await b.request("POST", "/api/auth/password", {
      currentPassword: "not-the-password",
      newPassword: "new-admin-password",
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ fields: { currentPassword: { detail: "current_password" } } });
  });
});

describe("管理员后台权限边界", () => {
  it("普通用户不能访问任何管理接口", async () => {
    const admin = h.browser();
    await admin.login();
    const alice = await createUser(admin, "alice");
    const user = h.browser();
    await user.login("alice", "alice-password");
    const attempts = [
      await user.request("GET", "/api/admin/users"),
      await user.request("POST", "/api/admin/users", {
        username: "mallory",
        displayName: "m",
        password: "mallory-password",
        role: "admin",
      }),
      await user.request("PATCH", `/api/admin/users/${alice.id}`, { role: "admin" }),
      await user.request("POST", `/api/admin/users/${alice.id}/password`, { password: "hijacked-pass" }),
      await user.request("DELETE", `/api/admin/users/${alice.id}`),
    ];
    expect(attempts.map(r => r.status)).toEqual([403, 403, 403, 403, 403]);
    expect(h.repo.users.getUser(alice.id)?.role).toBe("user");
  });

  it("未登录访问管理接口返回 401", async () => {
    expect((await h.browser().request("GET", "/api/admin/users")).status).toBe(401);
  });

  it("用户名重复返回字段错误", async () => {
    const admin = h.browser();
    await admin.login();
    await createUser(admin, "alice");
    const dup = await admin.request("POST", "/api/admin/users", {
      username: "Alice",
      displayName: "A",
      password: "another-password",
      role: "user",
    });
    expect(dup.status).toBe(409);
    expect(dup.json).toMatchObject({ code: "USERNAME_TAKEN", fields: { username: { detail: "username_taken" } } });
  });

  it("停用账号立即踢出其会话且无法再登录；重置密码同样踢出", async () => {
    const admin = h.browser();
    await admin.login();
    const alice = await createUser(admin, "alice");
    const session = h.browser();
    await session.login("alice", "alice-password");

    await admin.request("POST", `/api/admin/users/${alice.id}/password`, { password: "reset-password-1" });
    expect((await session.request("GET", "/api/events")).status).toBe(401);
    await session.login("alice", "reset-password-1");

    expect((await admin.request("PATCH", `/api/admin/users/${alice.id}`, { disabled: true })).status).toBe(200);
    expect((await session.request("GET", "/api/events")).status).toBe(401);
    const relogin = await session.request("POST", "/api/auth/login", {
      username: "alice",
      password: "reset-password-1",
    });
    expect(relogin.status).toBe(401);
  });

  it("不能停用、降级或删除自己，也不能移除最后一个管理员", async () => {
    const admin = h.browser();
    const me = (await admin.login()).json as { user: PublicUser };
    const id = me.user.id;
    expect((await admin.request("PATCH", `/api/admin/users/${id}`, { disabled: true })).status).toBe(403);
    expect((await admin.request("PATCH", `/api/admin/users/${id}`, { role: "user" })).status).toBe(403);
    expect((await admin.request("DELETE", `/api/admin/users/${id}`)).status).toBe(403);

    await createUser(admin, "boss", "admin");
    const other = h.browser();
    await other.login("boss", "boss-password");
    expect((await other.request("DELETE", `/api/admin/users/${id}`)).status).toBe(200);
    expect(h.repo.users.listUsers().map(u => u.username)).toEqual(["boss"]);
  });

  it("任何变更都不能让系统失去最后一个启用的管理员", async () => {
    const { deleteUser, updateUser } = await import("../../apps/api/src/accounts.js");
    const [admin] = h.repo.users.listUsers();
    // 通过 HTTP 时操作者本身就是另一位管理员，这里直接调用领域函数锁定兜底规则。
    const ghost = { ...admin!, id: "ghost-admin" };
    expect(() => updateUser(h.repo, ghost, admin!.id, { disabled: true }, Date.now())).toThrow(
      expect.objectContaining({ code: "LAST_ADMIN" })
    );
    expect(() => deleteUser(h.repo, ghost, admin!.id)).toThrow(expect.objectContaining({ code: "LAST_ADMIN" }));
    expect(h.repo.users.getUser(admin!.id)?.disabled).toBe(false);
  });

  it("删除账号同时删除其事件与订阅地址", async () => {
    const admin = h.browser();
    await admin.login();
    const alice = await createUser(admin, "alice");
    const session = h.browser();
    await session.login("alice", "alice-password");
    const issued = await session.request<{ feed: { url: string } }>("POST", "/api/feed-tokens", { name: "iPhone" });
    const feedPath = new URL(issued.json.feed.url).pathname;
    expect((await session.request("GET", feedPath)).status).toBe(200);

    expect((await admin.request("DELETE", `/api/admin/users/${alice.id}`)).status).toBe(200);
    expect((await h.browser().request("GET", feedPath)).status).toBe(404);
    expect(h.repo.feedTokens.listFeedTokens(alice.id)).toEqual([]);
  });
});

describe("development auth bypass", () => {
  it("development injects earliest enabled admin without cookie; test/prod stay locked", async () => {
    const dev = await harness({ NODE_ENV: "development" });
    try {
      expect(dev.config.devAuthBypass).toBe(true);
      const session = await dev.browser().request<{ user: PublicUser | null }>("GET", "/api/auth/session");
      expect(session.status).toBe(200);
      expect(session.headers["set-cookie"]).toBeUndefined();
      expect(session.json.user).toMatchObject({ username: "admin", role: "admin" });
      const events = await dev.browser().request("GET", "/api/events");
      expect(events.status).toBe(200);
      expect(events.headers["set-cookie"]).toBeUndefined();

      await dev.browser().request("POST", "/api/auth/logout");
      const again = await dev.browser().request<{ user: PublicUser | null }>("GET", "/api/auth/session");
      expect(again.json.user?.username).toBe("admin");
    } finally {
      await dev.close();
    }

    const off = await harness({ NODE_ENV: "development", DEV_AUTH_BYPASS: "0" });
    try {
      expect(off.config.devAuthBypass).toBe(false);
      expect((await off.browser().request("GET", "/api/events")).status).toBe(401);
      expect((await off.browser().request("GET", "/api/auth/session")).json).toMatchObject({ user: null });
    } finally {
      await off.close();
    }

    expect(h.config.devAuthBypass).toBe(false);
    expect((await h.browser().request("GET", "/api/events")).status).toBe(401);

    const prod = await harness({
      NODE_ENV: "production",
      WEB_ORIGIN: "https://cal.example.com",
      SIGN_MASTER_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      COOKIE_SECURE: "true",
    });
    try {
      expect(prod.config.devAuthBypass).toBe(false);
      const res = await prod.app.inject({
        method: "GET",
        url: "/api/events",
        headers: { origin: "https://cal.example.com" },
      });
      expect(res.statusCode).toBe(401);
    } finally {
      await prod.close();
    }
  });

  it("升任用户名更靠前的管理员后，旁路身份与 SIGN 密钥仍指向最早 admin", async () => {
    const dev = await harness({ NODE_ENV: "development" });
    try {
      const b = dev.browser();
      const before = await b.request<{ user: PublicUser | null }>("GET", "/api/auth/session");
      expect(before.json.user?.username).toBe("admin");

      // 冻结时钟下种子 admin 与新建用户 createdAt 相同；拨钟后才能体现「最早创建」稳定选取。
      dev.clock.now += 60_000;
      const created = await b.request<{ user: PublicUser }>("POST", "/api/admin/users", {
        username: "aaa",
        displayName: "A",
        password: "aaa-password-1",
        role: "user",
      });
      expect(created.status).toBe(201);
      expect((await b.request("PATCH", `/api/admin/users/${created.json.user.id}`, { role: "admin" })).status).toBe(
        200
      );

      // 若仍按 username 取「第一个」admin，此处会变成 aaa 并换 dev: 密钥 → SIGN_INVALID。
      const after = await b.request<{ user: PublicUser | null }>("GET", "/api/auth/session");
      expect(after.json.user?.username).toBe("admin");
      expect((await b.request("GET", "/api/events")).status).toBe(200);
      expect((await b.request("PATCH", `/api/admin/users/${created.json.user.id}`, { role: "user" })).status).toBe(200);
    } finally {
      await dev.close();
    }
  });
  it("no enabled admin means no bypass; health and feeds stay public", async () => {
    const dev = await harness({ NODE_ENV: "development" });
    try {
      const health = await dev.app.inject({ method: "GET", url: "/health" });
      expect(health.statusCode).toBe(200);

      const b = dev.browser();
      await b.login();
      const issued = await b.request<{ feed: { url: string } }>("POST", "/api/feed-tokens", { name: "phone" });
      expect(issued.status).toBe(201);
      const feedPath = new URL(issued.json.feed.url!).pathname;
      const feed = await dev.app.inject({ method: "GET", url: feedPath });
      expect(feed.statusCode).toBe(200);
      expect(feed.headers["set-cookie"]).toBeUndefined();

      const admin = dev.repo.users.listUsers().find(u => u.role === "admin")!;
      dev.repo.users.putUser({ ...admin, disabled: true });
      expect((await dev.browser().request("GET", "/api/events")).status).toBe(401);
      expect((await dev.browser().request("GET", "/api/auth/session")).json).toMatchObject({ user: null });
      // /api/feeds/* still bypasses session auth (owner disabled may 404 by existing feed rules)
      const feedAgain = await dev.app.inject({ method: "GET", url: feedPath });
      expect(feedAgain.headers["set-cookie"]).toBeUndefined();
      expect([200, 404]).toContain(feedAgain.statusCode);
    } finally {
      await dev.close();
    }
  });
});

describe("最后登录时间", () => {
  it("登录成功写入 lastLoginAt；密码错误与停用账号不写", async () => {
    const admin = h.browser();
    await admin.login();
    const alice = await createUser(admin, "alice");
    expect(alice.lastLoginAt).toBeNull();
    expect(h.repo.users.getUser(alice.id)?.lastLoginAt).toBeNull();

    const wrong = await h.browser().request("POST", "/api/auth/login", {
      username: "alice",
      password: "wrong-password",
    });
    expect(wrong.status).toBe(401);
    expect(h.repo.users.getUser(alice.id)?.lastLoginAt).toBeNull();

    await admin.request("PATCH", `/api/admin/users/${alice.id}`, { disabled: true });
    const disabledLogin = await h.browser().request("POST", "/api/auth/login", {
      username: "alice",
      password: "alice-password",
    });
    expect(disabledLogin.status).toBe(401);
    expect(h.repo.users.getUser(alice.id)?.lastLoginAt).toBeNull();

    await admin.request("PATCH", `/api/admin/users/${alice.id}`, { disabled: false });
    const loginAt = h.clock.now + 60_000;
    h.clock.now = loginAt;
    const session = h.browser();
    const ok = await session.login("alice", "alice-password");
    expect(ok.status).toBe(200);
    expect((ok.json as { user: PublicUser }).user.lastLoginAt).toBe(loginAt);
    expect(h.repo.users.getUser(alice.id)?.lastLoginAt).toBe(loginAt);

    const list = await admin.request<{ items: PublicUser[] }>("GET", "/api/admin/users");
    expect(list.status).toBe(200);
    const row = list.json.items.find(u => u.id === alice.id);
    expect(row?.lastLoginAt).toBe(loginAt);
  });

  it("authenticate 会话续期不推进 lastLoginAt", async () => {
    const b = h.browser();
    const loginAt = h.clock.now;
    await b.login();
    const admin = h.repo.users.listUsers().find(u => u.username === "admin")!;
    expect(admin.lastLoginAt).toBe(loginAt);

    h.clock.now = loginAt + 11 * 60 * 1000;
    expect((await b.request("GET", "/api/events")).status).toBe(200);
    expect(h.repo.users.getUser(admin.id)?.lastLoginAt).toBe(loginAt);
  });

  it("存量 payload 缺少 lastLoginAt 时解析为 null", () => {
    const parsed = storedUserSchema.parse({
      id: "legacy-id",
      username: "legacy",
      displayName: "旧账号",
      role: "user",
      disabled: false,
      timeZone: "Asia/Shanghai",
      createdAt: 1,
      updatedAt: 1,
      passwordHash:
        "scrypt$32768$8$1$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(parsed.lastLoginAt).toBeNull();
  });
});

describe("公开注册", () => {
  it("默认关闭：注册返回 FORBIDDEN；开启后创建停用账号且不建会话", async () => {
    const off = await h.browser().request("POST", "/api/auth/register", {
      username: "newbie",
      password: "newbie-password",
    });
    expect(off.status).toBe(403);
    expect(off.json).toMatchObject({ code: "FORBIDDEN" });
    expect(h.repo.users.getUserByUsername("newbie")).toBeUndefined();

    const on = await harness({ PUBLIC_REGISTER_ENABLED: "true" });
    try {
      const session = await on.browser().request<{
        publicRegisterEnabled?: boolean;
        registerDefaultDisabled?: boolean;
      }>("GET", "/api/auth/session");
      expect(session.json.publicRegisterEnabled).toBe(true);
      expect(session.json.registerDefaultDisabled).toBe(true);

      const registered = await on.browser().request("POST", "/api/auth/register", {
        username: "newbie",
        password: "newbie-password",
        displayName: "新人",
      });
      expect(registered.status).toBe(200);
      expect(registered.json).toEqual({ success: true });
      expect(registered.headers["set-cookie"]).toBeUndefined();

      const stored = on.repo.users.getUserByUsername("newbie");
      expect(stored).toMatchObject({ role: "user", disabled: true, displayName: "新人" });

      const login = await on.browser().request("POST", "/api/auth/login", {
        username: "newbie",
        password: "newbie-password",
      });
      expect(login.status).toBe(401);
      expect(login.json).toMatchObject({ code: "INVALID_CREDENTIALS" });
    } finally {
      await on.close();
    }
  });

  it("REGISTER_DEFAULT_DISABLED=false 时新账号启用且可登录，仍不建会话", async () => {
    const on = await harness({ PUBLIC_REGISTER_ENABLED: "true", REGISTER_DEFAULT_DISABLED: "false" });
    try {
      const session = await on.browser().request<{ registerDefaultDisabled?: boolean }>("GET", "/api/auth/session");
      expect(session.json.registerDefaultDisabled).toBe(false);

      const registered = await on.browser().request("POST", "/api/auth/register", {
        username: "ready",
        password: "ready-password",
      });
      expect(registered.status).toBe(200);
      expect(registered.headers["set-cookie"]).toBeUndefined();
      expect(on.repo.users.getUserByUsername("ready")).toMatchObject({ role: "user", disabled: false });

      const login = await on.browser().request("POST", "/api/auth/login", {
        username: "ready",
        password: "ready-password",
      });
      expect(login.status).toBe(200);
    } finally {
      await on.close();
    }
  });

  it("未完成 setup 时即使开关开启也拒绝注册；不替代 setup/admin", async () => {
    const empty = await harness({ PUBLIC_REGISTER_ENABLED: "true" }, { seedAdmin: false });
    try {
      const res = await empty.browser().request("POST", "/api/auth/register", {
        username: "early",
        password: "early-password",
      });
      expect(res.status).toBe(403);
      expect(empty.repo.users.listUsers()).toHaveLength(0);

      const setup = await empty.browser().request("POST", "/api/setup/admin", {
        username: "owner",
        password: "owner-password-1",
      });
      expect(setup.status).toBe(200);
    } finally {
      await empty.close();
    }
  });

  it("注册超限返回 RATE_LIMITED", async () => {
    const limited = await harness(
      {
        NODE_ENV: "development",
        DEV_AUTH_BYPASS: "0",
        PUBLIC_REGISTER_ENABLED: "true",
        REGISTER_RATE_LIMIT: "1",
      },
      { seedAdmin: false }
    );
    try {
      // 先建管理员（setup 走 loginLimit，不受 register 桶影响）
      const setup = await limited.browser().request("POST", "/api/setup/admin", {
        username: "owner",
        password: "owner-password-1",
      });
      expect(setup.status).toBe(200);
      await limited.browser().request("POST", "/api/auth/logout");

      const first = await limited.browser().request("POST", "/api/auth/register", {
        username: "rateone",
        password: "rateone-password",
      });
      expect(first.status).toBe(200);
      const second = await limited.browser().request("POST", "/api/auth/register", {
        username: "ratetwo",
        password: "ratetwo-password",
      });
      expect(second.status).toBe(429);
      expect(second.json).toMatchObject({ code: "RATE_LIMITED" });
    } finally {
      await limited.close();
    }
  });

  it("用户名占用返回 USERNAME_TAKEN；缺 SIGN 返回 SIGN_INVALID", async () => {
    const on = await harness({ PUBLIC_REGISTER_ENABLED: "true" });
    try {
      const b = on.browser();
      await b.request("POST", "/api/auth/register", {
        username: "dupuser",
        password: "dupuser-password",
      });
      const dup = await b.request("POST", "/api/auth/register", {
        username: "dupuser",
        password: "dupuser-password-2",
      });
      expect(dup.status).toBe(409);
      expect(dup.json).toMatchObject({ code: "USERNAME_TAKEN" });

      const unsigned = await on.app.inject({
        method: "POST",
        url: "/api/auth/register",
        headers: { origin: "http://127.0.0.1:8720", "content-type": "application/json" },
        payload: JSON.stringify({ username: "unsigned1", password: "unsigned-password" }),
      });
      expect(unsigned.statusCode).toBe(403);
      expect(unsigned.json()).toMatchObject({ code: "SIGN_INVALID" });
    } finally {
      await on.close();
    }
  });

  it("无效或重复使用的计算题不建账号", async () => {
    const on = await harness({ PUBLIC_REGISTER_ENABLED: "true" });
    try {
      const b = on.browser();
      const invalid = await b.request("POST", "/api/auth/register", {
        username: "nocaptcha",
        password: "nocaptcha-password",
        altcha: "not-valid",
      });
      expect(invalid.status).toBe(400);
      expect(invalid.json).toMatchObject({ code: "INVALID_INPUT", detail: "captcha_invalid" });
      expect(on.repo.users.getUserByUsername("nocaptcha")).toBeUndefined();

      const issued = await on.app.inject({ method: "GET", url: "/api/auth/register-challenge" });
      const altcha = await encodeSolvedAltcha(issued.json());
      const first = await b.request("POST", "/api/auth/register", {
        username: "once",
        password: "once-password",
        altcha,
      });
      expect(first.status).toBe(200);
      const second = await b.request("POST", "/api/auth/register", {
        username: "twice",
        password: "twice-password",
        altcha,
      });
      expect(second.status).toBe(400);
      expect(second.json).toMatchObject({ detail: "captcha_invalid" });
      expect(on.repo.users.getUserByUsername("twice")).toBeUndefined();
    } finally {
      await on.close();
    }
  });
});

describe("回声反馈", () => {
  it("未配置时会话不返回 feedback，配置后返回服务地址和项目 AK", async () => {
    const absent = await h.browser().request<{ feedback?: unknown }>("GET", "/api/auth/session");
    expect(absent.json.feedback).toBeUndefined();

    const ak = "a".repeat(43);
    const configured = await harness({
      FEEDBACK_SERVER_URL: "https://feedback.example.com",
      FEEDBACK_PROJECT_AK: ak,
    });
    try {
      const session = await configured
        .browser()
        .request<{ feedback?: { serverUrl: string; ak: string } }>("GET", "/api/auth/session");
      expect(session.status).toBe(200);
      expect(session.json.feedback).toEqual({ serverUrl: "https://feedback.example.com", ak });
    } finally {
      await configured.close();
    }
  });
});
