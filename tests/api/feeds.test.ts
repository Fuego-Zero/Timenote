import ICAL from "ical.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CalendarEvent, IssuedFeed, PublicUser } from "../../packages/contracts/src/index.js";
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
  const res = await b.request<IssuedFeed>("POST", "/api/feed-tokens", { name });
  expect(res.status).toBe(201);
  return { ...res.json, path: new URL(res.json.url).pathname };
}

function uids(body: string) {
  return new ICAL.Component(ICAL.parse(body))
    .getAllSubcomponents("vevent")
    .map(vevent => String(vevent.getFirstPropertyValue("uid")));
}

describe("订阅地址", () => {
  it("地址只在创建时完整返回，数据库与列表只保存哈希和 4 位提示", async () => {
    const b = await signedIn();
    const issued = await issue(b);
    const token = /\/api\/feeds\/([\w-]{43})\.ics$/.exec(issued.url)![1]!;
    expect(issued.webcalUrl).toBe(issued.url.replace("http:", "webcal:"));
    expect(issued.url).toMatch(/^http:\/\/127\.0\.0\.1:8720\/api\/feeds\//);

    const list = await b.request<{ feeds: unknown[] }>("GET", "/api/feed-tokens");
    expect(JSON.stringify(list.json)).not.toContain(token);
    expect(list.json.feeds).toEqual([expect.objectContaining({ name: "iPhone", tokenHint: token.slice(0, 4) })]);
    const stored = h.repo.listFeedTokens(h.repo.listUsers()[0]!.id);
    expect(JSON.stringify(stored)).not.toContain(token);
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

    const rotated = await b.request<IssuedFeed>("POST", `/api/feed-tokens/${first.feed.id}/rotate`);
    expect(rotated.status).toBe(200);
    expect(rotated.json.feed).toMatchObject({ id: first.feed.id, name: "iPhone" });
    expect((await h.browser().request("GET", first.path)).status).toBe(404);
    expect((await h.browser().request("GET", new URL(rotated.json.url).pathname)).status).toBe(200);

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
});
