import ICAL from "ical.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CalendarEvent, FeedToken, PageResult, PublicUser } from "../../packages/contracts/src/index.js";
import { eventInput } from "../fixtures.js";
import { harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

async function signedIn() {
  const b = h.browser();
  await b.login();
  return b;
}

async function issue(b: ReturnType<Harness["browser"]>, name = "iPhone") {
  const res = await b.request<{ feed: FeedToken }>("POST", "/api/feed-tokens", { name });
  expect(res.status).toBe(201);
  expect(res.json.feed.url).toEqual(expect.any(String));
  return { feed: res.json.feed, path: new URL(res.json.feed.url!).pathname };
}

function uids(body: string) {
  return new ICAL.Component(ICAL.parse(body))
    .getAllSubcomponents("vevent")
    .map(vevent => String(vevent.getFirstPropertyValue("uid")));
}

describe("订阅地址", () => {
  it("升级前没有保存明文的地址仍按哈希可用，列表里不再显示完整地址", async () => {
    const b = await signedIn();
    const ownerId = h.repo.users.listUsers()[0]!.id;
    const id = crypto.randomUUID();
    const tokenHash = "ab".repeat(32);
    const payload = JSON.stringify({ id, ownerId, name: "旧设备", tokenHash, createdAt: 1, rotatedAt: 1 });
    const { openDatabase } = await import("../../packages/runtime/src/sqlite.js");
    const db = openDatabase(h.config.sqlitePath);
    db.prepare("INSERT INTO feed_token (id, owner, token_hash, payload) VALUES (?, ?, ?, ?)").run(
      id,
      ownerId,
      tokenHash,
      payload
    );
    db.close();

    const list = await b.request<PageResult<FeedToken>>("GET", "/api/feed-tokens");
    expect(list.json.items).toContainEqual(expect.objectContaining({ id, url: null, webcalUrl: null }));
  });

  it("列表可以反复取回同一地址，数据库同时保存明文和哈希", async () => {
    const b = await signedIn();
    const issued = await issue(b);
    const token = /\/api\/feeds\/([\w-]{43})\.ics$/.exec(issued.feed.url!)![1]!;
    expect(issued.feed.webcalUrl).toBe(issued.feed.url!.replace("http:", "webcal:"));
    expect(issued.feed.url).toMatch(/^http:\/\/127\.0\.0\.1:8720\/api\/feeds\//);

    const list = await b.request<PageResult<FeedToken>>("GET", "/api/feed-tokens");
    expect(list.json.items).toEqual([issued.feed]);
    const stored = h.repo.feedTokens.listFeedTokens(h.repo.users.listUsers()[0]!.id);
    expect(stored).toEqual([expect.objectContaining({ token, name: "iPhone" })]);
    expect(JSON.stringify(stored)).not.toMatch(/tokenHint/);
  });

  it("订阅响应只允许私有缓存，带 ETag，条件请求返回 304", async () => {
    const b = await signedIn();
    await b.request("POST", "/api/events", eventInput());
    const { path } = await issue(b);
    const anonymous = h.browser();
    const first = await anonymous.request("GET", path);
    expect(first.status).toBe(200);
    expect(first.headers["content-type"]).toBe("text/calendar; charset=utf-8");
    expect(first.headers["cache-control"]).toBe("private, no-cache");
    expect(first.headers["set-cookie"]).toBeUndefined();
    const etag = String(first.headers.etag);
    expect(etag).toMatch(/^"[\w-]{43}"$/);

    const again = await anonymous.request("GET", path, undefined, { "if-none-match": etag });
    expect(again.status).toBe(304);
    expect(again.body).toBe("");

    const second = await anonymous.request("GET", path);
    expect(second.body).toBe(first.body);
  });

  it("事件变化后 ETag 改变，SEQUENCE 递增且 UID 不变", async () => {
    const b = await signedIn();
    const created = await b.request<{ event: CalendarEvent }>("POST", "/api/events", eventInput());
    const { path } = await issue(b);
    const before = await h.browser().request("GET", path);
    h.clock.now += 60_000;
    await b.request("PUT", `/api/events/${created.json.event.id}`, eventInput({ name: "小明同学" }));
    const after = await h.browser().request("GET", path);
    expect(after.headers.etag).not.toBe(before.headers.etag);
    expect(uids(after.body)).toEqual(uids(before.body));
    expect(after.body).toContain("SEQUENCE:1\r\n");
    expect(after.body).toContain("SUMMARY:小明同学 36 岁生日");
  });

  it("窗口按用户时区跨年滚动：过去 1 年到未来 20 年", async () => {
    const b = await signedIn();
    await b.request("POST", "/api/events", eventInput({ date: { year: 1990, month: 5, day: 20 } }));
    const { path } = await issue(b);
    const years = async () =>
      uids((await h.browser().request("GET", path)).body).map(uid => Number(/-(\d{4})@/.exec(uid)![1]));

    expect(await years()).toEqual(Array.from({ length: 22 }, (_, i) => 2025 + i));
    // UTC 2026-12-31 16:00 已是上海的 2027 年元旦。
    h.clock.now = Date.UTC(2026, 11, 31, 16, 0, 0);
    expect((await years())[0]).toBe(2026);
    expect((await years()).at(-1)).toBe(2047);
  });

  it("撤销与轮换后旧地址立即 404，新地址可用", async () => {
    const b = await signedIn();
    const first = await issue(b, "iPhone");
    const second = await issue(b, "iPad");

    const rotated = await b.request<{ feed: FeedToken }>("POST", `/api/feed-tokens/${first.feed.id}/rotate`);
    expect(rotated.status).toBe(200);
    expect(rotated.json.feed).toMatchObject({ id: first.feed.id, name: "iPhone" });
    expect(rotated.json.feed.url).not.toBe(first.feed.url);
    expect((await h.browser().request("GET", first.path)).status).toBe(404);
    expect((await h.browser().request("GET", new URL(rotated.json.feed.url!).pathname)).status).toBe(200);
    const listed = await b.request<PageResult<FeedToken>>("GET", "/api/feed-tokens");
    expect(listed.json.items.find(feed => feed.id === first.feed.id)?.url).toBe(rotated.json.feed.url);

    expect((await b.request("DELETE", `/api/feed-tokens/${second.feed.id}`)).status).toBe(200);
    expect((await h.browser().request("GET", second.path)).status).toBe(404);
  });

  it("格式错误或不存在的 token 统一返回 JSON 404", async () => {
    const anonymous = h.browser();
    for (const path of ["/api/feeds/short.ics", `/api/feeds/${"a".repeat(43)}.ics`, `/api/feeds/${"a".repeat(43)}`]) {
      const res = await anonymous.request("GET", path);
      expect(res.status).toBe(404);
      expect(res.json).toMatchObject({ code: "NOT_FOUND" });
    }
  });

  it("账号停用后其订阅地址返回 404", async () => {
    const admin = await signedIn();
    const created = await admin.request<{ user: PublicUser }>("POST", "/api/admin/users", {
      username: "alice",
      displayName: "Alice",
      password: "alice-password",
      role: "user",
    });
    const alice = h.browser();
    await alice.login("alice", "alice-password");
    const { path } = await issue(alice);
    expect((await h.browser().request("GET", path)).status).toBe(200);
    await admin.request("PATCH", `/api/admin/users/${created.json.user.id}`, { disabled: true });
    expect((await h.browser().request("GET", path)).status).toBe(404);
  });

  it("缺字段的旧订阅按 all 导出全部事件", async () => {
    const b = await signedIn();
    const created = await b.request<{ event: CalendarEvent }>("POST", "/api/events", eventInput());
    const ownerId = h.repo.users.listUsers()[0]!.id;
    const id = crypto.randomUUID();
    const token = "A".repeat(43);
    const { hashToken } = await import("../../packages/runtime/src/security.js");
    const tokenHash = hashToken(token);
    const payload = JSON.stringify({
      id,
      ownerId,
      name: "旧设备",
      token,
      tokenHash,
      createdAt: 1,
      rotatedAt: 1,
    });
    const { openDatabase } = await import("../../packages/runtime/src/sqlite.js");
    const db = openDatabase(h.config.sqlitePath);
    db.prepare("INSERT INTO feed_token (id, owner, token_hash, payload) VALUES (?, ?, ?, ?)").run(
      id,
      ownerId,
      tokenHash,
      payload
    );
    db.close();

    const list = await b.request<PageResult<FeedToken>>("GET", "/api/feed-tokens");
    expect(list.json.items.find(feed => feed.id === id)).toMatchObject({
      eventScope: "all",
      eventIds: [],
    });
    const body = (await h.browser().request("GET", `/api/feeds/${token}.ics`)).body;
    expect(uids(body).some(uid => uid.startsWith(created.json.event.id))).toBe(true);
  });

  it("selected 仅导出所选事件，空数组生成空日历且不回退 all", async () => {
    const b = await signedIn();
    const first = await b.request<{ event: CalendarEvent }>("POST", "/api/events", eventInput({ name: "甲" }));
    const second = await b.request<{ event: CalendarEvent }>("POST", "/api/events", eventInput({ name: "乙" }));
    const selected = await b.request<{ feed: FeedToken }>("POST", "/api/feed-tokens", {
      name: "选中",
      eventScope: "selected",
      eventIds: [first.json.event.id],
    });
    expect(selected.status).toBe(201);
    expect(selected.json.feed).toMatchObject({
      eventScope: "selected",
      eventIds: [first.json.event.id],
    });
    const selectedBody = (await h.browser().request("GET", new URL(selected.json.feed.url!).pathname)).body;
    const selectedUids = uids(selectedBody);
    expect(selectedUids.some(uid => uid.startsWith(first.json.event.id))).toBe(true);
    expect(selectedUids.some(uid => uid.startsWith(second.json.event.id))).toBe(false);

    const empty = await b.request<{ feed: FeedToken }>("POST", "/api/feed-tokens", {
      name: "空选",
      eventScope: "selected",
      eventIds: [],
    });
    expect(empty.json.feed).toMatchObject({ eventScope: "selected", eventIds: [] });
    const emptyBody = (await h.browser().request("GET", new URL(empty.json.feed.url!).pathname)).body;
    expect(uids(emptyBody)).toEqual([]);
    expect(emptyBody).toContain("BEGIN:VCALENDAR");
  });

  it("写入非本账号 eventIds 返回 400；渲染跳过已删 id", async () => {
    const b = await signedIn();
    const mine = await b.request<{ event: CalendarEvent }>("POST", "/api/events", eventInput({ name: "我的" }));
    const foreign = crypto.randomUUID();
    const rejected = await b.request("POST", "/api/feed-tokens", {
      name: "非法",
      eventScope: "selected",
      eventIds: [mine.json.event.id, foreign],
    });
    expect(rejected.status).toBe(400);
    expect(rejected.json).toMatchObject({ code: "INVALID_INPUT" });

    const feed = await b.request<{ feed: FeedToken }>("POST", "/api/feed-tokens", {
      name: "可删",
      eventScope: "selected",
      eventIds: [mine.json.event.id],
    });
    await b.request("DELETE", `/api/events/${mine.json.event.id}`);
    const body = (await h.browser().request("GET", new URL(feed.json.feed.url!).pathname)).body;
    expect(uids(body)).toEqual([]);
    const listed = await b.request<PageResult<FeedToken>>("GET", "/api/feed-tokens");
    expect(listed.json.items.find(item => item.id === feed.json.feed.id)).toMatchObject({
      eventScope: "selected",
      eventIds: [],
    });
  });

  it("PATCH 可改范围，all 与 selected 可切换且区分空数组", async () => {
    const b = await signedIn();
    const event = await b.request<{ event: CalendarEvent }>("POST", "/api/events", eventInput());
    const created = await b.request<{ feed: FeedToken }>("POST", "/api/feed-tokens", { name: "手机" });
    expect(created.json.feed.eventScope).toBe("all");

    const toSelected = await b.request<{ feed: FeedToken }>("PATCH", `/api/feed-tokens/${created.json.feed.id}`, {
      eventScope: "selected",
      eventIds: [],
    });
    expect(toSelected.json.feed).toMatchObject({ eventScope: "selected", eventIds: [] });
    expect(uids((await h.browser().request("GET", new URL(toSelected.json.feed.url!).pathname)).body)).toEqual([]);

    const withOne = await b.request<{ feed: FeedToken }>("PATCH", `/api/feed-tokens/${created.json.feed.id}`, {
      eventIds: [event.json.event.id],
    });
    expect(withOne.json.feed).toMatchObject({
      eventScope: "selected",
      eventIds: [event.json.event.id],
    });

    const backAll = await b.request<{ feed: FeedToken }>("PATCH", `/api/feed-tokens/${created.json.feed.id}`, {
      eventScope: "all",
    });
    expect(backAll.json.feed).toMatchObject({ eventScope: "all", eventIds: [] });
    const stored = h.repo.feedTokens.getFeedToken(h.repo.users.listUsers()[0]!.id, created.json.feed.id)!;
    expect(stored.eventScope).toBe("all");
    expect(stored.eventIds).toBeUndefined();
  });
});
