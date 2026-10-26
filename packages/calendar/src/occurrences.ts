import { TZDate } from "@date-fns/tz";
import {
  type EventInput,
  issueDetail,
  isYearlyEveryYear,
  maxFutureOccurrences,
  maxPastOccurrences,
} from "@timenote/contracts";

import { alarmInstant, type AlarmTime } from "./alarms.js";
import { addDays, compareIsoDate, type IsoDate, isoDate } from "./dates.js";
import { gregorianStart } from "./gregorian.js";
import { LUNAR_MAX_YEAR, lunarStart } from "./lunar.js";
import { milestoneDates } from "./milestones.js";
import { cycleStart, firstCycleAtOrAfter, pastEnd, withinEnd } from "./recurrence.js";
import { renderTitle, type TitleValues } from "./title.js";

export interface Occurrence {
  alarms: AlarmTime[];
  /** 排他结束日，对应 ICS 全天事件的 DTEND。 */
  end: IsoDate;
  /** 订阅 UID 中事件 ID 之后的部分：按年为逻辑年份，按天/周/月为 k{序号}，里程碑为 m{天数}。 */
  key: string;
  /** 包含当天的最后一天。 */
  lastDay: IsoDate;
  /** 逻辑年份：公历事件为公历年，农历事件为目标农历年；按天/周/月与里程碑为开始日所在公历年。 */
  logicalYear: number;
  start: IsoDate;
  title: string;
  years: number | null;
}

export interface YearWindow {
  fromYear: number;
  toYear: number;
}

/** 用户时区的当前年份；订阅窗口与「今天」都以用户时区为准。 */
export function currentYearIn(now: Date, timeZone: string) {
  return new TZDate(now.getTime(), timeZone).getFullYear();
}

export function todayIn(now: Date, timeZone: string): IsoDate {
  const local = new TZDate(now.getTime(), timeZone);
  return isoDate(local.getFullYear(), local.getMonth() + 1, local.getDate());
}

export function feedWindow(now: Date, timeZone: string, pastYears: number, futureYears: number): YearWindow {
  const year = currentYearIn(now, timeZone);
  return { fromYear: year - pastYears, toYear: year + futureYears };
}

function build(
  event: EventInput,
  parts: { durationDays: number; key: string; logicalYear: number; start: IsoDate; template: string },
  values: TitleValues,
  timeZone: string
): Occurrence {
  const { start } = parts;
  return {
    key: parts.key,
    logicalYear: parts.logicalYear,
    start,
    lastDay: addDays(start, parts.durationDays - 1),
    end: addDays(start, parts.durationDays),
    years: values.years ?? null,
    title: renderTitle(event, parts.template, values),
    alarms: event.alarms.map(alarm => alarmInstant(start, alarm, timeZone)),
  };
}

type RepeatingEvent = Omit<EventInput, "recurrence"> & { recurrence: NonNullable<EventInput["recurrence"]> };

/** 按年重复（含隔 N 年）的某个逻辑年份；不在重复序列或超出结束条件时返回 null。 */
function yearlyOccurrence(event: RepeatingEvent, logicalYear: number, timeZone: string): Occurrence | null {
  const { date, recurrence } = event;
  let years: number | null = null;
  if (date.year !== null) {
    years = logicalYear - date.year;
    // 周年从第 1 年开始生成，不生成第 0 周年或原始日期之前的年份。
    if (years < 1 || years % recurrence.interval !== 0) {
      return null;
    }
  }

  const start =
    date.calendar === "lunar"
      ? lunarStart(date, event.rules, logicalYear)
      : gregorianStart(date, event.rules, logicalYear);
  if (start === null) {
    return null;
  }

  const count = years === null ? null : years / recurrence.interval;
  if (count !== null && !withinEnd(recurrence, count, start)) {
    return null;
  }

  const values: TitleValues = isYearlyEveryYear(recurrence) ? { years } : { count };
  return build(
    event,
    { key: String(logicalYear), logicalYear, start, durationDays: event.durationDays, template: event.titleTemplate },
    values,
    timeZone
  );
}

function cycleOccurrence(event: RepeatingEvent, k: number, start: IsoDate, timeZone: string): Occurrence {
  return build(
    event,
    {
      key: `k${k}`,
      logicalYear: Number(start.slice(0, 4)),
      start,
      durationDays: event.durationDays,
      template: event.titleTemplate,
    },
    { count: k },
    timeZone
  );
}

/** 按天/周/月：从 from 起（最后一天 ≥ from）依次产出，直到 shouldStop 或结束条件。 */
function* cycles(event: RepeatingEvent, from: IsoDate) {
  const { recurrence } = event;
  for (let k = firstCycleAtOrAfter(event, addDays(from, -event.durationDays)); ; k += 1) {
    const start = cycleStart(event, k);
    if (pastEnd(recurrence, k, start)) {
      return;
    }

    if (start !== null && compareIsoDate(addDays(start, event.durationDays - 1), from) >= 0) {
      yield { k, start };
    }
  }
}

function milestoneOccurrences(event: EventInput, timeZone: string): Occurrence[] {
  return milestoneDates(event).map(({ days, start }) =>
    build(
      event,
      {
        key: `m${days}`,
        logicalYear: Number(start.slice(0, 4)),
        start,
        durationDays: 1,
        template: event.milestoneTemplate,
      },
      { days },
      timeZone
    )
  );
}

function inWindow(start: IsoDate, window: YearWindow) {
  const year = Number(start.slice(0, 4));
  return year >= window.fromYear && year <= window.toYear;
}

/**
 * 按天/周/月：窗口内开始的次数，以今天为界最多保留过去 maxPastOccurrences 次、未来 maxFutureOccurrences 次。
 */
function windowCycles(event: RepeatingEvent, window: YearWindow, today: IsoDate, timeZone: string): Occurrence[] {
  const past: Occurrence[] = [];
  const future: Occurrence[] = [];
  const windowEnd = isoDate(window.toYear, 12, 31);
  for (const { k, start } of cycles(event, isoDate(window.fromYear, 1, 1))) {
    if (compareIsoDate(start, windowEnd) > 0 || future.length >= maxFutureOccurrences) {
      break;
    }

    if (!inWindow(start, window)) {
      continue;
    }

    const occurrence = cycleOccurrence(event, k, start, timeZone);
    if (compareIsoDate(occurrence.lastDay, today) < 0) {
      past.push(occurrence);
      if (past.length > maxPastOccurrences) {
        past.shift();
      }
    } else {
      future.push(occurrence);
    }
  }

  return [...past, ...future];
}

/** 只发生一次：发生日就是保存的那一天，不从下一年起算。 */
function onceOccurrence(event: EventInput, timeZone: string): Occurrence | null {
  const { date } = event;
  if (date.year === null) {
    throw new Error(issueDetail("event_year_required"));
  }

  const start =
    date.calendar === "lunar" ? lunarStart(date, event.rules, date.year) : gregorianStart(date, event.rules, date.year);
  if (start === null) {
    return null;
  }

  return build(
    event,
    { key: "once", logicalYear: date.year, start, durationDays: event.durationDays, template: event.titleTemplate },
    {},
    timeZone
  );
}

/**
 * 原始事件展开为窗口内的发生日；展开结果只用于输出，不写回原始事件。
 * 只发生一次时输出保存的那一次，不受周年窗口影响。里程碑在窗口内全部输出。
 * today（用户时区的今天）只用于按天/周/月的过去/未来截断，由调用方显式传入。
 */
export function expandEvent(event: EventInput, window: YearWindow, timeZone: string, today: IsoDate): Occurrence[] {
  const milestones = milestoneOccurrences(event, timeZone).filter(item => inWindow(item.start, window));
  if (event.recurrence === null) {
    const single = onceOccurrence(event, timeZone);
    return single ? [single, ...milestones] : milestones;
  }

  const repeating: RepeatingEvent = { ...event, recurrence: event.recurrence };
  const occurrences: Occurrence[] = [];
  if (repeating.recurrence.unit === "year") {
    for (let year = window.fromYear; year <= window.toYear; year += 1) {
      const occurrence = yearlyOccurrence(repeating, year, timeZone);
      if (occurrence) {
        occurrences.push(occurrence);
      }
    }
  } else {
    occurrences.push(...windowCycles(repeating, window, today, timeZone));
  }

  occurrences.push(...milestones);
  return occurrences;
}

function upcomingYearly(event: RepeatingEvent, now: Date, timeZone: string, count: number, today: IsoDate) {
  const result: Occurrence[] = [];
  // 农历年可能落在下一公历年初，因此从上一年开始找；2 月 29 日跳过策略最多每 8 年才发生一次，隔 N 年再乘 N。
  const fromYear = currentYearIn(now, timeZone) - 1;
  const span = fromYear + count * 8 * event.recurrence.interval;
  const lastYear = event.date.calendar === "lunar" ? Math.min(LUNAR_MAX_YEAR, span) : span;
  for (let year = fromYear; year <= lastYear && result.length < count; year += 1) {
    const occurrence = yearlyOccurrence(event, year, timeZone);
    if (occurrence && compareIsoDate(occurrence.lastDay, today) >= 0) {
      result.push(occurrence);
    }
  }

  return result;
}

function upcomingCycles(event: RepeatingEvent, count: number, today: IsoDate, timeZone: string) {
  const result: Occurrence[] = [];
  for (const { k, start } of cycles(event, today)) {
    if (result.length >= count) {
      break;
    }

    result.push(cycleOccurrence(event, k, start, timeZone));
  }

  return result;
}

/**
 * 从今天（用户时区）起最近的若干次发生，包括仍在持续中的那一次，里程碑按日期混排；用于编辑预览和下次发生。
 * 只发生一次时始终包含那一次（即使已经过去），与订阅里输出的内容一致。
 */
export function upcomingOccurrences(event: EventInput, now: Date, timeZone: string, count: number): Occurrence[] {
  const today = todayIn(now, timeZone);
  if (event.recurrence === null) {
    const single = onceOccurrence(event, timeZone);
    const milestones = milestoneOccurrences(event, timeZone).filter(item => compareIsoDate(item.lastDay, today) >= 0);
    return [...(single ? [single] : []), ...milestones]
      .sort((left, right) => compareIsoDate(left.start, right.start))
      .slice(0, count);
  }

  const repeating: RepeatingEvent = { ...event, recurrence: event.recurrence };
  const regular =
    repeating.recurrence.unit === "year"
      ? upcomingYearly(repeating, now, timeZone, count, today)
      : upcomingCycles(repeating, count, today, timeZone);
  const milestones = milestoneOccurrences(event, timeZone).filter(item => compareIsoDate(item.lastDay, today) >= 0);
  return [...regular, ...milestones].sort((left, right) => compareIsoDate(left.start, right.start)).slice(0, count);
}

/** 下次发生（含仍在持续中的那一次）；网页列表与服务端按下次发生排序共用。 */
export function nextOccurrence(event: EventInput, now: Date, timeZone: string): Occurrence | undefined {
  return upcomingOccurrences(event, now, timeZone, 1)[0];
}
