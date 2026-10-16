import { type EventInput, issueDetail } from "@timenote/contracts";
import { Lunar, LunarMonth, LunarYear, Solar } from "lunar-typescript";

import { type IsoDate, parseIsoDate } from "./dates.js";

/** 本系统承诺的农历换算范围；超出时抛出可见错误，不静默算错。 */
export const LUNAR_MIN_YEAR = 1900;
export const LUNAR_MAX_YEAR = 2100;

export class CalendarRangeError extends Error {
  constructor(public year: number) {
    super(issueDetail("lunar_range", { min: LUNAR_MIN_YEAR, max: LUNAR_MAX_YEAR, year }));
    this.name = "CalendarRangeError";
  }
}

function assertLunarYear(year: number) {
  if (!Number.isInteger(year) || year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) {
    throw new CalendarRangeError(year);
  }
}

function monthLength(year: number, month: number, leap: boolean) {
  return LunarMonth.fromYm(year, leap ? -month : month)?.getDayCount();
}

/** 当年闰月月份；0 表示没有闰月。 */
export function leapMonthOf(year: number) {
  assertLunarYear(year);
  return LunarYear.fromYear(year).getLeapMonth();
}

/**
 * 每个目标农历年单独换算成公历发生日。
 * 闰月原始日期遇到无对应闰月的年份时按策略使用同名普通月或跳过；三十遇小月时按策略取月末或跳过。
 */
export function lunarStart(date: EventInput["date"], rules: EventInput["rules"], lunarYear: number): IsoDate | null {
  assertLunarYear(lunarYear);
  let leap = date.leapMonth;
  if (leap && leapMonthOf(lunarYear) !== date.month) {
    if (rules.leapMonth === "skip") {
      return null;
    }

    leap = false;
  }

  const days = monthLength(lunarYear, date.month, leap);
  if (days === undefined) {
    return null;
  }

  let { day } = date;
  if (day > days) {
    if (rules.missingDay === "skip") {
      return null;
    }

    day = days;
  }

  return Lunar.fromYmd(lunarYear, leap ? -date.month : date.month, day)
    .getSolar()
    .toYmd();
}

/** 已知年份的农历原始日期必须真实存在；返回中文问题描述，供表单定位到字段。 */
export function lunarDateIssue(
  date: EventInput["date"]
): { field: "year" | "leapMonth" | "day"; message: string } | null {
  if (date.year === null) {
    return null;
  }

  if (date.year < LUNAR_MIN_YEAR || date.year > LUNAR_MAX_YEAR) {
    return { field: "year", message: new CalendarRangeError(date.year).message };
  }

  if (date.leapMonth && leapMonthOf(date.year) !== date.month) {
    return { field: "leapMonth", message: issueDetail("no_leap_month", { year: date.year, month: date.month }) };
  }

  const days = monthLength(date.year, date.month, date.leapMonth);
  if (days === undefined || date.day > days) {
    return { field: "day", message: issueDetail("lunar_month_days", { n: days ?? 0 }) };
  }

  return null;
}

/** 公历日期换算为农历原始日期，供表单从公历输入切换为农历依据时提示核对。 */
export function solarToLunar(value: IsoDate) {
  const { year, month, day } = parseIsoDate(value);
  assertLunarYear(year);
  const lunar = Solar.fromYmd(year, month, day).getLunar();
  const lunarMonth = lunar.getMonth();
  return { year: lunar.getYear(), month: Math.abs(lunarMonth), day: lunar.getDay(), leapMonth: lunarMonth < 0 };
}

const monthNames = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "冬", "腊"];
const dayNames = ["初", "十", "廿", "三"];
const digitNames = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

/** 农历日期的中文写法，例如「闰六月初一」「腊月三十」。 */
export function formatLunarMonthDay(month: number, day: number, leapMonth: boolean) {
  let dayText: string;
  if (day === 10) {
    dayText = "初十";
  } else if (day === 20) {
    dayText = "二十";
  } else if (day === 30) {
    dayText = "三十";
  } else {
    dayText = `${dayNames[Math.floor(day / 10)]}${digitNames[day % 10]}`;
  }

  return `${leapMonth ? "闰" : ""}${monthNames[month - 1]}月${dayText}`;
}
