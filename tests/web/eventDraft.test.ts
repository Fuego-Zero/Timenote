import { describe, expect, it } from "vitest";

import {
  clampSelectedDay,
  dayOptions,
  formatLunarDateLabel,
  lunarMonthOptions,
} from "../../apps/web/src/features/events/dateFieldOptions.js";
import {
  displayedPresetId,
  draftIssues,
  newDraft,
  presetMatches,
  switchChanges,
  withKind,
  withRecurrence,
  withYear,
} from "../../apps/web/src/features/events/eventDraft.js";
import { alarmText, rangeText } from "../../apps/web/src/features/events/occurrenceText.js";
import { setLocale } from "../../apps/web/src/i18n/index.js";
import { expandEvent } from "../../packages/calendar/src/index.js";
import { eventInput } from "../fixtures.js";

const tz = "Asia/Shanghai";

describe("事件表单草稿", () => {
  it("新建草稿使用用户时区的今天和类型对应的默认模板", () => {
    const draft = newDraft("birthday", tz, new Date("2026-10-01T17:00:00Z"));
    expect(draft.date).toMatchObject({ calendar: "gregorian", year: 2026, month: 10, day: 2 });
    expect(draft).toMatchObject({ titleTemplate: "{{name}} {{years}} 岁生日", titlePrefix: "🎂" });
  });

  it("年份未知时默认模板切换为不含岁数的版本，自定义模板保持不变", () => {
    expect(withYear(newDraft("anniversary", tz), null).titleTemplate).toBe("{{name}}纪念日");
    expect(withYear(eventInput({ titleTemplate: "{{name}} 的 {{years}}" }), null).titleTemplate).toBe(
      "{{name}} 的 {{years}}"
    );
  });

  it("切换为普通事件时固定公历并补上年份，默认模板与前缀跟着切换", () => {
    const lunar = withYear(eventInput({ titlePrefix: "🎂", date: { calendar: "lunar", leapMonth: true } }), null);
    const plain = withKind(lunar, "event", tz);
    expect(plain.date).toMatchObject({ calendar: "gregorian", leapMonth: false });
    expect(plain.date.year).toEqual(expect.any(Number));
    expect(plain).toMatchObject({ titleTemplate: "{{name}}", titlePrefix: "" });
  });

  it("英文界面把默认标题和农历月日换成英文，自定义标题保持不变", async () => {
    await setLocale("en");
    try {
      expect(newDraft("birthday", tz).titleTemplate).toBe("{{name}}'s {{years}}th birthday");
      expect(eventInput().titleTemplate).toBe("{{name}} {{years}} 岁生日");
      expect(withYear(eventInput(), null).titleTemplate).toBe("{{name}}生日");
      expect(lunarMonthOptions().find(option => option.value === 9)?.label).toBe("Mo9");
      expect(dayOptions(true, 9).find(option => option.value === 4)?.label).toBe("4");
      expect(dayOptions(false, 2).map(option => option.value)).toHaveLength(29);
      expect(dayOptions(false, 4)).toHaveLength(30);
      expect(dayOptions(false, 1)).toHaveLength(31);
      expect(dayOptions(false, 2).some(option => option.value > 29)).toBe(false);
      expect(clampSelectedDay(false, 2, 31)).toBe(29);
      expect(clampSelectedDay(true, 2, 30)).toBe(30);
      expect(formatLunarDateLabel(9, 4, false)).toBe("Mo9 4");
      expect(formatLunarDateLabel(9, 4, true)).toBe("Mo9bis 4");
    } finally {
      await setLocale("zh-CN");
    }
  });

  it("表单校验与服务端同源：契约错误和农历日期错误都定位到字段", () => {
    expect(draftIssues(eventInput({ name: " " }))).toEqual({ name: "请填写名称" });
    expect(draftIssues(eventInput({ date: { month: 2, day: 30 } }))).toEqual({ "date.day": "该月没有这一天" });
    expect(draftIssues(eventInput({ date: { calendar: "lunar", year: 2025, month: 12, day: 30 } }))).toEqual({
      "date.day": "该农历月只有 29 天",
    });
    expect(draftIssues(eventInput())).toEqual({});
  });

  it("预览文案：跨天显示起止日期，提醒按账号时区显示", () => {
    const [occurrence] = expandEvent(
      eventInput({
        kind: "event",
        titleTemplate: "{{name}}",
        durationDays: 7,
        recurrence: null,
        date: { year: 2026, month: 10, day: 1 },
      }),
      { fromYear: 2026, toYear: 2026 },
      tz,
      "2026-10-02"
    );
    expect(rangeText(occurrence)).toBe("2026年10月1日 周四 至 2026年10月7日 周三");
    expect(alarmText("2026-02-15T01:00:00.000Z", tz)).toBe("2/15 09:00");
  });

  it("五个预设点选后能通过契约，并且匹配自己的形状", () => {
    for (const kind of ["birthday", "anniversary", "holiday", "event", "custom"] as const) {
      const draft = { ...newDraft(kind, tz, new Date("2026-10-01T17:00:00Z")), name: "小明" };
      expect(draftIssues(draft)).toEqual({});
      expect(presetMatches(kind, draft)).toBe(true);
      expect(displayedPresetId(draft)).toBe(kind);
    }

    expect(newDraft("holiday", tz).date.year).toBeNull();
    expect(newDraft("holiday", tz).titleTemplate).toBe("{{name}}");
    expect(newDraft("event", tz).recurrence).toBeNull();
  });

  it("自定义改重复时不改标题；形状超出生日时用自定义字段打开", () => {
    const custom = withRecurrence(
      { ...newDraft("custom", tz), titleTemplate: "{{name}}" },
      { unit: "month", interval: 3, end: { type: "never" } }
    );
    expect(custom.titleTemplate).toBe("{{name}}");
    const monthlyBirthday = eventInput({
      kind: "birthday",
      titleTemplate: "{{name}}第 {{count}} 个月",
      recurrence: { unit: "month", interval: 1, end: { type: "never" } },
    });
    expect(displayedPresetId(monthlyBirthday)).toBe("custom");
  });

  it("会改掉重复或年份的切换需要确认，只改名称时不需要", () => {
    const birthday = newDraft("birthday", tz);
    const holiday = withKind(birthday, "holiday", tz);
    expect(switchChanges(birthday, holiday)).toContain("yearCleared");
    expect(
      switchChanges({ ...birthday, name: "小明" }, withKind({ ...birthday, name: "小明" }, "anniversary", tz))
    ).toEqual([]);
  });
});
