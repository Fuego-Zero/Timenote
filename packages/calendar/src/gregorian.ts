import type { EventInput } from "@timenote/contracts";

import { daysInGregorianMonth, isGregorianLeapYear, type IsoDate, isoDate } from "./dates.js";

/** 目标公历年的发生日；按 2 月 29 日策略在平年回落或跳过，返回 null 表示该年没有发生。 */
export function gregorianStart(date: EventInput["date"], rules: EventInput["rules"], year: number): IsoDate | null {
  if (date.month === 2 && date.day === 29 && !isGregorianLeapYear(year)) {
    if (rules.feb29 === "skip") {
      return null;
    }

    return rules.feb29 === "mar1" ? isoDate(year, 3, 1) : isoDate(year, 2, 28);
  }

  if (date.day > daysInGregorianMonth(year, date.month)) {
    return null;
  }

  return isoDate(year, date.month, date.day);
}
