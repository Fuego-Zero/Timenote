import { formatLunarMonthDay } from "@timenote/calendar";
import type { EventInput } from "@timenote/contracts";

import { i18n, resolveLocale } from "../../i18n/index.js";

function chineseLunarNames() {
  return resolveLocale(i18n.language).code.startsWith("zh");
}

export function monthOptions() {
  return Array.from({ length: 12 }, (_value, index) => ({
    label: i18n.t("originalDate.monthLabel", { ns: "events", n: index + 1 }),
    value: index + 1,
  }));
}

export function lunarMonthOptions() {
  return Array.from({ length: 12 }, (_value, index) => {
    const month = index + 1;
    return {
      label: chineseLunarNames()
        ? formatLunarMonthDay(month, 1, false).replace("初一", "")
        : i18n.t("originalDate.lunarMonth", { ns: "events", n: month }),
      value: month,
    };
  });
}

export function dateLabels(): Record<EventInput["kind"], string> {
  return {
    birthday: i18n.t("originalDate.labels.birthday", { ns: "events" }),
    anniversary: i18n.t("originalDate.labels.anniversary", { ns: "events" }),
    event: i18n.t("originalDate.labels.event", { ns: "events" }),
  };
}

function dayLabel(lunar: boolean, month: number, day: number) {
  if (!lunar) {
    return i18n.t("originalDate.dayLabel", { ns: "events", n: day });
  }

  if (chineseLunarNames()) {
    return formatLunarMonthDay(month, day, false).replace(/^.*月/, "");
  }

  return i18n.t("originalDate.lunarDay", { ns: "events", n: day });
}

/** 提示里的完整农历日期。中文用「九月初四」；英文用 CLDR 紧凑写法 Mo9 4，闰月为 Mo9bis 4。 */
export function formatLunarDateLabel(month: number, day: number, leapMonth: boolean) {
  if (chineseLunarNames()) {
    return formatLunarMonthDay(month, day, leapMonth);
  }

  const monthLabel = i18n.t("originalDate.lunarMonth", { ns: "events", n: month });
  const dayLabel = i18n.t("originalDate.lunarDay", { ns: "events", n: day });
  return i18n.t(leapMonth ? "originalDate.lunarLeap" : "originalDate.lunarDate", {
    ns: "events",
    month: monthLabel,
    day: dayLabel,
  });
}

export function dayOptions(lunar: boolean, month: number) {
  return Array.from({ length: 31 }, (_value, index) => index + 1)
    .filter(day => (lunar ? day <= 30 : true))
    .map(day => ({
      label: dayLabel(lunar, month, day),
      value: day,
    }));
}
