import { eventDateIssues, todayIn } from "@timenote/calendar";
import {
  type CalendarEvent,
  defaultMilestoneTemplate,
  defaultRecurrenceTemplates,
  defaultTitleTemplates,
  type EventInput,
  eventInputSchema,
  type EventKind,
  isYearlyEveryYear,
  type Recurrence,
} from "@timenote/contracts";

import type { EventTagTone } from "./EventTag.js";

export const kindLabels: Record<EventKind, string> = { birthday: "生日", anniversary: "纪念日", event: "普通事件" };

export const kindTagTones: Record<EventKind, EventTagTone> = {
  birthday: "birthday",
  anniversary: "anniversary",
  event: "general",
};

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

export const yearlyRecurrence: Recurrence = { unit: "year", interval: 1, end: { type: "never" } };

const recurrenceTemplates: readonly string[] = Object.values(defaultRecurrenceTemplates);

function isDefaultTemplate(template: string) {
  return (
    recurrenceTemplates.includes(template) ||
    Object.values(defaultTitleTemplates).some(pair => pair.withYears === template || pair.withoutYears === template)
  );
}

/** 默认标题：纪念日非「每 1 年」且年份已知时按周期选 {{count}} 模板，其余沿用类型默认。 */
function defaultTemplate(draft: Pick<EventInput, "date" | "kind" | "recurrence">) {
  const yearKnown = draft.date.year !== null;
  const { unit, interval } = draft.recurrence;
  if (draft.kind === "anniversary" && yearKnown && !isYearlyEveryYear(draft.recurrence)) {
    if (unit === "year") {
      return defaultRecurrenceTemplates.everyNYears;
    }

    if (interval === 1 && unit === "week") {
      return defaultRecurrenceTemplates.weekly;
    }

    return interval === 1 && unit === "month" ? defaultRecurrenceTemplates.monthly : defaultRecurrenceTemplates.other;
  }

  return yearKnown ? defaultTitleTemplates[draft.kind].withYears : defaultTitleTemplates[draft.kind].withoutYears;
}

/** 只在模板仍是默认值时随规则切换，自定义模板保持不变。 */
function retitle(draft: EventInput): EventInput {
  return isDefaultTemplate(draft.titleTemplate) ? { ...draft, titleTemplate: defaultTemplate(draft) } : draft;
}

/**
 * 让重复规则符合类型与日期：非纪念日固定每 1 年且无里程碑；年份未知同样只能每年、永不结束且无里程碑；
 * 农历只能按年。reset 表示把纪念日原来的非按年规则改回了每年，需要提示用户。
 */
export function normalizeRecurrence(draft: EventInput): { draft: EventInput; reset: boolean } {
  const { recurrence } = draft;
  if (draft.kind !== "anniversary" || draft.date.year === null) {
    const changed = !isYearlyEveryYear(recurrence) || recurrence.end.type !== "never" || draft.milestones.length > 0;
    const next = changed ? { ...draft, recurrence: yearlyRecurrence, milestones: [] } : draft;
    return { draft: retitle(next), reset: draft.kind === "anniversary" && recurrence.unit !== "year" };
  }

  if (draft.date.calendar === "lunar" && recurrence.unit !== "year") {
    return { draft: retitle({ ...draft, recurrence: { ...recurrence, unit: "year", interval: 1 } }), reset: true };
  }

  return { draft: retitle(draft), reset: false };
}

export function withRecurrence(draft: EventInput, recurrence: Recurrence): EventInput {
  return retitle({ ...draft, recurrence });
}

/** 切换类型时，用户没改过的默认模板和前缀跟着切换；普通事件固定公历且必须有年份。 */
export function withKind(draft: EventInput, kind: EventKind, timeZone: string): EventInput {
  const fallbackYear = Number(todayIn(new Date(), timeZone).slice(0, 4));
  const date =
    kind === "event"
      ? { ...draft.date, calendar: "gregorian" as const, leapMonth: false, year: draft.date.year ?? fallbackYear }
      : draft.date;
  return normalizeRecurrence({
    ...draft,
    kind,
    date,
    titlePrefix: Object.values(defaultPrefixes).includes(draft.titlePrefix) ? defaultPrefixes[kind] : draft.titlePrefix,
  }).draft;
}

/** 年份未知时隐藏数字：默认模板切到不含 {{years}} 的版本。 */
export function withYear(draft: EventInput, year: number | null): EventInput {
  return retitle({ ...draft, date: { ...draft.date, year } });
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
