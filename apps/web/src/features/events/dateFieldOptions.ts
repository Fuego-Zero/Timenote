import { formatLunarMonthDay } from "@timenote/calendar";
import type { EventInput } from "@timenote/contracts";

import { i18n } from "../../i18n/index.js";

export function monthOptions() {
  return Array.from({ length: 12 }, (_value, index) => ({
    label: i18n.t("originalDate.monthLabel", { ns: "events", n: index + 1 }),
    value: index + 1,
  }));
}

/** 农历月名保留中文日名（一期已知限制，en 下可仍为中文）。 */
export const lunarMonthOptions = Array.from({ length: 12 }, (_value, index) => ({
  label: formatLunarMonthDay(index + 1, 1, false).replace("初一", ""),
  value: index + 1,
}));

export function dateLabels(): Record<EventInput["kind"], string> {
  return {
    birthday: i18n.t("originalDate.labels.birthday", { ns: "events" }),
    anniversary: i18n.t("originalDate.labels.anniversary", { ns: "events" }),
    event: i18n.t("originalDate.labels.event", { ns: "events" }),
  };
}

export function dayOptions(lunar: boolean, month: number) {
  return Array.from({ length: 31 }, (_value, index) => index + 1)
    .filter(day => (lunar ? day <= 30 : true))
    .map(day => ({
      label: lunar
        ? formatLunarMonthDay(month, day, false).replace(/^.*月/, "")
        : i18n.t("originalDate.dayLabel", { ns: "events", n: day }),
      value: day,
    }));
}
