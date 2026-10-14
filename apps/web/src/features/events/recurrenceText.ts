import { type CalendarEvent, isYearlyEveryYear, type RecurrenceUnit } from "@timenote/contracts";

export const recurrenceUnitLabels: Record<RecurrenceUnit, string> = { day: "天", week: "周", month: "月", year: "年" };

export const milestonePresets: readonly number[] = [100, 200, 365, 500, 520, 999, 1000, 1314, 2000, 3650];

const everyOne: Record<RecurrenceUnit, string> = { day: "每天", week: "每周", month: "每月", year: "每年" };
const everyN: Record<RecurrenceUnit, string> = { day: "天", week: "周", month: "个月", year: "年" };

/** 列表里的规则摘要，如「每 2 周」「每月 · 至 2027-12-31」「+3 个里程碑」；默认的每年永不结束不显示。 */
export function recurrenceSummary(event: Pick<CalendarEvent, "milestones" | "recurrence">): string[] {
  const { recurrence } = event;
  const parts: string[] = [];
  if (!isYearlyEveryYear(recurrence) || recurrence.end.type !== "never") {
    const every =
      recurrence.interval === 1 ? everyOne[recurrence.unit] : `每 ${recurrence.interval} ${everyN[recurrence.unit]}`;
    if (recurrence.end.type === "count") {
      parts.push(`${every} · 共 ${recurrence.end.count} 个周期`);
    } else if (recurrence.end.type === "until") {
      parts.push(`${every} · 至 ${recurrence.end.until}`);
    } else {
      parts.push(every);
    }
  }

  if (event.milestones.length) {
    parts.push(`+${event.milestones.length} 个里程碑`);
  }

  return parts;
}
