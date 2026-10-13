import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PageResult, PublicUser } from "../../packages/contracts/src/index.js";
import { harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

type Page = PageResult<PublicUser>;

describe("GET /api/admin/users 分页契约（任务 13）", () => {
  it("按创建时间倒序分页，用户名或显示名称按字面子串搜索", async () => {
    const admin = h.browser();
    await admin.login();
    for (const [username, displayName] of [
      ["alice", "Alice"],
      ["bob", "100%_Bob"],
      ["carol", "财务"],
    ]) {
      h.clock.now += 1000;
      // eslint-disable-next-line no-await-in-loop -- 依次创建，得到确定的创建时间顺序
      await admin.request("POST", "/api/admin/users", {
        username,
        displayName,
        password: `${username}-password`,
        role: "user",
      });
    }

    const all = await admin.request<Page>("GET", "/api/admin/users");
    expect(all.json).toMatchObject({ total: 4, page: 1, pageSize: 20 });
    expect(all.json.items.map(user => user.username)).toEqual(["carol", "bob", "alice", "admin"]);
    expect(all.json.items[0]).not.toHaveProperty("passwordHash");

    const second = await admin.request<Page>("GET", "/api/admin/users?page=2&pageSize=3");
    expect(second.json.items.map(user => user.username)).toEqual(["admin"]);
    const literal = await admin.request<Page>("GET", "/api/admin/users?q=%25_");
    expect(literal.json.items.map(user => user.username)).toEqual(["bob"]);
    const byDisplayName = await admin.request<Page>("GET", "/api/admin/users?q=财");
    expect(byDisplayName.json.items.map(user => user.username)).toEqual(["carol"]);
    const byUsername = await admin.request<Page>("GET", "/api/admin/users?q=AL");
    expect(byUsername.json.items.map(user => user.username)).toEqual(["alice"]);
  });

  it("非法参数返回 400", async () => {
    const admin = h.browser();
    await admin.login();
    expect((await admin.request("GET", "/api/admin/users?page=0")).status).toBe(400);
    expect((await admin.request("GET", "/api/admin/users?pageSize=101")).status).toBe(400);
  });
});
