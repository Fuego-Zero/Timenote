import { describe, expect, it } from "vitest";

import { backupFileSchema, eventInputSchema, type Recurrence } from "../../packages/contracts/src/index.js";
import { eventInput } from "../fixtures.js";

function issues(input: unknown) {
  const parsed = eventInputSchema.safeParse(input);
  return parsed.success
    ? {}
    : Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.message]));
}

const monthly: Recurrence = { unit: "month", interval: 1, end: { type: "never" } };
const anniversary = (overrides: Parameters<typeof eventInput>[0] = {}) =>
  eventInput({ kind: "anniversary", titleTemplate: "{{name}}第 {{count}} 次", ...overrides });

describe("重复规则契约", () => {
  it("默认规则每 1 年、永不结束且无里程碑可通过；纪念日按月和里程碑可通过", () => {
    expect(issues(eventInput())).toEqual({});
    expect(issues(anniversary({ recurrence: monthly, milestones: [100, 520] }))).toEqual({});
  });

  it("新字段必填", () => {
    const rest = Object.fromEntries(Object.entries(eventInput()).filter(([key]) => key !== "recurrence"));
    expect(issues(rest)).toHaveProperty("recurrence");
  });

  it("生日和普通事件只能每 1 年且无里程碑", () => {
    expect(issues(eventInput({ recurrence: monthly, titleTemplate: "{{name}}" }))).toHaveProperty("recurrence");
    expect(issues(eventInput({ milestones: [100] }))).toHaveProperty("milestones", "只有纪念日可以设置里程碑");
  });

  it("间隔、农历、年份未知、截止日期的非法组合被拒绝", () => {
    expect(issues(anniversary({ recurrence: { unit: "day", interval: 1000, end: { type: "never" } } }))).toHaveProperty(
      "recurrence.interval",
      "间隔最多 999"
    );
    expect(issues(anniversary({ recurrence: monthly, date: { calendar: "lunar", month: 1, day: 1 } }))).toHaveProperty(
      "recurrence.unit",
      "农历日期只能按年重复"
    );
    expect(
      issues(anniversary({ titleTemplate: "{{name}}", recurrence: monthly, date: { year: null } }))
    ).toHaveProperty("recurrence", "年份未知时只能每年重复且永不结束");
    expect(issues(anniversary({ titleTemplate: "{{name}}", milestones: [100], date: { year: null } }))).toHaveProperty(
      "milestones",
      "年份未知时不能设置里程碑"
    );
    expect(
      issues(anniversary({ recurrence: { ...monthly, end: { type: "until", until: "1990-05-19" } } }))
    ).toHaveProperty("recurrence.end.until", "截止日期不能早于开始日期");
    expect(issues(anniversary({ recurrence: { ...monthly, end: { type: "count", count: 1000 } } }))).toHaveProperty(
      "recurrence.end.count"
    );
  });

  it("持续天数与提醒提前天数受周期限制", () => {
    const weekly: Recurrence = { unit: "week", interval: 1, end: { type: "never" } };
    expect(issues(anniversary({ recurrence: weekly, durationDays: 8 }))).toHaveProperty(
      "durationDays",
      "最多持续 7 天"
    );
    expect(issues(anniversary({ recurrence: weekly, alarms: [{ daysBefore: 7, time: "09:00" }] }))).toHaveProperty(
      "alarms.0.daysBefore",
      "提前天数必须小于 7"
    );
  });

  it("里程碑去重、最多 20 个、每项 1–36500", () => {
    expect(issues(anniversary({ milestones: [100, 100] }))).toHaveProperty("milestones", "里程碑天数不能重复");
    expect(issues(anniversary({ milestones: Array.from({ length: 21 }, (_, i) => i + 1) }))).toHaveProperty(
      "milestones"
    );
    expect(issues(anniversary({ milestones: [36501] }))).toHaveProperty("milestones.0");
    expect(issues(anniversary({ milestones: [0] }))).toHaveProperty("milestones.0");
  });

  it("模板变量按规则校验：隔 N 年不能用 {{years}}，生日不能用 {{count}}，{{days}} 只给里程碑模板", () => {
    const everyTwoYears: Recurrence = { unit: "year", interval: 2, end: { type: "never" } };
    expect(issues(anniversary({ recurrence: everyTwoYears, titleTemplate: "{{name}} {{years}}" }))).toEqual({
      titleTemplate: "只有每 1 年重复时模板才能使用 {{years}}",
    });
    expect(issues(eventInput({ titleTemplate: "{{name}} {{count}}" }))).toEqual({
      titleTemplate: "模板只支持 {{name}} 和 {{years}}",
    });
    expect(issues(anniversary({ recurrence: monthly, titleTemplate: "{{name}} {{days}}" }))).toEqual({
      titleTemplate: "模板只支持 {{name}} 和 {{count}}",
    });
    expect(issues(eventInput({ milestoneTemplate: "{{name}} {{years}}" }))).toEqual({
      milestoneTemplate: "模板只支持 {{name}} 和 {{days}}",
    });
  });

  it("备份只接受 v2，v1 给出重新导出的提示", () => {
    const file = { format: "timenote-backup", exportedAt: new Date().toISOString(), events: [] };
    expect(backupFileSchema.safeParse({ ...file, version: 2 }).success).toBe(true);
    const v1 = backupFileSchema.safeParse({ ...file, version: 1 });
    expect(v1.success ? "" : v1.error.issues[0]?.message).toBe("不再支持 v1 备份文件，请用升级前的版本重新导出");
  });
});
