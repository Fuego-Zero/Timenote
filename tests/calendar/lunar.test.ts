import { describe, expect, it } from "vitest";

import {
  CalendarRangeError,
  eventDateIssues,
  expandEvent,
  formatLunarMonthDay,
  solarToLunar,
} from "../../packages/calendar/src/index.js";
import { eventInput } from "../fixtures.js";

const tz = "Asia/Shanghai";

function lunar(overrides: Parameters<typeof eventInput>[0] = {}) {
  return eventInput({ ...overrides, date: { calendar: "lunar", ...overrides.date } });
}

describe("农历周年", () => {
  it("腊月廿九按目标农历年换算，落在下一公历年初", () => {
    const event = lunar({ date: { year: 1990, month: 12, day: 29 } });
    const [occurrence] = expandEvent(event, { fromYear: 2025, toYear: 2025 }, tz);
    expect(occurrence).toMatchObject({ logicalYear: 2025, start: "2026-02-16", years: 35 });
  });

  it("闰月原始日期：有对应闰月的年份用闰月，没有时按策略用普通月或跳过", () => {
    const leap = (leapMonth: "regular" | "skip") =>
      expandEvent(
        lunar({
          titleTemplate: "{{name}}生日",
          date: { year: null, month: 6, day: 1, leapMonth: true },
          rules: { leapMonth },
        }),
        { fromYear: 2025, toYear: 2026 },
        tz
      ).map(o => o.start);
    const regular = expandEvent(
      lunar({ titleTemplate: "{{name}}生日", date: { year: null, month: 6, day: 1 } }),
      { fromYear: 2026, toYear: 2026 },
      tz
    )[0]?.start;

    expect(leap("skip")).toEqual(["2025-07-25"]);
    expect(leap("regular")).toEqual(["2025-07-25", regular]);
  });

  it("三十遇到小月时按策略取月末或跳过", () => {
    const starts = (missingDay: "lastDay" | "skip") =>
      expandEvent(
        lunar({ date: { year: 1990, month: 12, day: 30 }, rules: { missingDay } }),
        { fromYear: 2025, toYear: 2025 },
        tz
      ).map(o => o.start);
    // 农历 2025 年腊月只有 29 天，廿九即 2026-02-16。
    expect(starts("lastDay")).toEqual(["2026-02-16"]);
    expect(starts("skip")).toEqual([]);
  });

  it("超出 1900-2100 时抛出可见错误而不是静默算错", () => {
    const event = lunar({ date: { year: 1990, month: 1, day: 1 } });
    expect(() => expandEvent(event, { fromYear: 2101, toYear: 2101 }, tz)).toThrow(CalendarRangeError);
  });

  it("校验已知年份的农历原始日期真实存在", () => {
    expect(eventDateIssues(lunar({ date: { year: 2025, month: 2, day: 1, leapMonth: true } }))).toEqual({
      "date.leapMonth": "农历 2025 年没有闰2月",
    });
    expect(eventDateIssues(lunar({ date: { year: 2025, month: 12, day: 30 } }))).toEqual({
      "date.day": "该农历月只有 29 天",
    });
    expect(eventDateIssues(lunar({ date: { year: 2025, month: 6, day: 1, leapMonth: true } }))).toEqual({});
    expect(eventDateIssues(lunar({ date: { year: 1899, month: 1, day: 1 } }))).toHaveProperty("date.year");
  });

  it("公历转农历与中文月日写法", () => {
    expect(solarToLunar("2025-07-25")).toEqual({ year: 2025, month: 6, day: 1, leapMonth: true });
    expect(formatLunarMonthDay(6, 1, true)).toBe("闰六月初一");
    expect(formatLunarMonthDay(12, 30, false)).toBe("腊月三十");
    expect(formatLunarMonthDay(11, 20, false)).toBe("冬月二十");
    expect(formatLunarMonthDay(1, 10, false)).toBe("正月初十");
    expect(formatLunarMonthDay(3, 23, false)).toBe("三月廿三");
  });
});
