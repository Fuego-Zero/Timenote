import { z } from "zod";

export const eventKinds = ["birthday", "anniversary", "event"] as const;
export const calendarSystems = ["gregorian", "lunar"] as const;
export const feb29Policies = ["feb28", "mar1", "skip"] as const;
export const leapMonthPolicies = ["regular", "skip"] as const;
export const missingDayPolicies = ["lastDay", "skip"] as const;

export type EventKind = (typeof eventKinds)[number];
export type CalendarSystem = (typeof calendarSystems)[number];

export const maxAlarms = 2;
export const maxDurationDays = 366;

/** 标题模板只允许这两个变量，其他 `{{…}}` 或孤立花括号一律拒绝。 */
export const templateVariables = ["name", "years"] as const;

export const defaultTitleTemplates: Record<EventKind, { withYears: string; withoutYears: string }> = {
  birthday: { withYears: "{{name}} {{years}} 岁生日", withoutYears: "{{name}}生日" },
  anniversary: { withYears: "{{name}}第 {{years}} 周年", withoutYears: "{{name}}纪念日" },
  event: { withYears: "{{name}}", withoutYears: "{{name}}" },
};

/** 除多行字段允许的换行外，拒绝所有 C0 控制字符和 DEL，防止注入 ICS 属性或干扰显示。 */
function hasForbiddenControl(value: string, multiline: boolean) {
  for (const char of value) {
    const code = char.codePointAt(0)!;
    if ((code < 0x20 || code === 0x7f) && !(multiline && char === "\n")) {
      return true;
    }
  }

  return false;
}

function plainText(max: number, options: { multiline: boolean }) {
  return z
    .string()
    .max(max)
    .refine(value => !hasForbiddenControl(value, options.multiline), "包含不允许的控制字符");
}

export function templateIssue(template: string): string | undefined {
  const stripped = template.replaceAll("{{name}}", "").replaceAll("{{years}}", "");
  if (stripped.includes("{") || stripped.includes("}")) {
    return "模板只支持 {{name}} 和 {{years}}";
  }

  return undefined;
}

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

export const eventListSchema = z.object({ events: z.array(eventSchema) });
