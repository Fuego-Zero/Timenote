import { afterEach, beforeEach, expect, it } from "vitest";

import type { FeedToken, PageResult } from "../../packages/contracts/src/index.js";
import { harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

it("lastFetchedAt：拉取后有值，1 小时内重复拉取不写库，304 也计入（任务 7）", async () => {
  const b = h.browser();
  await b.login();
  const issued = await b.request<{ feed: FeedToken }>("POST", "/api/feed-tokens", { name: "手机" });
  expect(issued.json.feed.lastFetchedAt).toBeNull();
  const path = new URL(issued.json.feed.url!).pathname;
  const ownerId = h.repo.users.getUserByUsername("admin")!.id;
  const stored = () => h.repo.feedTokens.getFeedToken(ownerId, issued.json.feed.id)!;

  const first = await h.app.inject({ method: "GET", url: path });
  expect(first.statusCode).toBe(200);
  const firstAt = h.clock.now;
  expect(stored().lastFetchedAt).toBe(firstAt);

  h.clock.now += 59 * 60 * 1000;
  await h.app.inject({ method: "GET", url: path });
  expect(stored().lastFetchedAt).toBe(firstAt);

  h.clock.now += 2 * 60 * 1000;
  const etag = String(first.headers.etag);
  const notModified = await h.app.inject({ method: "GET", url: path, headers: { "if-none-match": etag } });
  expect(notModified.statusCode).toBe(304);
  expect(stored().lastFetchedAt).toBe(h.clock.now);

  const listed = await b.request<PageResult<FeedToken>>("GET", "/api/feed-tokens");
  expect(listed.json.items[0].lastFetchedAt).toBe(h.clock.now);
});
