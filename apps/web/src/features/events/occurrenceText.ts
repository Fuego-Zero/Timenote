import type { Occurrence } from "@timenote/calendar";

import { i18n, resolveLocale } from "../../i18n/index.js";

function dateText(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const weekdays = i18n.t("occurrence.weekdays", { ns: "events", returnObjects: true }) as string[];
  return i18n.t("occurrence.date", {
    ns: "events",
    year,
    month,
    day,
    weekday: weekdays[weekday],
  });
}

export function rangeText(occurrence: Occurrence) {
  if (occurrence.start === occurrence.lastDay) {
    return dateText(occurrence.start);
  }

  return i18n.t("occurrence.range", {
    ns: "events",
    start: dateText(occurrence.start),
    end: dateText(occurrence.lastDay),
  });
}

/** 提醒的绝对时间按账号时区显示，与订阅里的 UTC TRIGGER 是同一时刻。 */
export function alarmText(at: string, timeZone: string) {
  return new Intl.DateTimeFormat(resolveLocale(i18n.language).intl, {
    timeZone,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(at));
}
