import { type CalendarEvent, isYearlyEveryYear, type RecurrenceUnit } from "@timenote/contracts";

import { i18n } from "../../i18n/index.js";

export function recurrenceUnitLabels(): Record<RecurrenceUnit, string> {
  return {
    day: i18n.t("recurrence.units.day", { ns: "events" }),
    week: i18n.t("recurrence.units.week", { ns: "events" }),
    month: i18n.t("recurrence.units.month", { ns: "events" }),
    year: i18n.t("recurrence.units.year", { ns: "events" }),
  };
}

export const milestonePresets: readonly number[] = [100, 200, 365, 500, 520, 999, 1000, 1314, 2000, 3650];

/** 列表里的规则摘要，如「每 2 周」「每月 · 至 2027-12-31」「+3 个里程碑」；默认的每年永不结束不显示。 */
export function recurrenceSummary(event: Pick<CalendarEvent, "milestones" | "recurrence">): string[] {
  const { recurrence } = event;
  const parts: string[] = [];
  if (!isYearlyEveryYear(recurrence) || recurrence.end.type !== "never") {
    const everyOne = i18n.t(`summary.everyOne.${recurrence.unit}`, { ns: "events" });
    const everyN = i18n.t(`summary.everyN.${recurrence.unit}`, { ns: "events" });
    const every =
      recurrence.interval === 1
        ? everyOne
        : i18n.t("summary.everyInterval", { ns: "events", interval: recurrence.interval, unit: everyN });
    if (recurrence.end.type === "count") {
      parts.push(i18n.t("summary.withCount", { ns: "events", every, count: recurrence.end.count }));
    } else if (recurrence.end.type === "until") {
      parts.push(i18n.t("summary.withUntil", { ns: "events", every, until: recurrence.end.until }));
    } else {
      parts.push(every);
    }
  }

  if (event.milestones.length) {
    parts.push(i18n.t("summary.milestones", { ns: "events", count: event.milestones.length }));
  }

  return parts;
}
