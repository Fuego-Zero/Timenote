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
