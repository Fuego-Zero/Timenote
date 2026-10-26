import ICAL from "ical.js";
import { describe, expect, it } from "vitest";

import { buildFeed, cycleStart, expandEvent, milestoneDates } from "../../packages/calendar/src/index.js";
import { type EventInput, maxFutureOccurrences, maxPastOccurrences } from "../../packages/contracts/src/index.js";
import { calendarEvent, eventInput } from "../fixtures.js";

const tz = "Asia/Shanghai";

function anniversary(overrides: Parameters<typeof eventInput>[0] = {}) {
  return eventInput({ kind: "anniversary", name: "在一起", titleTemplate: "{{name}}第 {{count}} 次", ...overrides });
}

describe("按天/周/月展开", () => {
  it("1/31 按月、缺日落月末：2/28（闰年 2/29）、3/31、4/30", () => {
    const event = anniversary({
      date: { year: 2026, month: 1, day: 31 },
      recurrence: { unit: "month", interval: 1, end: { type: "never" } },
    });
    expect([1, 2, 3].map(k => cycleStart(event, k))).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
    const leap = anniversary({ date: { year: 2028, month: 1, day: 31 }, recurrence: event.recurrence });
    expect(cycleStart(leap, 1)).toBe("2028-02-29");
  });

  it("缺日跳过时该次不输出，序号照常递增", () => {
    const event = anniversary({
      date: { year: 2026, month: 1, day: 31 },
      recurrence: { unit: "month", interval: 1, end: { type: "count", count: 4 } },
      gregorianMissingDay: "skip",
    });
    expect(cycleStart(event, 1)).toBeNull();
    const result = expandEvent(event, { fromYear: 2026, toYear: 2026 }, tz, "2026-01-01");
    expect(result.map(o => [o.key, o.start, o.title])).toEqual([
      ["k2", "2026-03-31", "在一起第 2 次"],
      ["k4", "2026-05-31", "在一起第 4 次"],
    ]);
  });

  it("每 3 个月：11/30 → 2/28 → 5/30", () => {
    const event = anniversary({
      date: { year: 2025, month: 11, day: 30 },
      recurrence: { unit: "month", interval: 3, end: { type: "never" } },
    });
    expect([1, 2].map(k => cycleStart(event, k))).toEqual(["2026-02-28", "2026-05-30"]);
  });

  it("每 2 周跨年、跨夏令时不偏移，提醒仍按本地时刻", () => {
    const yearEnd = anniversary({
      date: { year: 2026, month: 12, day: 24 },
      recurrence: { unit: "week", interval: 2, end: { type: "never" } },
    });
    expect(cycleStart(yearEnd, 1)).toBe("2027-01-07");
    const dst = anniversary({
      date: { year: 2026, month: 2, day: 22 },
      recurrence: { unit: "week", interval: 2, end: { type: "count", count: 2 } },
      alarms: [{ daysBefore: 0, time: "09:00" }],
    });
    const result = expandEvent(dst, { fromYear: 2026, toYear: 2026 }, "America/New_York", "2026-01-01");
    expect(result.map(o => [o.start, o.alarms[0]?.at])).toEqual([
      ["2026-03-08", "2026-03-08T13:00:00.000Z"],
      ["2026-03-22", "2026-03-22T13:00:00.000Z"],
    ]);
  });

  it("订阅截断：过去最多 12 次、未来最多 60 次", () => {
    const event = anniversary({
      date: { year: 2020, month: 1, day: 1 },
      recurrence: { unit: "day", interval: 1, end: { type: "never" } },
    });
    const result = expandEvent(event, { fromYear: 2025, toYear: 2046 }, tz, "2026-06-15");
    expect(result).toHaveLength(maxPastOccurrences + maxFutureOccurrences);
    expect(result.filter(o => o.lastDay < "2026-06-15")).toHaveLength(maxPastOccurrences);
    expect(result[0]?.start).toBe("2026-06-03");
    expect(result.at(-1)?.start).toBe("2026-08-13");
  });

  it("UID 用 id-kN，窗口滑动后同一次的 UID 不变", () => {
    const event = calendarEvent({
      kind: "anniversary",
      titleTemplate: "{{name}}第 {{count}} 次",
      date: { year: 2026, month: 1, day: 15 },
      recurrence: { unit: "month", interval: 1, end: { type: "never" } },
    });
    const uidFor = (body: string, date: string) =>
      ICAL.Component.fromString(body)
        .getAllSubcomponents("vevent")
        .find(vevent => String(vevent.getFirstPropertyValue("dtstart")) === date)
        ?.getFirstPropertyValue("uid");
    const before = buildFeed({
      calendarName: "c",
      timeZone: tz,
      events: [event],
      window: { fromYear: 2025, toYear: 2045 },
      today: "2026-06-01",
    });
    const after = buildFeed({
      calendarName: "c",
      timeZone: tz,
      events: [event],
      window: { fromYear: 2026, toYear: 2046 },
      today: "2027-02-01",
    });
    expect(uidFor(before, "2026-12-15")).toBe(`${event.id}-k11@timenote`);
    expect(uidFor(after, "2026-12-15")).toBe(`${event.id}-k11@timenote`);
    expect(before).not.toMatch(/RRULE|CANCELLED/);
  });
});

describe("按年与结束条件", () => {
  it("隔 2 年用 {{count}}，共 2 个周期后停止", () => {
    const event = anniversary({
      date: { year: 2020, month: 5, day: 20 },
      recurrence: { unit: "year", interval: 2, end: { type: "count", count: 2 } },
    });
    expect(expandEvent(event, { fromYear: 2020, toYear: 2030 }, tz, "2026-10-02").map(o => [o.start, o.title])).toEqual(
      [
        ["2022-05-20", "在一起第 1 次"],
        ["2024-05-20", "在一起第 2 次"],
      ]
    );
  });

  it("农历先换算公历再比较 until，until 等于开始日时输出", () => {
    const base = anniversary({
      titleTemplate: "{{name}}第 {{years}} 周年",
      date: { calendar: "lunar", year: 2020, month: 1, day: 1 },
    });
    const start2025 = expandEvent(base, { fromYear: 2025, toYear: 2025 }, tz, "2026-10-02")[0]?.start ?? "";
    const limited: EventInput = {
      ...base,
      recurrence: { unit: "year", interval: 1, end: { type: "until", until: start2025 } },
    };
    expect(expandEvent(limited, { fromYear: 2024, toYear: 2027 }, tz, "2026-10-02").map(o => o.logicalYear)).toEqual([
      2024, 2025,
    ]);
  });
});

describe("里程碑", () => {
  it("年份为空的每年重复在窗口内每年一条，标题没有周年数", () => {
    const event = eventInput({
      kind: "holiday",
      name: "春节",
      titleTemplate: "{{name}}",
      date: { calendar: "lunar", year: null, month: 1, day: 1 },
    });
    const result = expandEvent(event, { fromYear: 2026, toYear: 2027 }, tz, "2026-01-01");
    expect(result.map(item => item.title)).toEqual(["春节", "春节"]);
    expect(result.every(item => item.years === null)).toBe(true);
  });

  it("有起点就能输出里程碑，不要求标识是纪念日", () => {
    const dates = milestoneDates(
      eventInput({ kind: "birthday", date: { year: 2026, month: 1, day: 1 }, milestones: [100] })
    );
    expect(dates).toEqual([{ days: 100, start: "2026-04-11" }]);
  });

  it("第 N 天 = 起始日 + N 天，起始日为第 0 天；农历先换算公历起点", () => {
    expect(milestoneDates(anniversary({ date: { year: 2026, month: 1, day: 1 }, milestones: [520, 100] }))).toEqual([
      { days: 100, start: "2026-04-11" },
      { days: 520, start: "2027-06-05" },
    ]);
    expect(
      milestoneDates(anniversary({ date: { calendar: "lunar", year: 2020, month: 1, day: 1 }, milestones: [100] }))
    ).toEqual([{ days: 100, start: "2020-05-04" }]);
  });

  it("里程碑持续 1 天、沿用事件提醒、UID 为 id-mN，不受结束条件影响", () => {
    const event = anniversary({
      date: { year: 2026, month: 1, day: 1 },
      durationDays: 3,
      recurrence: { unit: "year", interval: 1, end: { type: "count", count: 1 } },
      titleTemplate: "{{name}}第 {{years}} 周年",
      milestones: [520],
      alarms: [{ daysBefore: 1, time: "09:00" }],
    });
    const milestone = expandEvent(event, { fromYear: 2026, toYear: 2030 }, tz, "2026-10-02").find(
      o => o.key === "m520"
    );
    expect(milestone).toMatchObject({
      start: "2027-06-05",
      end: "2027-06-06",
      title: "在一起第 520 天",
      alarms: [{ at: "2027-06-04T01:00:00.000Z" }],
    });
  });
});
