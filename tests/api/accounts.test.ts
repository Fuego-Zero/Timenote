import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PublicUser } from "../../packages/contracts/src/index.js";
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
  it("首个管理员来自环境变量，重复启动不重复创建", async () => {
    const { ensureInitialAdmin } = await import("../../packages/runtime/src/index.js");
    await ensureInitialAdmin(h.repo, h.config);
    expect(h.repo.listUsers().map(u => [u.username, u.role])).toEqual([["admin", "admin"]]);
  });

  it("账号不存在、停用与密码错误返回同一提示；会话 Cookie 为 HttpOnly + SameSite=Lax", async () => {
    const b = h.browser();
    const wrong = await b.request("POST", "/api/auth/login", { username: "admin", password: "wrong-password" });
    const missing = await b.request("POST", "/api/auth/login", { username: "nobody", password: "wrong-password" });
    expect([wrong.status, missing.status]).toEqual([401, 401]);
    expect(wrong.json).toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect((missing.json as { message: string }).message).toBe((wrong.json as { message: string }).message);

    const ok = await b.login();
    const cookie = String(ok.headers["set-cookie"]);
    expect(cookie).toMatch(/^timenote\.session=[\w-]{43};/);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(h.repo.listUsers()[0]).not.toHaveProperty("password");
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
    expect(res.json).toMatchObject({ fields: { currentPassword: "当前密码不正确" } });
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
    expect(h.repo.getUser(alice.id)?.role).toBe("user");
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
    expect(dup.json).toMatchObject({ code: "USERNAME_TAKEN", fields: { username: expect.any(String) } });
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
    expect(h.repo.listUsers().map(u => u.username)).toEqual(["boss"]);
  });

  it("任何变更都不能让系统失去最后一个启用的管理员", async () => {
    const { deleteUser, updateUser } = await import("../../apps/api/src/accounts.js");
    const [admin] = h.repo.listUsers();
    // 通过 HTTP 时操作者本身就是另一位管理员，这里直接调用领域函数锁定兜底规则。
    const ghost = { ...admin!, id: "ghost-admin" };
    expect(() => updateUser(h.repo, ghost, admin!.id, { disabled: true }, Date.now())).toThrow(
      expect.objectContaining({ code: "LAST_ADMIN" })
    );
    expect(() => deleteUser(h.repo, ghost, admin!.id)).toThrow(expect.objectContaining({ code: "LAST_ADMIN" }));
    expect(h.repo.getUser(admin!.id)?.disabled).toBe(false);
  });

  it("删除账号同时删除其事件与订阅地址", async () => {
    const admin = h.browser();
    await admin.login();
    const alice = await createUser(admin, "alice");
    const session = h.browser();
    await session.login("alice", "alice-password");
    const issued = await session.request<{ url: string }>("POST", "/api/feed-tokens", { name: "iPhone" });
    const feedPath = new URL(issued.json.url).pathname;
    expect((await session.request("GET", feedPath)).status).toBe(200);

    expect((await admin.request("DELETE", `/api/admin/users/${alice.id}`)).status).toBe(200);
    expect((await h.browser().request("GET", feedPath)).status).toBe(404);
    expect(h.repo.listFeedTokens(alice.id)).toEqual([]);
  });
});
