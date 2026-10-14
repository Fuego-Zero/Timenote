import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { FeedToken, PageResult } from "../../packages/contracts/src/index.js";
import { harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

type Page = PageResult<FeedToken>;

describe("GET /api/feed-tokens 分页契约（任务 4b）", () => {
  it("未登录 401", async () => {
    expect((await h.browser().request("GET", "/api/feed-tokens")).status).toBe(401);
  });

  it("按创建时间倒序分页，名称按字面子串搜索", async () => {
    const b = h.browser();
    await b.login();
    for (const name of ["iPhone", "工作电脑", "100%_Mac", "iPad"]) {
      h.clock.now += 1000;
      // eslint-disable-next-line no-await-in-loop -- 依次创建，得到确定的创建时间顺序
      await b.request("POST", "/api/feed-tokens", { name });
    }

    const all = await b.request<Page>("GET", "/api/feed-tokens");
    expect(all.json).toMatchObject({ total: 4, page: 1, pageSize: 20 });
    expect(all.json.items.map(feed => feed.name)).toEqual(["iPad", "100%_Mac", "工作电脑", "iPhone"]);
    expect(all.json.items[0].url).toMatch(/\.ics$/);

    const second = await b.request<Page>("GET", "/api/feed-tokens?page=2&pageSize=3");
    expect(second.json.items.map(feed => feed.name)).toEqual(["iPhone"]);
    const searched = await b.request<Page>("GET", "/api/feed-tokens?q=%25_");
    expect(searched.json.items.map(feed => feed.name)).toEqual(["100%_Mac"]);
    const insensitive = await b.request<Page>("GET", "/api/feed-tokens?q=ip");
    expect(insensitive.json.total).toBe(2);
  });

  it("非法参数返回 400", async () => {
    const b = h.browser();
    await b.login();
    expect((await b.request("GET", "/api/feed-tokens?page=0")).status).toBe(400);
    expect((await b.request("GET", "/api/feed-tokens?pageSize=101")).status).toBe(400);
  });
});
