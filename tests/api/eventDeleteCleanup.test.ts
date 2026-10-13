import ICAL from "ical.js";
import { afterEach, beforeEach, expect, it } from "vitest";

import type { CalendarEvent, FeedToken } from "../../packages/contracts/src/index.js";
import { eventInput } from "../fixtures.js";
import { harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

function uids(body: string) {
  return new ICAL.Component(ICAL.parse(body) as unknown[])
    .getAllSubcomponents("vevent")
    .map(vevent => String(vevent.getFirstPropertyValue("uid")));
}

it("删除事件时同事务从本人订阅 eventIds 移除，其余顺序不变，ICS 内容不变（任务 5）", async () => {
  const b = h.browser();
  await b.login();
  const create = async (name: string) =>
    (await b.request<{ event: CalendarEvent }>("POST", "/api/events", eventInput({ name }))).json.event.id;
  const [first, second, third] = [await create("甲"), await create("乙"), await create("丙")];
  const feed = await b.request<{ feed: FeedToken }>("POST", "/api/feed-tokens", {
    name: "手选",
    eventScope: "selected",
    eventIds: [third, second, first],
  });
  const path = new URL(feed.json.feed.url!).pathname;
  const before = uids((await h.app.inject({ method: "GET", url: path })).body);

  expect((await b.request("DELETE", `/api/events/${second}`)).status).toBe(200);
  const listed = await b.request<{ feeds: FeedToken[] }>("GET", "/api/feed-tokens");
  expect(listed.json.feeds[0].eventIds).toEqual([third, first]);
  const after = uids((await h.app.inject({ method: "GET", url: path })).body);
  expect(after).toEqual(before.filter(uid => !uid.startsWith(second)));

  expect((await b.request("DELETE", `/api/events/${second}`)).status).toBe(404);
});
