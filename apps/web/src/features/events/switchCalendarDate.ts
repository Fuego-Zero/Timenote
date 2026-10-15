import { formatLunarMonthDay, isoDate, solarToLunar } from "@timenote/calendar";
import type { EventInput } from "@timenote/contracts";

import { i18n } from "../../i18n/index.js";

/** 公历/农历切换：有年份时用 calendar 包换算，否则只改 calendar 标记。 */
export function switchCalendarDate(
  date: EventInput["date"],
  calendar: EventInput["date"]["calendar"]
): { date: EventInput["date"]; notice?: string } {
  if (calendar === date.calendar) {
    return { date };
  }

  if (calendar === "lunar" && date.year !== null) {
    try {
      const lunar = solarToLunar(isoDate(date.year, date.month, date.day));
      return {
        date: { calendar, ...lunar },
        notice: i18n.t("switchCalendar.converted", {
          ns: "events",
          solar: isoDate(date.year, date.month, date.day),
          year: lunar.year,
          lunar: formatLunarMonthDay(lunar.month, lunar.day, lunar.leapMonth),
        }),
      };
    } catch (error) {
      return {
        date: { ...date, calendar, day: Math.min(date.day, 30) },
        notice: error instanceof Error ? error.message : i18n.t("switchCalendar.failed", { ns: "events" }),
      };
    }
  }

  return { date: { ...date, calendar, leapMonth: false } };
}
