import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BackupFile, CalendarEvent, PageResult } from "../../packages/contracts/src/index.js";
import { eventInput } from "../fixtures.js";
import { harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

async function twoUsers() {
  const admin = h.browser();
  await admin.login();
  await admin.request("POST", "/api/admin/users", {
    username: "alice",
    displayName: "Alice",
    password: "alice-password",
    role: "user",
  });
  const alice = h.browser();
  await alice.login("alice", "alice-password");
  return { admin, alice };
}

describe("事件", () => {
  it("新建、修改、删除；修改递增 revision 且 updatedAt 单调递增", async () => {
    const b = h.browser();
    await b.login();
    const created = await b.request<{ event: CalendarEvent }>("POST", "/api/events", eventInput());
    expect(created.status).toBe(201);
    expect(created.json.event).toMatchObject({ revision: 0, name: "小明" });

    const updated = await b.request<{ event: CalendarEvent }>(
      "PUT",
      `/api/events/${created.json.event.id}`,
      eventInput({ name: "小红" })
    );
    expect(updated.json.event).toMatchObject({ id: created.json.event.id, revision: 1, name: "小红" });
    expect(updated.json.event.updatedAt).toBeGreaterThan(created.json.event.updatedAt);
    expect(updated.json.event.createdAt).toBe(created.json.event.createdAt);

    expect((await b.request("DELETE", `/api/events/${created.json.event.id}`)).status).toBe(200);
    expect((await b.request("DELETE", `/api/events/${created.json.event.id}`)).status).toBe(404);
  });

  it("无效输入返回字段级中文错误，农历无效日期由日历库校验", async () => {
    const b = h.browser();
    await b.login();
    const bad = await b.request(
      "POST",
      "/api/events",
      eventInput({ titleTemplate: "{{name}} {{age}}", durationDays: 0 })
    );
    expect(bad.status).toBe(400);
    expect(bad.json).toMatchObject({
      code: "INVALID_INPUT",
      fields: { titleTemplate: expect.any(String), durationDays: "最后一天不能早于开始日期" },
    });

    const lunar = await b.request(
      "POST",
      "/api/events",
      eventInput({ date: { calendar: "lunar", year: 2025, month: 2, day: 1, leapMonth: true } })
    );
    expect(lunar.status).toBe(400);
    expect(lunar.json).toMatchObject({ fields: { "date.leapMonth": "农历 2025 年没有闰2月" } });

    const range = await b.request("POST", "/api/events", eventInput({ date: { calendar: "lunar", year: 1800 } }));
    expect(range.status).toBe(400);
    expect(range.json).toMatchObject({ fields: { "date.year": expect.stringContaining("1900-2100") } });

    const plain = await b.request("POST", "/api/events", eventInput({ kind: "event", date: { year: null } }));
    expect(plain.json).toMatchObject({ fields: { "date.year": "普通事件必须填写年份" } });

    const control = await b.request("POST", "/api/events", eventInput({ titlePrefix: "\u0007" }));
    expect(control.status).toBe(400);
  });

  it("账号之间的事件与订阅完全隔离", async () => {
    const { admin, alice } = await twoUsers();
    const mine = await admin.request<{ event: CalendarEvent }>(
      "POST",
      "/api/events",
      eventInput({ name: "管理员的事" })
    );
    const id = mine.json.event.id;
    await alice.request("POST", "/api/events", eventInput({ name: "Alice 的事" }));

    const aliceList = await alice.request<PageResult<CalendarEvent>>("GET", "/api/events");
    expect(aliceList.json.items.map(e => e.name)).toEqual(["Alice 的事"]);
    expect((await alice.request("PUT", `/api/events/${id}`, eventInput({ name: "篡改" }))).status).toBe(404);
    expect((await alice.request("DELETE", `/api/events/${id}`)).status).toBe(404);

    const feed = await alice.request<{ feed: { url: string } }>("POST", "/api/feed-tokens", { name: "iPhone" });
    const body = (await h.browser().request("GET", new URL(feed.json.feed.url).pathname)).body;
    expect(body).toContain("Alice 的事");
    expect(body).not.toContain("管理员的事");

    const adminFeeds = await admin.request<{ feeds: { id: string }[] }>("GET", "/api/feed-tokens");
    expect(adminFeeds.json.feeds).toEqual([]);
    expect(h.repo.events.getEvent(mine.json.event.ownerId, id)?.name).toBe("管理员的事");
  });
});

describe("备份", () => {
  it("导出只含自己的可编辑字段，导入同 ID 更新、新 ID 新建，可在另一账号恢复", async () => {
    const { admin, alice } = await twoUsers();
    await admin.request("POST", "/api/events", eventInput({ name: "甲" }));
    await admin.request("POST", "/api/events", eventInput({ name: "乙", note: "备注" }));
    const exported = await admin.request<BackupFile>("GET", "/api/backup");
    expect(exported.headers["cache-control"]).toBe("no-store");
    expect(exported.headers["content-disposition"]).toBe('attachment; filename="timenote-backup-20261002.json"');
    expect(exported.json).toMatchObject({ format: "timenote-backup", version: 1 });
    expect(exported.json.events).toHaveLength(2);
    expect(JSON.stringify(exported.json)).not.toMatch(/ownerId|revision|passwordHash/);

    const reimport = await admin.request("POST", "/api/backup", exported.json);
    expect(reimport.json).toEqual({ created: 0, updated: 2 });

    const restored = await alice.request("POST", "/api/backup", exported.json);
    expect(restored.json).toEqual({ created: 2, updated: 0 });
    const aliceEvents = await alice.request<PageResult<CalendarEvent>>("GET", "/api/events");
    expect(aliceEvents.json.items.map(e => e.name).sort()).toEqual(["乙", "甲"]);
    const adminEvents = await admin.request<PageResult<CalendarEvent>>("GET", "/api/events");
    expect(adminEvents.json.items.map(e => e.id).sort()).not.toEqual(aliceEvents.json.items.map(e => e.id).sort());
  });

  it("格式不对的备份整体拒绝，不导入任何事件", async () => {
    const b = h.browser();
    await b.login();
    const broken = {
      format: "timenote-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      events: [
        { id: crypto.randomUUID(), event: eventInput() },
        { id: crypto.randomUUID(), event: { ...eventInput(), durationDays: -1 } },
      ],
    };
    expect((await b.request("POST", "/api/backup", broken)).status).toBe(400);
    expect((await b.request<PageResult<unknown>>("GET", "/api/events")).json.items).toEqual([]);
  });
});
