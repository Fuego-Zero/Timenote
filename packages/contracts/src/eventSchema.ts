import { z } from "zod";

import {
  calendarSystems,
  eventKinds,
  feb29Policies,
  gregorianMissingDayPolicies,
  leapMonthPolicies,
  maxAlarms,
  maxDurationDays,
  maxInterval,
  maxMilestoneDays,
  maxMilestones,
  maxRecurrenceCount,
  minCycleDays,
  missingDayPolicies,
  recurrenceUnits,
} from "./eventEnums.js";
import { plainText } from "./eventText.js";
import { templateIssue, type TemplateVariable, usedVariables } from "./titleTemplate.js";

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

const isoDateSchema = z.iso.date();

/** 结束条件：永不、共 N 个周期（被跳过的周期也计数）、截止到某天（含当天开始的那次）。 */
export const recurrenceEndSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("never") }),
  z.object({ type: z.literal("count"), count: z.int().min(1).max(maxRecurrenceCount) }),
  z.object({ type: z.literal("until"), until: isoDateSchema }),
]);

export const recurrenceSchema = z.object({
  unit: z.enum(recurrenceUnits),
  interval: z.int().min(1),
  end: recurrenceEndSchema,
});
export type Recurrence = z.infer<typeof recurrenceSchema>;

const templateSchema = plainText(100, { multiline: false }).pipe(z.string().trim().min(1, "请填写标题模板"));

const eventFields = z.object({
  kind: z.enum(eventKinds),
  name: plainText(60, { multiline: true }).pipe(z.string().trim().min(1, "请填写名称")),
  titleTemplate: templateSchema,
  titlePrefix: plainText(16, { multiline: false }).pipe(z.string().trim()),
  note: plainText(500, { multiline: true }),
  date: originalDateSchema,
  durationDays: z.int().min(1, "最后一天不能早于开始日期").max(maxDurationDays, `最多持续 ${maxDurationDays} 天`),
  rules: eventRulesSchema,
  alarms: z.array(alarmSchema).max(maxAlarms),
  recurrence: recurrenceSchema,
  gregorianMissingDay: z.enum(gregorianMissingDayPolicies),
  milestones: z.array(z.int().min(1).max(maxMilestoneDays)).max(maxMilestones, `最多 ${maxMilestones} 个里程碑`),
  milestoneTemplate: templateSchema,
});

type EventFields = z.infer<typeof eventFields>;

/** Schema 校验用的公历月天数；发生日展开仍只在 packages/calendar。 */
function daysInGregorianMonth(year: number | null, month: number) {
  if (month === 2) {
    return year === null || (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** 是否为默认规则「每 1 年、永不结束」；生日、普通事件和年份未知的事件只能用它。 */
export function isYearlyEveryYear(recurrence: Recurrence) {
  return recurrence.unit === "year" && recurrence.interval === 1;
}

function isDefaultRecurrence(recurrence: Recurrence) {
  return isYearlyEveryYear(recurrence) && recurrence.end.type === "never";
}

/** 标题模板在该事件规则下可用的变量：{{years}} 只用于每 1 年且年份已知，{{count}} 只用于纪念日非每 1 年且年份已知。 */
export function titleVariables(value: Pick<EventFields, "kind" | "date" | "recurrence">): TemplateVariable[] {
  const variables: TemplateVariable[] = ["name"];
  if (value.kind === "event" || value.date.year === null) {
    return variables;
  }

  if (isYearlyEveryYear(value.recurrence)) {
    variables.push("years");
  } else if (value.kind === "anniversary") {
    variables.push("count");
  }

  return variables;
}

export const milestoneVariables: readonly TemplateVariable[] = ["name", "days"];

function yearsProblem(value: EventFields) {
  if (value.kind === "event") {
    return "普通事件没有周年数，模板不能使用 {{years}}";
  }

  if (value.date.year === null) {
    return "年份未知时模板不能使用 {{years}}";
  }

  return "只有每 1 年重复时模板才能使用 {{years}}";
}

function refineTemplates(value: EventFields, issue: (path: (string | number)[], message: string) => void) {
  const allowed = titleVariables(value);
  const misplaced = usedVariables(value.titleTemplate).filter(variable => !allowed.includes(variable));
  const templateProblem = templateIssue(value.titleTemplate, allowed);
  if (misplaced.includes("years")) {
    issue(["titleTemplate"], yearsProblem(value));
  } else if (templateProblem) {
    issue(["titleTemplate"], templateProblem);
  }

  const milestoneProblem = templateIssue(value.milestoneTemplate, milestoneVariables);
  if (milestoneProblem) {
    issue(["milestoneTemplate"], milestoneProblem);
  }
}

function refineRecurrence(value: EventFields, issue: (path: (string | number)[], message: string) => void) {
  const { recurrence } = value;
  if (value.kind !== "anniversary" && !isDefaultRecurrence(recurrence)) {
    issue(["recurrence"], "只有纪念日可以设置重复规则");
  }

  if (value.kind !== "anniversary" && value.milestones.length) {
    issue(["milestones"], "只有纪念日可以设置里程碑");
  }

  if (recurrence.interval > maxInterval[recurrence.unit]) {
    issue(["recurrence", "interval"], `间隔最多 ${maxInterval[recurrence.unit]}`);
  }

  if (value.date.calendar === "lunar" && recurrence.unit !== "year") {
    issue(["recurrence", "unit"], "农历日期只能按年重复");
  }

  if (value.date.year === null) {
    if (!isDefaultRecurrence(recurrence)) {
      issue(["recurrence"], "年份未知时只能每年重复且永不结束");
    }

    if (value.milestones.length) {
      issue(["milestones"], "年份未知时不能设置里程碑");
    }
  }

  if (recurrence.end.type === "until" && value.date.calendar === "gregorian" && value.date.year !== null) {
    const start = `${String(value.date.year).padStart(4, "0")}-${String(value.date.month).padStart(2, "0")}-${String(value.date.day).padStart(2, "0")}`;
    if (recurrence.end.until < start) {
      issue(["recurrence", "end", "until"], "截止日期不能早于开始日期");
    }
  }

  // 按年沿用原有上限（持续 ≤ 366 天、提前 ≤ 365 天），按天/周/月不能超过一个最短周期。
  if (recurrence.unit !== "year") {
    const cycle = Math.min(minCycleDays[recurrence.unit], maxDurationDays);
    if (value.durationDays > cycle) {
      issue(["durationDays"], `最多持续 ${cycle} 天`);
    }

    value.alarms.forEach((alarm, index) => {
      if (alarm.daysBefore >= cycle) {
        issue(["alarms", index, "daysBefore"], `提前天数必须小于 ${cycle}`);
      }
    });
  }

  if (new Set(value.milestones).size !== value.milestones.length) {
    issue(["milestones"], "里程碑天数不能重复");
  }
}

function refineEvent(value: EventFields, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  refineTemplates(value, issue);
  refineRecurrence(value, issue);
  // 本提交只落数据结构，非默认规则与里程碑在日历展开就绪后放开。
  if (!isDefaultRecurrence(value.recurrence) || value.milestones.length) {
    issue(["recurrence"], "暂不支持重复规则和里程碑");
  }

  if (value.kind === "event") {
    if (value.date.calendar !== "gregorian") {
      issue(["date", "calendar"], "普通事件只支持公历日期");
    }

    if (value.date.year === null) {
      issue(["date", "year"], "普通事件必须填写年份");
    }
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
