import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { FeedToken } from "../../packages/contracts/src/index.js";
import { calendarEvent } from "../fixtures.js";
import { harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function seedEvents(ownerId: string, count: number, from = 1) {
  return Array.from({ length: count }, (_value, index) => {
    const event = calendarEvent({ id: uuid(from + index), ownerId, name: `事件 ${from + index}` });
    h.repo.events.putEvent(event);
    return event.id;
  });
}

describe("订阅保存时严格校验 eventIds（任务 4）", () => {
  it("未登录 401", async () => {
    const anonymous = h.browser();
    const created = await anonymous.request("POST", "/api/feed-tokens", {
      name: "x",
      eventScope: "selected",
      eventIds: [],
    });
    expect(created.status).toBe(401);
    const patched = await anonymous.request("PATCH", `/api/feed-tokens/${uuid(1)}`, { eventIds: [] });
    expect(patched.status).toBe(401);
  });

  it("保存 150 个事件的订阅成功；含 1 个已删除 id 或他人事件 id 返回 400", async () => {
    const b = h.browser();
    await b.login();
    const ownerId = h.repo.users.getUserByUsername("admin")!.id;
    const ids = seedEvents(ownerId, 150);

    const created = await b.request<{ feed: FeedToken }>("POST", "/api/feed-tokens", {
      name: "全部手选",
      eventScope: "selected",
      eventIds: ids,
    });
    expect(created.status).toBe(201);
    expect(created.json.feed.eventIds).toEqual(ids);

    const [deleted] = seedEvents(ownerId, 1, 500);
    h.repo.events.removeEvent(ownerId, deleted);
    const withDeleted = await b.request("POST", "/api/feed-tokens", {
      name: "含已删除",
      eventScope: "selected",
      eventIds: [...ids, deleted],
    });
    expect(withDeleted.status).toBe(400);
    expect(withDeleted.json).toMatchObject({ code: "INVALID_INPUT", detail: "events_deleted" });

    const patched = await b.request("PATCH", `/api/feed-tokens/${created.json.feed.id}`, {
      eventIds: [ids[0], deleted],
    });
    expect(patched.status).toBe(400);
    expect(patched.json).toMatchObject({ detail: "events_deleted" });

    await b.request("POST", "/api/admin/users", {
      username: "bob",
      displayName: "Bob",
      password: "bob-password-1",
      role: "user",
    });
    const bobId = h.repo.users.getUserByUsername("bob")!.id;
    const [foreign] = seedEvents(bobId, 1, 900);
    const withForeign = await b.request("POST", "/api/feed-tokens", {
      name: "含他人",
      eventScope: "selected",
      eventIds: [ids[0], foreign],
    });
    expect(withForeign.status).toBe(400);
    expect(withForeign.json).toMatchObject({ code: "INVALID_INPUT" });
  });
});
