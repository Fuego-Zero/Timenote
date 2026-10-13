import { eventDateIssues, todayIn } from "@timenote/calendar";
import {
  type CalendarEvent,
  defaultMilestoneTemplate,
  defaultTitleTemplates,
  type EventInput,
  eventInputSchema,
  type EventKind,
} from "@timenote/contracts";

export const kindLabels: Record<EventKind, string> = { birthday: "生日", anniversary: "纪念日", event: "普通事件" };

const defaultPrefixes: Record<EventKind, string> = { birthday: "🎂", anniversary: "💞", event: "" };

export function newDraft(kind: EventKind, timeZone: string, now = new Date()): EventInput {
  const [year, month, day] = todayIn(now, timeZone).split("-").map(Number);
  return {
    kind,
    name: "",
    titleTemplate: defaultTitleTemplates[kind].withYears,
    titlePrefix: defaultPrefixes[kind],
    note: "",
    date: { calendar: "gregorian", year, month, day, leapMonth: false },
    durationDays: 1,
    rules: { feb29: "feb28", leapMonth: "regular", missingDay: "lastDay" },
    alarms: [],
    recurrence: { unit: "year", interval: 1, end: { type: "never" } },
    gregorianMissingDay: "lastDay",
    milestones: [],
    milestoneTemplate: defaultMilestoneTemplate,
  };
}

export function draftFromEvent(event: CalendarEvent): EventInput {
  const {
    kind,
    name,
    titleTemplate,
    titlePrefix,
    note,
    date,
    durationDays,
    rules,
    alarms,
    recurrence,
    gregorianMissingDay,
    milestones,
    milestoneTemplate,
  } = event;
  return {
    kind,
    name,
    titleTemplate,
    titlePrefix,
    note,
    date,
    durationDays,
    rules,
    alarms,
    recurrence,
    gregorianMissingDay,
    milestones,
    milestoneTemplate,
  };
}

function isDefaultTemplate(template: string) {
  return Object.values(defaultTitleTemplates).some(
    pair => pair.withYears === template || pair.withoutYears === template
  );
}

function defaultTemplate(kind: EventKind, yearKnown: boolean) {
  return yearKnown ? defaultTitleTemplates[kind].withYears : defaultTitleTemplates[kind].withoutYears;
}

/** 切换类型时，用户没改过的默认模板和前缀跟着切换；普通事件固定公历且必须有年份。 */
export function withKind(draft: EventInput, kind: EventKind, timeZone: string): EventInput {
  const fallbackYear = Number(todayIn(new Date(), timeZone).slice(0, 4));
  const date =
    kind === "event"
      ? { ...draft.date, calendar: "gregorian" as const, leapMonth: false, year: draft.date.year ?? fallbackYear }
      : draft.date;
  return {
    ...draft,
    kind,
    date,
    titleTemplate: isDefaultTemplate(draft.titleTemplate)
      ? defaultTemplate(kind, date.year !== null)
      : draft.titleTemplate,
    titlePrefix: Object.values(defaultPrefixes).includes(draft.titlePrefix) ? defaultPrefixes[kind] : draft.titlePrefix,
  };
}

/** 年份未知时隐藏数字：默认模板切到不含 {{years}} 的版本。 */
export function withYear(draft: EventInput, year: number | null): EventInput {
  return {
    ...draft,
    date: { ...draft.date, year },
    titleTemplate: isDefaultTemplate(draft.titleTemplate)
      ? defaultTemplate(draft.kind, year !== null)
      : draft.titleTemplate,
  };
}

/** 与服务端同一套校验：契约 Schema + 日历库校验，返回字段路径到提示。 */
export function draftIssues(draft: EventInput): Record<string, string> {
  const parsed = eventInputSchema.safeParse(draft);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".")] ??= issue.message;
    }

    return fields;
  }

  try {
    return eventDateIssues(parsed.data);
  } catch (error) {
    return { "date.year": error instanceof Error ? error.message : "日期超出支持范围" };
  }
}
