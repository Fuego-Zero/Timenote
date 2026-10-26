import { todayIn } from "@timenote/calendar";
import {
  defaultMilestoneTemplate,
  defaultRecurrenceTemplates,
  defaultTitleTemplates,
  type EventInput,
  isYearlyEveryYear,
  type Recurrence,
} from "@timenote/contracts";

import { i18n, localeRegistry } from "../../i18n/index.js";
import type { EventTagTone } from "./EventTag.js";

export const presetIds = ["birthday", "anniversary", "holiday", "event", "custom"] as const;
export type PresetId = (typeof presetIds)[number];

const templateKeys = [
  "birthdayYears",
  "birthday",
  "anniversaryYears",
  "anniversary",
  "event",
  "everyNYears",
  "weekly",
  "monthly",
  "other",
  "milestone",
] as const;

type TemplateKey = (typeof templateKeys)[number];

function templateText(key: TemplateKey, lng?: string) {
  return i18n.t(`templates.${key}`, { ns: "events", lng });
}

function knownDefaultTemplates() {
  const templates = new Set<string>([
    ...Object.values(defaultTitleTemplates).flatMap(pair => [pair.withYears, pair.withoutYears]),
    ...Object.values(defaultRecurrenceTemplates),
    defaultMilestoneTemplate,
  ]);
  for (const locale of localeRegistry) {
    for (const key of templateKeys) {
      templates.add(templateText(key, locale.code));
    }
  }

  return templates;
}

function isDefaultTemplate(template: string) {
  return knownDefaultTemplates().has(template);
}

/** 已保存的默认模板属于哪种界面语言；自定义模板返回 undefined。 */
function templateLocale(template: string) {
  for (const locale of localeRegistry) {
    for (const key of templateKeys) {
      if (templateText(key, locale.code) === template) {
        return locale.code;
      }
    }
  }

  return undefined;
}

export const yearlyRecurrence: Recurrence = { unit: "year", interval: 1, end: { type: "never" } };

function isYearlyNever(recurrence: Recurrence | null): recurrence is Recurrence {
  return recurrence !== null && isYearlyEveryYear(recurrence) && recurrence.end.type === "never";
}

/** 生日和纪念日的默认标题会随规则变；节日、普通事件和自定义保持用户写下的标题。 */
function shouldRetitle(draft: EventInput) {
  return draft.kind === "birthday" || draft.kind === "anniversary";
}

/** 默认标题：纪念日非「每 1 年」且年份已知时按周期选 {{count}} 模板，其余沿用类型默认。 */
function defaultTemplate(draft: Pick<EventInput, "date" | "kind" | "recurrence">, lng?: string) {
  const { date, recurrence } = draft;
  const yearKnown = date.year !== null;
  if (draft.kind === "anniversary" && recurrence !== null && yearKnown && !isYearlyEveryYear(recurrence)) {
    const { unit, interval } = recurrence;
    if (unit === "year") {
      return templateText("everyNYears", lng);
    }

    if (interval === 1 && unit === "week") {
      return templateText("weekly", lng);
    }

    return interval === 1 && unit === "month" ? templateText("monthly", lng) : templateText("other", lng);
  }

  if (draft.kind === "birthday") {
    return templateText(yearKnown ? "birthdayYears" : "birthday", lng);
  }

  if (draft.kind === "anniversary") {
    return templateText(yearKnown ? "anniversaryYears" : "anniversary", lng);
  }

  return templateText("event", lng);
}

/** 只在模板仍是默认值时随规则切换，并留在该模板原来的语言里。 */
function retitle(draft: EventInput): EventInput {
  if (!shouldRetitle(draft) || !isDefaultTemplate(draft.titleTemplate)) {
    return draft;
  }

  return { ...draft, titleTemplate: defaultTemplate(draft, templateLocale(draft.titleTemplate)) };
}

function replaceDefaultTitle(draft: EventInput, key: TemplateKey): EventInput {
  if (!isDefaultTemplate(draft.titleTemplate)) {
    return draft;
  }

  return { ...draft, titleTemplate: templateText(key, templateLocale(draft.titleTemplate)) };
}

const defaultPrefixValues = ["", "🎂", "💞"];

function prefixFor(draft: EventInput, next: string) {
  return defaultPrefixValues.includes(draft.titlePrefix) ? next : draft.titlePrefix;
}

/**
 * 让重复符合日期：年份未知时只能每年、永不结束且无里程碑；农历只能按年。
 * reset 表示原来的按天/周/月被改回了每年，需要提示用户。
 */
export function normalizeRecurrence(draft: EventInput): { draft: EventInput; reset: boolean } {
  const { recurrence } = draft;
  if (recurrence === null) {
    return { draft: retitle(draft), reset: false };
  }

  if (draft.date.year === null) {
    const changed = !isYearlyEveryYear(recurrence) || recurrence.end.type !== "never" || draft.milestones.length > 0;
    const next = changed ? { ...draft, recurrence: yearlyRecurrence, milestones: [] } : draft;
    return { draft: retitle(next), reset: recurrence.unit !== "year" };
  }

  if (draft.date.calendar === "lunar" && recurrence.unit !== "year") {
    return { draft: retitle({ ...draft, recurrence: { ...recurrence, unit: "year", interval: 1 } }), reset: true };
  }

  return { draft: retitle(draft), reset: false };
}

export function withRecurrence(draft: EventInput, recurrence: Recurrence | null): EventInput {
  return retitle({ ...draft, recurrence });
}

/** 年份未知时隐藏数字：会自动改标题的预设切到不含 {{years}} 的版本。 */
export function withYear(draft: EventInput, year: number | null): EventInput {
  return normalizeRecurrence({ ...draft, date: { ...draft.date, year } }).draft;
}

export interface PresetView {
  allowOnce: boolean;
  showsCalendar: boolean;
  showsMilestones: boolean;
  showsRecurrence: boolean;
  showsYearUnknown: boolean;
}

export const presetViews: Record<PresetId, PresetView> = {
  birthday: {
    allowOnce: false,
    showsCalendar: true,
    showsMilestones: false,
    showsRecurrence: false,
    showsYearUnknown: true,
  },
  anniversary: {
    allowOnce: false,
    showsCalendar: true,
    showsMilestones: true,
    showsRecurrence: true,
    showsYearUnknown: true,
  },
  holiday: {
    allowOnce: false,
    showsCalendar: true,
    showsMilestones: false,
    showsRecurrence: false,
    showsYearUnknown: false,
  },
  event: {
    allowOnce: false,
    showsCalendar: false,
    showsMilestones: false,
    showsRecurrence: false,
    showsYearUnknown: false,
  },
  custom: {
    allowOnce: true,
    showsCalendar: true,
    showsMilestones: true,
    showsRecurrence: true,
    showsYearUnknown: true,
  },
};

function blankDraft(timeZone: string, now: Date): EventInput {
  const [year, month, day] = todayIn(now, timeZone).split("-").map(Number);
  return {
    kind: "birthday",
    name: "",
    titleTemplate: templateText("birthdayYears"),
    titlePrefix: "🎂",
    note: "",
    date: { calendar: "gregorian", year, month, day, leapMonth: false },
    durationDays: 1,
    rules: { feb29: "feb28", leapMonth: "regular", missingDay: "lastDay" },
    alarms: [],
    recurrence: yearlyRecurrence,
    gregorianMissingDay: "lastDay",
    milestones: [],
    milestoneTemplate: templateText("milestone"),
  };
}

function applyBirthday(draft: EventInput): EventInput {
  const next = replaceDefaultTitle(
    {
      ...draft,
      kind: "birthday",
      recurrence: yearlyRecurrence,
      milestones: [],
      titlePrefix: prefixFor(draft, "🎂"),
    },
    draft.date.year === null ? "birthday" : "birthdayYears"
  );
  return next;
}

function applyAnniversary(draft: EventInput): EventInput {
  return {
    ...draft,
    kind: "anniversary",
    recurrence: draft.recurrence ?? yearlyRecurrence,
    titlePrefix: prefixFor(draft, "💞"),
  };
}

function applyHoliday(draft: EventInput): EventInput {
  return replaceDefaultTitle(
    {
      ...draft,
      kind: "holiday",
      date: { ...draft.date, year: null },
      recurrence: yearlyRecurrence,
      milestones: [],
      titlePrefix: prefixFor(draft, ""),
    },
    "event"
  );
}

function applyEvent(draft: EventInput, timeZone: string): EventInput {
  const fallbackYear = Number(todayIn(new Date(), timeZone).slice(0, 4));
  return replaceDefaultTitle(
    {
      ...draft,
      kind: "event",
      date: {
        ...draft.date,
        calendar: "gregorian",
        leapMonth: false,
        year: draft.date.year ?? fallbackYear,
      },
      recurrence: null,
      milestones: [],
      titlePrefix: prefixFor(draft, ""),
    },
    "event"
  );
}

function applyCustom(draft: EventInput): EventInput {
  return { ...draft, kind: "custom" };
}

/** 点选类型时写入对应日程。结果再经 normalizeRecurrence，保证农历和年份未知仍合法。 */
function presetDraft(draft: EventInput, kind: PresetId, timeZone: string): EventInput {
  if (kind === "birthday") {
    return applyBirthday(draft);
  }

  if (kind === "anniversary") {
    return applyAnniversary(draft);
  }

  if (kind === "holiday") {
    return applyHoliday(draft);
  }

  if (kind === "event") {
    return applyEvent(draft, timeZone);
  }

  return applyCustom(draft);
}

export function applyPreset(draft: EventInput, kind: PresetId, timeZone: string): EventInput {
  return normalizeRecurrence(presetDraft(draft, kind, timeZone)).draft;
}

export function presetMatches(kind: PresetId, draft: EventInput) {
  if (kind === "birthday") {
    return isYearlyNever(draft.recurrence) && draft.milestones.length === 0;
  }

  if (kind === "anniversary") {
    return (
      draft.recurrence !== null &&
      (draft.date.calendar !== "lunar" || draft.recurrence.unit === "year") &&
      (draft.date.year !== null || (isYearlyNever(draft.recurrence) && draft.milestones.length === 0))
    );
  }

  if (kind === "holiday") {
    return draft.date.year === null && isYearlyNever(draft.recurrence) && draft.milestones.length === 0;
  }

  if (kind === "event") {
    return (
      draft.recurrence === null &&
      draft.date.calendar === "gregorian" &&
      draft.date.year !== null &&
      !draft.date.leapMonth &&
      draft.milestones.length === 0
    );
  }

  return true;
}

/** 打开已保存事件时用的表单。形状超出该预设，或不认识的标识，都用自定义的字段集。 */
export function displayedPresetId(draft: EventInput): PresetId {
  if (draft.kind === "custom") {
    return "custom";
  }

  const known = presetIds.find(id => id === draft.kind);
  if (known && presetMatches(known, draft)) {
    return known;
  }

  return "custom";
}

/** 因形状不匹配而显示自定义时，保存才把标识写成 custom。 */
export function draftForSave(draft: EventInput): EventInput {
  const shown = displayedPresetId(draft);
  return shown === draft.kind ? draft : { ...draft, kind: shown };
}

export type SwitchChange = "once" | "yearly" | "recurrence" | "milestones" | "yearCleared" | "yearSet" | "gregorian";

/** 这次切换会改掉的日程部分；为空则不必确认。 */
export function switchChanges(current: EventInput, next: EventInput): SwitchChange[] {
  const changes: SwitchChange[] = [];
  if (JSON.stringify(current.recurrence) !== JSON.stringify(next.recurrence)) {
    if (next.recurrence === null) {
      changes.push("once");
    } else if (isYearlyNever(next.recurrence)) {
      changes.push("yearly");
    } else {
      changes.push("recurrence");
    }
  }

  if (current.milestones.length > 0 && next.milestones.length === 0) {
    changes.push("milestones");
  }

  if (current.date.year !== null && next.date.year === null) {
    changes.push("yearCleared");
  } else if (current.date.year === null && next.date.year !== null) {
    changes.push("yearSet");
  }

  if (current.date.calendar !== "gregorian" && next.date.calendar === "gregorian") {
    changes.push("gregorian");
  }

  return changes;
}

export function newDraft(kind: PresetId, timeZone: string, now = new Date()): EventInput {
  return applyPreset(blankDraft(timeZone, now), kind, timeZone);
}

/** 与 withKind 相同，测试和旧调用沿用这个名字。 */
export function withKind(draft: EventInput, kind: PresetId, timeZone: string): EventInput {
  return applyPreset(draft, kind, timeZone);
}

const tagTones: Record<PresetId, EventTagTone> = {
  birthday: "birthday",
  anniversary: "anniversary",
  holiday: "holiday",
  event: "general",
  custom: "custom",
};

export function kindTone(kind: string): EventTagTone {
  return tagTones[kind as PresetId] ?? "general";
}

export function kindLabel(kind: string) {
  return i18n.t(`kind.${kind}`, { ns: "events", defaultValue: kind });
}

export function kindLabels(): Record<PresetId, string> {
  return {
    birthday: kindLabel("birthday"),
    anniversary: kindLabel("anniversary"),
    holiday: kindLabel("holiday"),
    event: kindLabel("event"),
    custom: kindLabel("custom"),
  };
}
