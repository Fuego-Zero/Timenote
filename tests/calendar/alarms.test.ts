import { describe, expect, it } from "vitest";

import { expandEvent } from "../../packages/calendar/src/index.js";
import { eventInput } from "../fixtures.js";

function alarmsAt(timeZone: string, date: { month: number; day: number }, alarm: { daysBefore: number; time: string }) {
  const event = eventInput({
    kind: "event",
    titleTemplate: "{{name}}",
    date: { year: 2026, ...date },
    alarms: [alarm],
  });
  return expandEvent(event, { fromYear: 2026, toYear: 2026 }, timeZone, "2026-10-02")[0]?.alarms.map(a => a.at);
}

describe("绝对 UTC 提醒", () => {
  it("上海时区提前 1 天 09:00 换算为前一天 01:00Z", () => {
    expect(alarmsAt("Asia/Shanghai", { month: 2, day: 16 }, { daysBefore: 1, time: "09:00" })).toEqual([
      "2026-02-15T01:00:00.000Z",
    ]);
  });

  it("当天 00:00 提醒跨越 UTC 日期", () => {
    expect(alarmsAt("Asia/Shanghai", { month: 1, day: 1 }, { daysBefore: 0, time: "00:00" })).toEqual([
      "2025-12-31T16:00:00.000Z",
    ]);
  });

  it("纽约夏令时开始当天被跳过的 02:30 顺延到 03:30 EDT", () => {
    // 2026-03-08 凌晨 2 点直接跳到 3 点。
    expect(alarmsAt("America/New_York", { month: 3, day: 9 }, { daysBefore: 1, time: "02:30" })).toEqual([
      "2026-03-08T07:30:00.000Z",
    ]);
  });

  it("纽约夏令时结束当天重复出现的 01:30 取较早的 EDT 那一次", () => {
    // 2026-11-01 凌晨 1 点到 2 点出现两次。
    expect(alarmsAt("America/New_York", { month: 11, day: 1 }, { daysBefore: 0, time: "01:30" })).toEqual([
      "2026-11-01T05:30:00.000Z",
    ]);
  });

  it("夏令时前后的同一本地时刻对应不同 UTC 偏移", () => {
    expect(alarmsAt("America/New_York", { month: 1, day: 15 }, { daysBefore: 0, time: "09:00" })).toEqual([
      "2026-01-15T14:00:00.000Z",
    ]);
    expect(alarmsAt("America/New_York", { month: 7, day: 15 }, { daysBefore: 0, time: "09:00" })).toEqual([
      "2026-07-15T13:00:00.000Z",
    ]);
  });
});
