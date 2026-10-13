import { z } from "zod";

import {
  calendarSystems,
  eventKinds,
  feb29Policies,
  leapMonthPolicies,
  maxAlarms,
  maxDurationDays,
  missingDayPolicies,
} from "./eventEnums.js";
import { plainText } from "./eventText.js";
import { templateIssue } from "./titleTemplate.js";

export const alarmSchema = z.object({
  daysBefore: z.int().min(0).max(365),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "时间格式为 HH:mm"),
});

export const originalDateSchema = z.object({
  calendar: z.enum(calendarSystems),
  /** null 表示年份未知；不使用假年份参与周年计算。 */
  year: z.int().min(1).max(9999).nullable(),
  month: z.int().min(1).max(12),
  day: z.int().min(1).max(31),
  /** 仅农历有效：原始日期是否在闰月。 */
  leapMonth: z.boolean(),
});

export const eventRulesSchema = z.object({
  feb29: z.enum(feb29Policies),
  leapMonth: z.enum(leapMonthPolicies),
  missingDay: z.enum(missingDayPolicies),
});

const eventFields = z.object({
  kind: z.enum(eventKinds),
  name: plainText(60, { multiline: true }).pipe(z.string().trim().min(1, "请填写名称")),
  titleTemplate: plainText(100, { multiline: false }).pipe(z.string().trim().min(1, "请填写标题模板")),
  titlePrefix: plainText(16, { multiline: false }).pipe(z.string().trim()),
  note: plainText(500, { multiline: true }),
  date: originalDateSchema,
  durationDays: z.int().min(1, "最后一天不能早于开始日期").max(maxDurationDays, `最多持续 ${maxDurationDays} 天`),
  rules: eventRulesSchema,
  alarms: z.array(alarmSchema).max(maxAlarms),
});

type EventFields = z.infer<typeof eventFields>;

/** Schema 校验用的公历月天数；发生日展开仍只在 packages/calendar。 */
function daysInGregorianMonth(year: number | null, month: number) {
  if (month === 2) {
    return year === null || (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function refineEvent(value: EventFields, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  const templateProblem = templateIssue(value.titleTemplate);
  if (templateProblem) {
    issue(["titleTemplate"], templateProblem);
  }

  const usesYears = value.titleTemplate.includes("{{years}}");
  if (value.kind === "event") {
    if (value.date.calendar !== "gregorian") {
      issue(["date", "calendar"], "普通事件只支持公历日期");
    }

    if (value.date.year === null) {
      issue(["date", "year"], "普通事件必须填写年份");
    }

    if (usesYears) {
      issue(["titleTemplate"], "普通事件没有周年数，模板不能使用 {{years}}");
    }
  } else if (value.date.year === null && usesYears) {
    issue(["titleTemplate"], "年份未知时模板不能使用 {{years}}");
  }

  if (value.date.calendar === "gregorian") {
    if (value.date.leapMonth) {
      issue(["date", "leapMonth"], "公历日期没有闰月");
    }

    if (value.date.day > daysInGregorianMonth(value.date.year, value.date.month)) {
      issue(["date", "day"], "该月没有这一天");
    }
  } else if (value.date.day > 30) {
    issue(["date", "day"], "农历每月最多 30 天");
  }
}

/** 事件的可编辑内容；网页表单、API 请求和备份文件共用。 */
export const eventInputSchema = eventFields.superRefine(refineEvent);
export type EventInput = z.infer<typeof eventInputSchema>;

export const eventSchema = eventFields
  .extend({
    id: z.uuid(),
    ownerId: z.string().min(1),
    /** 每次修改递增，作为订阅里的 SEQUENCE。 */
    revision: z.int().min(0),
    createdAt: z.int().positive(),
    updatedAt: z.int().positive(),
  })
  .superRefine(refineEvent);
export type CalendarEvent = z.infer<typeof eventSchema>;
