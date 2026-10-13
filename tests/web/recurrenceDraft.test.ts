import { describe, expect, it } from "vitest";

import { normalizeRecurrence, withKind, withRecurrence } from "../../apps/web/src/features/events/eventDraft.js";
import { recurrenceSummary } from "../../apps/web/src/features/events/recurrenceText.js";
import { eventInput } from "../fixtures.js";

const tz = "Asia/Shanghai";
const anniversary = eventInput({ kind: "anniversary", titleTemplate: "{{name}}第 {{years}} 周年" });

describe("重复规则草稿", () => {
  it("默认模板随规则切换，自定义模板保持不变", () => {
    expect(withRecurrence(anniversary, { unit: "month", interval: 1, end: { type: "never" } }).titleTemplate).toBe(
      "{{name}}第 {{count}} 个月"
    );
    expect(withRecurrence(anniversary, { unit: "week", interval: 1, end: { type: "never" } }).titleTemplate).toBe(
      "{{name}}第 {{count}} 周"
    );
    expect(withRecurrence(anniversary, { unit: "year", interval: 2, end: { type: "never" } }).titleTemplate).toBe(
      "{{name}}第 {{count}} 次"
    );
    const custom = { ...anniversary, titleTemplate: "{{name}}！" };
    expect(withRecurrence(custom, { unit: "day", interval: 3, end: { type: "never" } }).titleTemplate).toBe(
      "{{name}}！"
    );
  });

  it("农历或年份未知时改回每年并标记提示；切换类型清空规则与里程碑", () => {
    const monthly = withRecurrence(anniversary, { unit: "month", interval: 1, end: { type: "never" } });
    const lunar = normalizeRecurrence({ ...monthly, date: { ...monthly.date, calendar: "lunar", day: 1 } });
    expect(lunar.reset).toBe(true);
    expect(lunar.draft.recurrence).toMatchObject({ unit: "year", interval: 1 });
    expect(lunar.draft.titleTemplate).toBe("{{name}}第 {{years}} 周年");
    const unknown = normalizeRecurrence({ ...monthly, milestones: [100], date: { ...monthly.date, year: null } });
    expect(unknown.draft).toMatchObject({
      recurrence: { unit: "year", interval: 1, end: { type: "never" } },
      milestones: [],
    });
    expect(withKind({ ...monthly, milestones: [100] }, "birthday", tz)).toMatchObject({
      recurrence: { unit: "year", interval: 1 },
      milestones: [],
      titleTemplate: "{{name}} {{years}} 岁生日",
    });
  });

  it("列表规则摘要", () => {
    expect(recurrenceSummary(anniversary)).toEqual([]);
    expect(
      recurrenceSummary({ recurrence: { unit: "week", interval: 2, end: { type: "never" } }, milestones: [] })
    ).toEqual(["每 2 周"]);
    expect(
      recurrenceSummary({
        recurrence: { unit: "month", interval: 1, end: { type: "until", until: "2027-12-31" } },
        milestones: [100, 200, 520],
      })
    ).toEqual(["每月 · 至 2027-12-31", "+3 个里程碑"]);
  });
});
