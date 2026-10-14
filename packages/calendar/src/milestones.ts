import type { EventInput } from "@timenote/contracts";

import { addDays, type IsoDate, isoDate } from "./dates.js";
import { lunarStart } from "./lunar.js";

export interface MilestoneDate {
  days: number;
  start: IsoDate;
}

/** 里程碑的起点（第 0 天）：公历即原始日期；农历把原始农历日期换算成公历。年份未知时没有起点。 */
function milestoneOrigin(event: Pick<EventInput, "date" | "rules">): IsoDate | null {
  const { date } = event;
  if (date.year === null) {
    return null;
  }

  if (date.calendar === "gregorian") {
    return isoDate(date.year, date.month, date.day);
  }

  // 原始日期本身已校验存在，按原样换算，不套用闰月和三十的回落规则。
  return lunarStart(date, { ...event.rules, leapMonth: "regular", missingDay: "lastDay" }, date.year);
}

/** 第 N 天 = 起点 + N 天；只给纪念日，不受结束条件和缺日影响，按天数升序。 */
export function milestoneDates(event: Pick<EventInput, "date" | "kind" | "milestones" | "rules">): MilestoneDate[] {
  if (event.kind !== "anniversary" || !event.milestones.length) {
    return [];
  }

  const origin = milestoneOrigin(event);
  if (origin === null) {
    return [];
  }

  return [...event.milestones]
    .sort((left, right) => left - right)
    .map(days => ({ days, start: addDays(origin, days) }));
}
