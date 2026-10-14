import { afterEach, beforeEach, expect, it } from "vitest";

import type { FeedToken, PageResult } from "../../packages/contracts/src/index.js";
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

it("订阅列表按 eventIds 顺序返回所选事件名称；all 时为空数组", async () => {
  const b = h.browser();
  await b.login();
  const ownerId = h.repo.users.getUserByUsername("admin")!.id;
  for (const n of [1, 2]) {
    h.repo.events.putEvent(calendarEvent({ id: uuid(n), ownerId, name: `事件 ${n}` }));
  }

  const selected = await b.request<{ feed: FeedToken }>("POST", "/api/feed-tokens", {
    name: "手选",
    eventScope: "selected",
    eventIds: [uuid(2), uuid(1)],
  });
  expect(selected.json.feed.events).toEqual([
    { id: uuid(2), name: "事件 2" },
    { id: uuid(1), name: "事件 1" },
  ]);
  await b.request("POST", "/api/feed-tokens", { name: "全部" });

  const list = await b.request<PageResult<FeedToken>>("GET", "/api/feed-tokens");
  expect(list.json.items.find(feed => feed.name === "手选")?.events.map(event => event.name)).toEqual([
    "事件 2",
    "事件 1",
  ]);
  expect(list.json.items.find(feed => feed.name === "全部")?.events).toEqual([]);
});

it("订阅混入他人事件 id 时，响应不包含他人事件名称", async () => {
  const b = h.browser();
  await b.login();
  const admin = h.repo.users.getUserByUsername("admin")!;
  const otherId = uuid(900);
  h.repo.users.putUser({ ...admin, id: otherId, username: "bob" });
  h.repo.events.putEvent(calendarEvent({ id: uuid(1), ownerId: admin.id, name: "我的事件" }));
  h.repo.events.putEvent(calendarEvent({ id: uuid(2), ownerId: otherId, name: "他人秘密" }));

  const created = await b.request<{ feed: FeedToken }>("POST", "/api/feed-tokens", {
    name: "手选",
    eventScope: "selected",
    eventIds: [uuid(1)],
  });
  const stored = h.repo.feedTokens.getFeedToken(admin.id, created.json.feed.id)!;
  h.repo.feedTokens.putFeedToken({ ...stored, eventIds: [uuid(1), uuid(2)] });

  const list = await b.request<PageResult<FeedToken>>("GET", "/api/feed-tokens");
  expect(list.json.items[0]?.events).toEqual([{ id: uuid(1), name: "我的事件" }]);
  expect(JSON.stringify(list.json)).not.toContain("他人秘密");
});

it("已删除的事件不出现在 events 中", async () => {
  const b = h.browser();
  await b.login();
  const ownerId = h.repo.users.getUserByUsername("admin")!.id;
  for (const n of [1, 2]) {
    h.repo.events.putEvent(calendarEvent({ id: uuid(n), ownerId, name: `事件 ${n}` }));
  }

  await b.request("POST", "/api/feed-tokens", { name: "手选", eventScope: "selected", eventIds: [uuid(1), uuid(2)] });
  h.repo.events.removeEvent(ownerId, uuid(2));

  const list = await b.request<PageResult<FeedToken>>("GET", "/api/feed-tokens");
  expect(list.json.items[0]?.events).toEqual([{ id: uuid(1), name: "事件 1" }]);
});
