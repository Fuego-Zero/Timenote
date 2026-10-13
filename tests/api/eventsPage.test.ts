import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { CalendarEvent, PageResult } from "../../packages/contracts/src/index.js";
import { eventInput } from "../fixtures.js";
import { harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

type Page = PageResult<CalendarEvent>;

async function seeded() {
  const b = h.browser();
  await b.login();
  const create = async (name: string, overrides: Parameters<typeof eventInput>[0] = {}) => {
    h.clock.now += 1000;
    return (await b.request<{ event: CalendarEvent }>("POST", "/api/events", eventInput({ name, ...overrides }))).json
      .event;
  };

  return { b, create };
}

describe("GET /api/events 分页契约（任务 4a）", () => {
  it("未登录 401", async () => {
    expect((await h.browser().request("GET", "/api/events")).status).toBe(401);
  });

  it("默认第 1 页 20 条，按创建时间倒序，返回 total", async () => {
    const { b, create } = await seeded();
    for (let index = 1; index <= 22; index += 1) {
      // eslint-disable-next-line no-await-in-loop -- 依次创建，得到确定的创建时间顺序
      await create(`事件${index}`);
    }

    const first = await b.request<Page>("GET", "/api/events");
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ total: 22, page: 1, pageSize: 20 });
    expect(first.json.items[0].name).toBe("事件22");
    const second = await b.request<Page>("GET", "/api/events?page=2&pageSize=20");
    expect(second.json.items.map(event => event.name)).toEqual(["事件2", "事件1"]);
  });

  it("搜索、筛选与 ids 按 AND 组合", async () => {
    const { b, create } = await seeded();
    const birthday = await create("小明");
    await create("结婚", { kind: "anniversary", titleTemplate: "{{name}} {{years}} 周年" });
    await create("小红", { date: { calendar: "lunar", month: 1, day: 1 } });

    const names = async (query: string) =>
      (await b.request<Page>("GET", `/api/events?${query}`)).json.items.map(event => event.name);
    expect(await names("q=%E5%B0%8F")).toEqual(["小红", "小明"]);
    expect(await names("kind=anniversary")).toEqual(["结婚"]);
    expect(await names("calendar=lunar")).toEqual(["小红"]);
    expect(await names("hasAlarm=false&kind=birthday")).toEqual(["小红", "小明"]);
    expect(await names(`ids=${birthday.id}&kind=birthday`)).toEqual(["小明"]);
    expect(await names(`ids=${birthday.id}&kind=anniversary`)).toEqual([]);
  });

  it("sort=nextOccurrence 按用户时区与 ctx.now() 计算，nextWithinDays 过滤", async () => {
    const { b, create } = await seeded();
    await create("十二月", { date: { month: 12, day: 1 } });
    await create("五月十九", { date: { month: 5, day: 19 } });
    // UTC 2026-05-19 17:00 = 上海 5 月 20 日 01:00：五月十九已过，下次在明年
    h.clock.now = Date.parse("2026-05-19T17:00:00Z");
    const next = await b.request<Page>("GET", "/api/events?sort=nextOccurrence");
    expect(next.json.items.map(event => event.name)).toEqual(["十二月", "五月十九"]);
    const within = await b.request<Page>("GET", "/api/events?sort=nextOccurrence&nextWithinDays=200");
    expect(within.json).toMatchObject({ total: 1 });
    expect(within.json.items.map(event => event.name)).toEqual(["十二月"]);
  });

  it("非法参数返回 400", async () => {
    const { b } = await seeded();
    for (const query of ["page=0", "pageSize=101", "sort=name", "hasAlarm=1", "ids=not-a-uuid"]) {
      // eslint-disable-next-line no-await-in-loop -- 逐个请求，失败时能看出是哪个参数
      expect((await b.request("GET", `/api/events?${query}`)).status).toBe(400);
    }
  });
});
