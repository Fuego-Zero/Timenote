import { TZDate } from "@date-fns/tz";
import type { EventInput } from "@timenote/contracts";

import { alarmInstant, type AlarmTime } from "./alarms.js";
import { addDays, compareIsoDate, type IsoDate, isoDate } from "./dates.js";
import { gregorianStart } from "./gregorian.js";
import { LUNAR_MAX_YEAR, lunarStart } from "./lunar.js";
import { renderTitle } from "./title.js";

export interface Occurrence {
  alarms: AlarmTime[];
  /** 排他结束日，对应 ICS 全天事件的 DTEND。 */
  end: IsoDate;
  /** 包含当天的最后一天。 */
  lastDay: IsoDate;
  /** 逻辑年份：公历事件为公历年，农历事件为目标农历年；参与生成稳定 UID。 */
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

function occurrenceFor(event: EventInput, logicalYear: number, timeZone: string): Occurrence | null {
  const { date } = event;
  let years: number | null = null;
  if (event.kind !== "event" && date.year !== null) {
    years = logicalYear - date.year;
    // 周年从第 1 年开始生成，不生成第 0 周年或原始日期之前的年份。
    if (years < 1) {
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

  const title = renderTitle(event, years);
  return {
    logicalYear,
    start,
    lastDay: addDays(start, event.durationDays - 1),
    end: addDays(start, event.durationDays),
    years,
    title,
    alarms: event.alarms.map(alarm => alarmInstant(start, alarm, timeZone)),
  };
}

/**
 * 原始事件展开为窗口内的发生日；展开结果只用于输出，不写回原始事件。
 * 普通事件只有保存的那一次，不受周年窗口影响。
 */
export function expandEvent(event: EventInput, window: YearWindow, timeZone: string): Occurrence[] {
  if (event.kind === "event") {
    if (event.date.year === null) {
      throw new Error("普通事件必须填写年份");
    }

    const single = occurrenceFor(event, event.date.year, timeZone);
    return single ? [single] : [];
  }

  const occurrences: Occurrence[] = [];
  for (let year = window.fromYear; year <= window.toYear; year += 1) {
    const occurrence = occurrenceFor(event, year, timeZone);
    if (occurrence) {
      occurrences.push(occurrence);
    }
  }

  return occurrences;
}

/**
 * 从今天（用户时区）起最近的若干次发生，包括仍在持续中的那一次；用于编辑预览。
 * 普通事件始终返回唯一那一次（即使已经过去），与订阅里输出的内容一致。
 */
export function upcomingOccurrences(event: EventInput, now: Date, timeZone: string, count: number): Occurrence[] {
  if (event.kind === "event") {
    return expandEvent(event, { fromYear: 0, toYear: 0 }, timeZone);
  }

  const today = todayIn(now, timeZone);
  const result: Occurrence[] = [];
  // 农历年可能落在下一公历年初，因此从上一年开始找；2 月 29 日跳过策略最多每 8 年才发生一次。
  const fromYear = currentYearIn(now, timeZone) - 1;
  const lastYear =
    event.date.calendar === "lunar" ? Math.min(LUNAR_MAX_YEAR, fromYear + count * 8) : fromYear + count * 8;
  for (let year = fromYear; year <= lastYear && result.length < count; year += 1) {
    const occurrence = occurrenceFor(event, year, timeZone);
    if (occurrence && compareIsoDate(occurrence.lastDay, today) >= 0) {
      result.push(occurrence);
    }
  }

  return result;
}
