import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listEventsByNextOccurrence } from "../../apps/api/src/events.js";
import type { CalendarEvent } from "../../packages/contracts/src/index.js";
import { calendarEvent } from "../fixtures.js";
import { harness, type Harness } from "../helpers.js";

let h: Harness;
let ownerId: string;
beforeEach(async () => {
  h = await harness();
  ownerId = h.repo.users.getUserByUsername("admin")!.id;
});
afterEach(async () => {
  await h.close();
});

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base = { page: 1, pageSize: 20 };

function put(n: number, overrides: Parameters<typeof calendarEvent>[0]) {
  h.repo.events.putEvent(calendarEvent({ id: uuid(n), ownerId, createdAt: n, updatedAt: n, ...overrides }));
}

function names(now: string, timeZone: string, query: Partial<Parameters<typeof listEventsByNextOccurrence>[2]> = {}) {
  return listEventsByNextOccurrence(h.repo, ownerId, { ...base, ...query }, Date.parse(now), timeZone).items.map(
    (event: CalendarEvent) => event.name
  );
}

describe("E1 下次发生排序（任务 6，服务层，暂无路由调用方）", () => {
  it("按用户时区判断今天", () => {
    put(1, { name: "5月19日", date: { month: 5, day: 19 } });
    put(2, { name: "12月1日", date: { month: 12, day: 1 } });
    // UTC 2026-05-19 17:00 = 上海 5 月 20 日 01:00
    expect(names("2026-05-19T17:00:00Z", "UTC")).toEqual(["5月19日", "12月1日"]);
    expect(names("2026-05-19T17:00:00Z", "Asia/Shanghai")).toEqual(["12月1日", "5月19日"]);
  });

  it("跨年与 nextWithinDays 过滤", () => {
    put(1, { name: "1月2日", date: { month: 1, day: 2 } });
    put(2, { name: "12月31日", date: { month: 12, day: 31 } });
    put(3, { name: "6月1日", date: { month: 6, day: 1 } });
    const now = "2026-12-30T04:00:00Z";
    expect(names(now, "Asia/Shanghai")).toEqual(["12月31日", "1月2日", "6月1日"]);
    expect(names(now, "Asia/Shanghai", { nextWithinDays: 2 })).toEqual(["12月31日"]);
    expect(names(now, "Asia/Shanghai", { nextWithinDays: 3 })).toEqual(["12月31日", "1月2日"]);
  });

  it("农历按换算后的公历日期参与排序", () => {
    put(1, { name: "公历2月10日", date: { month: 2, day: 10 } });
    put(2, { name: "农历腊月廿九", date: { calendar: "lunar", year: 1990, month: 12, day: 29 } });
    put(3, { name: "公历2月20日", date: { month: 2, day: 20 } });
    // 农历 2025 年腊月廿九 = 2026-02-16
    expect(names("2026-01-01T04:00:00Z", "Asia/Shanghai")).toEqual(["公历2月10日", "农历腊月廿九", "公历2月20日"]);
  });

  it("2 月 29 日按规则落在平年的 2/28 或 3/1，闰年在 2/29", () => {
    put(1, { name: "3月1日生日", date: { month: 3, day: 1 } });
    put(2, { name: "规则2月28日", date: { year: 2000, month: 2, day: 29 }, rules: { feb29: "feb28" } });
    put(3, { name: "规则3月1日", date: { year: 2000, month: 2, day: 29 }, rules: { feb29: "mar1" } });
    // 2027 平年：2/28、3/1、3/1（同日按 id）
    expect(names("2026-03-02T04:00:00Z", "Asia/Shanghai")).toEqual(["规则2月28日", "3月1日生日", "规则3月1日"]);
    // 2028 闰年：两条都在 2/29，早于 3/1
    expect(names("2027-12-01T04:00:00Z", "Asia/Shanghai")).toEqual(["规则2月28日", "规则3月1日", "3月1日生日"]);
  });

  it("计算失败（CalendarRangeError）排最后，按 id 稳定；nextWithinDays 时被过滤", () => {
    put(3, { name: "农历甲", titleTemplate: "{{name}}", date: { calendar: "lunar", year: null, month: 1, day: 1 } });
    put(1, { name: "农历乙", titleTemplate: "{{name}}", date: { calendar: "lunar", year: null, month: 2, day: 1 } });
    put(2, { name: "公历", date: { year: 1890, month: 7, day: 1 } });
    // 1900 年时农历需要从 1899 年开始找，超出 1900-2100 的换算范围
    expect(names("1900-06-01T04:00:00Z", "Asia/Shanghai")).toEqual(["公历", "农历乙", "农历甲"]);
    expect(names("1900-06-01T04:00:00Z", "Asia/Shanghai", { nextWithinDays: 366 })).toEqual(["公历"]);
  });

  it("先套用 SQL 筛选，total 为过滤后条数，按页切分", () => {
    for (let n = 1; n <= 5; n += 1) {
      put(n, { name: `生日${n}`, date: { month: n, day: 1 } });
    }

    put(6, { name: "纪念日", kind: "anniversary", titleTemplate: "{{name}}", date: { month: 1, day: 15 } });
    const result = listEventsByNextOccurrence(
      h.repo,
      ownerId,
      { page: 2, pageSize: 2, kind: "birthday" },
      Date.parse("2026-01-10T04:00:00Z"),
      "Asia/Shanghai"
    );
    expect(result.total).toBe(5);
    expect(result.items.map(event => event.name)).toEqual(["生日4", "生日5"]);
  });
});
