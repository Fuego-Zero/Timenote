import { describe, expect, it } from "vitest";

import { expandEvent, upcomingOccurrences } from "../../packages/calendar/src/index.js";
import { eventInput } from "../fixtures.js";

const tz = "Asia/Shanghai";

describe("公历周年", () => {
  it("2021-05-20 的纪念日在 2026-2028 年分别是第 5、6、7 周年", () => {
    const event = eventInput({
      kind: "anniversary",
      name: "我们",
      titleTemplate: "{{name}}第 {{years}} 周年",
      date: { year: 2021, month: 5, day: 20 },
    });
    const result = expandEvent(event, { fromYear: 2026, toYear: 2028 }, tz, "2026-10-02");
    expect(result.map(o => [o.start, o.years, o.title])).toEqual([
      ["2026-05-20", 5, "我们第 5 周年"],
      ["2027-05-20", 6, "我们第 6 周年"],
      ["2028-05-20", 7, "我们第 7 周年"],
    ]);
  });

  it("不生成第 0 周年或原始日期之前的年份", () => {
    const event = eventInput({ date: { year: 2021 } });
    expect(expandEvent(event, { fromYear: 2019, toYear: 2022 }, tz, "2026-10-02").map(o => o.logicalYear)).toEqual([
      2022,
    ]);
  });

  it("年份未知时每年生成且不显示岁数", () => {
    const event = eventInput({ titleTemplate: "{{name}}生日", date: { year: null } });
    const result = expandEvent(event, { fromYear: 2026, toYear: 2027 }, tz, "2026-10-02");
    expect(result.map(o => [o.start, o.years, o.title])).toEqual([
      ["2026-05-20", null, "小明生日"],
      ["2027-05-20", null, "小明生日"],
    ]);
  });

  it("2 月 29 日在平年按策略回落到 2 月 28 日、3 月 1 日或跳过，闰年保持原日", () => {
    const starts = (feb29: "feb28" | "mar1" | "skip") =>
      expandEvent(
        eventInput({ date: { year: 2000, month: 2, day: 29 }, rules: { feb29 } }),
        { fromYear: 2027, toYear: 2028 },
        tz,
        "2026-10-02"
      ).map(o => o.start);
    expect(starts("feb28")).toEqual(["2027-02-28", "2028-02-29"]);
    expect(starts("mar1")).toEqual(["2027-03-01", "2028-02-29"]);
    expect(starts("skip")).toEqual(["2028-02-29"]);
  });

  it("前缀与模板渲染幂等，标题只替换白名单变量", () => {
    const event = eventInput({ titlePrefix: "🎂", titleTemplate: "🎂 {{name}} {{years}} 岁" });
    expect(expandEvent(event, { fromYear: 2026, toYear: 2026 }, tz, "2026-10-02")[0]?.title).toBe("🎂 小明 36 岁");
    const prefixed = eventInput({ titlePrefix: "🎂", titleTemplate: "{{name}}的 {{years}} 岁" });
    expect(expandEvent(prefixed, { fromYear: 2026, toYear: 2026 }, tz, "2026-10-02")[0]?.title).toBe("🎂 小明的 36 岁");
  });
});

describe("跨天与普通事件", () => {
  it("10/1 到 10/7 的普通事件只发生一次，排他结束日是 10/8，且不受周年窗口影响", () => {
    const event = eventInput({
      kind: "event",
      name: "国庆旅行",
      titleTemplate: "{{name}}",
      durationDays: 7,
      date: { year: 2026, month: 10, day: 1 },
    });
    const result = expandEvent(event, { fromYear: 2030, toYear: 2040 }, tz, "2026-10-02");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ start: "2026-10-01", lastDay: "2026-10-07", end: "2026-10-08", years: null });
  });

  it("12/30 起持续 5 天的周年事件跨越公历年", () => {
    const event = eventInput({ kind: "anniversary", durationDays: 5, date: { year: 2020, month: 12, day: 30 } });
    expect(expandEvent(event, { fromYear: 2026, toYear: 2026 }, tz, "2026-10-02")[0]).toMatchObject({
      start: "2026-12-30",
      lastDay: "2027-01-03",
      end: "2027-01-04",
    });
  });
});

describe("未来几次预览", () => {
  it("从用户时区的今天算起，包含仍在持续中的那一次", () => {
    const event = eventInput({ durationDays: 3, date: { year: 1990, month: 10, day: 1 } });
    // 上海时间 2026-10-02 08:00，10/1 起 3 天的生日仍在进行中。
    const now = new Date("2026-10-02T00:00:00Z");
    const result = upcomingOccurrences(event, now, tz, 5);
    expect(result.map(o => o.start)).toEqual(["2026-10-01", "2027-10-01", "2028-10-01", "2029-10-01", "2030-10-01"]);
  });

  it("用户时区跨日时以本地日期为准", () => {
    const event = eventInput({ date: { year: 1990, month: 10, day: 1 } });
    const now = new Date("2026-10-01T17:00:00Z");
    expect(upcomingOccurrences(event, now, "Asia/Shanghai", 1)[0]?.start).toBe("2027-10-01");
    expect(upcomingOccurrences(event, now, "America/New_York", 1)[0]?.start).toBe("2026-10-01");
  });

  it("2 月 29 日跳过策略也能凑满 5 次", () => {
    const event = eventInput({ date: { year: 2000, month: 2, day: 29 }, rules: { feb29: "skip" } });
    const result = upcomingOccurrences(event, new Date("2026-10-02T00:00:00Z"), tz, 5);
    expect(result.map(o => o.start)).toEqual(["2028-02-29", "2032-02-29", "2036-02-29", "2040-02-29", "2044-02-29"]);
  });
});
