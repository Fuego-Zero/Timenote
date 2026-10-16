import { describe, expect, it } from "vitest";

import {
  dayOptions,
  formatLunarDateLabel,
  lunarMonthOptions,
} from "../../apps/web/src/features/events/dateFieldOptions.js";
import { draftIssues, newDraft, withKind, withYear } from "../../apps/web/src/features/events/eventDraft.js";
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
        date: { year: 2026, month: 10, day: 1 },
      }),
      { fromYear: 2026, toYear: 2026 },
      tz,
      "2026-10-02"
    );
    expect(rangeText(occurrence)).toBe("2026年10月1日 周四 至 2026年10月7日 周三");
    expect(alarmText("2026-02-15T01:00:00.000Z", tz)).toBe("2/15 09:00");
  });
});
