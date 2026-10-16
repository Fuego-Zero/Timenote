import { type EventInput, issueDetail, type Recurrence } from "@timenote/contracts";

import { addDays, compareIsoDate, daysBetween, daysInGregorianMonth, type IsoDate, isoDate } from "./dates.js";

/** 按天/周/月重复的起始日（第 0 次）；契约保证这类规则只用于公历且年份已知。 */
export function recurrenceOrigin(date: EventInput["date"]): IsoDate {
  if (date.year === null || date.calendar !== "gregorian") {
    throw new Error(issueDetail("daily_needs_gregorian"));
  }

  return isoDate(date.year, date.month, date.day);
}

/**
 * 第 k 次（k ≥ 1）的开始日，每次都从起始日直接推算，不累加误差。
 * 公历按月时当月没有原始日：lastDay 落到月末，skip 返回 null（该次被跳过，但仍占序号）。
 */
export function cycleStart(event: Pick<EventInput, "date" | "gregorianMissingDay" | "recurrence">, k: number) {
  const { date, recurrence } = event;
  const origin = recurrenceOrigin(date);
  if (recurrence.unit === "day") {
    return addDays(origin, k * recurrence.interval);
  }

  if (recurrence.unit === "week") {
    return addDays(origin, k * recurrence.interval * 7);
  }

  if (recurrence.unit === "year") {
    throw new Error("按年重复沿用周年展开，不走这里");
  }

  const index = Number(origin.slice(0, 4)) * 12 + date.month - 1 + k * recurrence.interval;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const lastDay = daysInGregorianMonth(year, month);
  if (date.day <= lastDay) {
    return isoDate(year, month, date.day);
  }

  return event.gregorianMissingDay === "skip" ? null : isoDate(year, month, lastDay);
}

/** 序号不超过一个下界：从这个 k 起往后找，不会漏掉开始日不早于 from 的那几次。 */
export function firstCycleAtOrAfter(event: Pick<EventInput, "date" | "recurrence">, from: IsoDate) {
  const origin = recurrenceOrigin(event.date);
  const { recurrence } = event;
  const elapsed = daysBetween(origin, from);
  if (elapsed <= 0) {
    return 1;
  }

  // 每单位取最长可能天数（月 31、年 366）作上界：用它估算出的序号只会偏小，
  // 再往后逐次推算即可，不会漏掉开始日不早于 from 的那几次。
  const unitDays = { day: 1, week: 7, month: 31, year: 366 }[recurrence.unit];
  return Math.max(1, Math.floor(elapsed / (unitDays * recurrence.interval)) - 1);
}

/** 第 k 次是否在结束条件之内：count 按序号（含被跳过的），until 比较开始日（含当天）。 */
export function withinEnd(recurrence: Recurrence, k: number, start: IsoDate) {
  if (recurrence.end.type === "count") {
    return k <= recurrence.end.count;
  }

  return recurrence.end.type === "never" || compareIsoDate(start, recurrence.end.until) <= 0;
}

/** 序号已经超过结束条件，后面不会再有。 */
export function pastEnd(recurrence: Recurrence, k: number, start: IsoDate | null) {
  if (recurrence.end.type === "count") {
    return k > recurrence.end.count;
  }

  return recurrence.end.type === "until" && start !== null && compareIsoDate(start, recurrence.end.until) > 0;
}
