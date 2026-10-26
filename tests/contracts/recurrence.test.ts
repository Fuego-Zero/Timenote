import { describe, expect, it } from "vitest";

import {
  backupFileSchema,
  eventInputSchema,
  issueDetail,
  type Recurrence,
} from "../../packages/contracts/src/index.js";
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

  it("按月重复和有起点的里程碑不限预设标识；只发生一次必须有年份", () => {
    expect(
      issues(eventInput({ kind: "birthday", recurrence: monthly, titleTemplate: "{{name}}第 {{count}} 个月" }))
    ).toEqual({});
    expect(issues(eventInput({ kind: "birthday", milestones: [100] }))).toEqual({});
    expect(issues(eventInput({ recurrence: null, date: { year: null }, titleTemplate: "{{name}}" }))).toHaveProperty(
      "date.year",
      "event_year_required"
    );
  });

  it("间隔、农历、年份未知、截止日期的非法组合被拒绝", () => {
    expect(issues(anniversary({ recurrence: { unit: "day", interval: 1000, end: { type: "never" } } }))).toHaveProperty(
      "recurrence.interval",
      issueDetail("interval_max", { n: 999 })
    );
    expect(issues(anniversary({ recurrence: monthly, date: { calendar: "lunar", month: 1, day: 1 } }))).toHaveProperty(
      "recurrence.unit",
      "lunar_yearly_only"
    );
    expect(
      issues(anniversary({ titleTemplate: "{{name}}", recurrence: monthly, date: { year: null } }))
    ).toHaveProperty("recurrence", "unknown_year_recurrence");
    expect(issues(anniversary({ titleTemplate: "{{name}}", milestones: [100], date: { year: null } }))).toHaveProperty(
      "milestones",
      "unknown_year_milestones"
    );
    expect(
      issues(anniversary({ recurrence: { ...monthly, end: { type: "until", until: "1990-05-19" } } }))
    ).toHaveProperty("recurrence.end.until", "until_before_start");
    expect(issues(anniversary({ recurrence: { ...monthly, end: { type: "count", count: 1000 } } }))).toHaveProperty(
      "recurrence.end.count"
    );
  });

  it("持续天数与提醒提前天数受周期限制", () => {
    const weekly: Recurrence = { unit: "week", interval: 1, end: { type: "never" } };
    expect(issues(anniversary({ recurrence: weekly, durationDays: 8 }))).toHaveProperty(
      "durationDays",
      issueDetail("duration_max", { n: 7 })
    );
    expect(issues(anniversary({ recurrence: weekly, alarms: [{ daysBefore: 7, time: "09:00" }] }))).toHaveProperty(
      "alarms.0.daysBefore",
      issueDetail("alarm_before_cycle", { n: 7 })
    );
  });

  it("里程碑去重、最多 20 个、每项 1–36500", () => {
    expect(issues(anniversary({ milestones: [100, 100] }))).toHaveProperty("milestones", "milestones_duplicate");
    expect(issues(anniversary({ milestones: Array.from({ length: 21 }, (_, i) => i + 1) }))).toHaveProperty(
      "milestones"
    );
    expect(issues(anniversary({ milestones: [36501] }))).toHaveProperty("milestones.0");
    expect(issues(anniversary({ milestones: [0] }))).toHaveProperty("milestones.0");
  });

  it("模板变量按规则校验：隔 N 年不能用 {{years}}，生日不能用 {{count}}，{{days}} 只给里程碑模板", () => {
    const everyTwoYears: Recurrence = { unit: "year", interval: 2, end: { type: "never" } };
    expect(issues(anniversary({ recurrence: everyTwoYears, titleTemplate: "{{name}} {{years}}" }))).toEqual({
      titleTemplate: "years_only_yearly",
    });
    expect(issues(eventInput({ titleTemplate: "{{name}} {{count}}" }))).toEqual({
      titleTemplate: issueDetail("template_vars", { vars: "name,years" }),
    });
    expect(issues(anniversary({ recurrence: monthly, titleTemplate: "{{name}} {{days}}" }))).toEqual({
      titleTemplate: issueDetail("template_vars", { vars: "name,count" }),
    });
    expect(issues(eventInput({ milestoneTemplate: "{{name}} {{years}}" }))).toEqual({
      milestoneTemplate: issueDetail("template_vars", { vars: "name,days" }),
    });
  });

  it("备份只接受 v3，更早的版本给出重新导出的提示", () => {
    const file = { format: "timenote-backup", exportedAt: new Date().toISOString(), events: [] };
    expect(backupFileSchema.safeParse({ ...file, version: 3 }).success).toBe(true);
    const v2 = backupFileSchema.safeParse({ ...file, version: 2 });
    expect(v2.success ? "" : v2.error.issues[0]?.message).toBe("backup_v1");
  });
});
