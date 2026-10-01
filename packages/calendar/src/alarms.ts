import { TZDate } from "@date-fns/tz";
import type { EventInput } from "@timenote/contracts";

import { addDays, type IsoDate, parseIsoDate } from "./dates.js";

export interface AlarmTime {
  /** 绝对 UTC 时间（ISO 8601），写入 `TRIGGER;VALUE=DATE-TIME`。 */
  at: string;
  daysBefore: number;
  time: string;
}

/**
 * 按发生日、提前天数和用户 IANA 时区的本地时刻换算出真实提醒时间。
 * 夏令时跳过的本地时刻顺延到跳变之后；重复出现的本地时刻取较早的一次（与 TZDate 构造语义一致，测试锁定）。
 */
export function alarmInstant(start: IsoDate, alarm: EventInput["alarms"][number], timeZone: string): AlarmTime {
  const { year, month, day } = parseIsoDate(addDays(start, -alarm.daysBefore));
  const [hour, minute] = alarm.time.split(":").map(Number);
  const instant = new TZDate(year, month - 1, day, hour, minute, timeZone);
  return { daysBefore: alarm.daysBefore, time: alarm.time, at: new Date(instant.getTime()).toISOString() };
}
