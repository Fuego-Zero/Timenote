import { z } from "zod";

import { issueDetail } from "./error.js";
import {
  calendarSystems,
  feb29Policies,
  gregorianMissingDayPolicies,
  leapMonthPolicies,
  maxAlarms,
  maxDurationDays,
  maxInterval,
  maxKindLength,
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
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, issueDetail("time_format")),
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

const templateSchema = plainText(100, { multiline: false }).pipe(
  z.string().trim().min(1, issueDetail("title_template_required"))
);

const eventFields = z.object({
  /** 界面预设标识。展开与校验不读取它。 */
  kind: plainText(maxKindLength, { multiline: false }).pipe(z.string().trim().min(1, issueDetail("kind_required"))),
  name: plainText(60, { multiline: true }).pipe(z.string().trim().min(1, issueDetail("name_required"))),
  titleTemplate: templateSchema,
  titlePrefix: plainText(16, { multiline: false }).pipe(z.string().trim()),
  note: plainText(500, { multiline: true }),
  date: originalDateSchema,
  durationDays: z
    .int()
    .min(1, issueDetail("duration_before_start"))
    .max(maxDurationDays, issueDetail("duration_max", { n: maxDurationDays })),
  rules: eventRulesSchema,
  alarms: z.array(alarmSchema).max(maxAlarms),
  /** null 表示只发生一次；有对象时按单位、间隔和结束条件重复。 */
  recurrence: recurrenceSchema.nullable(),
  gregorianMissingDay: z.enum(gregorianMissingDayPolicies),
  milestones: z
    .array(z.int().min(1).max(maxMilestoneDays))
    .max(maxMilestones, issueDetail("milestones_max", { n: maxMilestones })),
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

/** 是否为「每 1 年」。年份已知时可用 {{years}}。 */
export function isYearlyEveryYear(recurrence: Recurrence) {
  return recurrence.unit === "year" && recurrence.interval === 1;
}

function isDefaultRecurrence(recurrence: Recurrence) {
  return isYearlyEveryYear(recurrence) && recurrence.end.type === "never";
}

/** 标题模板在该日程下可用的变量：{{years}} 只用于每 1 年且年份已知，{{count}} 只用于其他重复且年份已知。 */
export function titleVariables(value: Pick<EventFields, "date" | "recurrence">): TemplateVariable[] {
  const variables: TemplateVariable[] = ["name"];
  if (value.recurrence === null || value.date.year === null) {
    return variables;
  }

  variables.push(isYearlyEveryYear(value.recurrence) ? "years" : "count");
  return variables;
}

export const milestoneVariables: readonly TemplateVariable[] = ["name", "days"];

function yearsProblem(value: EventFields) {
  if (value.date.year === null) {
    return issueDetail("years_unknown");
  }

  return issueDetail("years_only_yearly");
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
  if (new Set(value.milestones).size !== value.milestones.length) {
    issue(["milestones"], issueDetail("milestones_duplicate"));
  }

  const { recurrence } = value;
  if (recurrence === null) {
    if (value.date.year === null) {
      issue(["date", "year"], issueDetail("event_year_required"));
    }

    return;
  }

  if (recurrence.interval > maxInterval[recurrence.unit]) {
    issue(["recurrence", "interval"], issueDetail("interval_max", { n: maxInterval[recurrence.unit] }));
  }

  if (value.date.calendar === "lunar" && recurrence.unit !== "year") {
    issue(["recurrence", "unit"], issueDetail("lunar_yearly_only"));
  }

  if (value.date.year === null) {
    if (!isDefaultRecurrence(recurrence)) {
      issue(["recurrence"], issueDetail("unknown_year_recurrence"));
    }

    if (value.milestones.length) {
      issue(["milestones"], issueDetail("unknown_year_milestones"));
    }
  }

  if (recurrence.end.type === "until" && value.date.calendar === "gregorian" && value.date.year !== null) {
    const start = `${String(value.date.year).padStart(4, "0")}-${String(value.date.month).padStart(2, "0")}-${String(value.date.day).padStart(2, "0")}`;
    if (recurrence.end.until < start) {
      issue(["recurrence", "end", "until"], issueDetail("until_before_start"));
    }
  }

  // 按年沿用原有上限（持续 ≤ 366 天、提前 ≤ 365 天），按天/周/月不能超过一个最短周期。
  if (recurrence.unit !== "year") {
    const cycle = Math.min(minCycleDays[recurrence.unit], maxDurationDays);
    if (value.durationDays > cycle) {
      issue(["durationDays"], issueDetail("duration_max", { n: cycle }));
    }

    value.alarms.forEach((alarm, index) => {
      if (alarm.daysBefore >= cycle) {
        issue(["alarms", index, "daysBefore"], issueDetail("alarm_before_cycle", { n: cycle }));
      }
    });
  }
}

function refineEvent(value: EventFields, ctx: z.RefinementCtx) {
  const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
  refineTemplates(value, issue);
  refineRecurrence(value, issue);

  if (value.date.calendar === "gregorian") {
    if (value.date.leapMonth) {
      issue(["date", "leapMonth"], issueDetail("no_gregorian_leap"));
    }

    if (value.date.day > daysInGregorianMonth(value.date.year, value.date.month)) {
      issue(["date", "day"], issueDetail("gregorian_day_missing"));
    }
  } else if (value.date.day > 30) {
    issue(["date", "day"], issueDetail("lunar_day_max"));
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
