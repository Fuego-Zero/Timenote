import { formatLunarMonthDay } from "@timenote/calendar";

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

/** 公历下拉能选到的最后一天。2 月含 29 日，平年怎么处理由事件规则说明。 */
export function gregorianDayCount(month: number) {
  if (month === 2) {
    return 29;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** 换月后把日收到该月还能选的最后一天。农历三十仍保留，交给小月规则。 */
export function clampSelectedDay(lunar: boolean, month: number, day: number) {
  const last = lunar ? 30 : gregorianDayCount(month);
  return Math.min(day, last);
}

export function dayOptions(lunar: boolean, month: number) {
  const last = lunar ? 30 : gregorianDayCount(month);
  return Array.from({ length: last }, (_value, index) => index + 1).map(day => ({
    label: dayLabel(lunar, month, day),
    value: day,
  }));
}
