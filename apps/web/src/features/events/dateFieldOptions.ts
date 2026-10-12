import { formatLunarMonthDay } from "@timenote/calendar";
import type { EventInput } from "@timenote/contracts";

export const monthOptions = Array.from({ length: 12 }, (_value, index) => ({
  label: `${index + 1} 月`,
  value: index + 1,
}));

export const lunarMonthOptions = Array.from({ length: 12 }, (_value, index) => ({
  label: formatLunarMonthDay(index + 1, 1, false).replace("初一", ""),
  value: index + 1,
}));

export const dateLabels: Record<EventInput["kind"], string> = {
  birthday: "出生日期",
  anniversary: "首次日期",
  event: "开始日期",
};

export function dayOptions(lunar: boolean, month: number) {
  return Array.from({ length: 31 }, (_value, index) => index + 1)
    .filter(day => (lunar ? day <= 30 : true))
    .map(day => ({
      label: lunar ? formatLunarMonthDay(month, day, false).replace(/^.*月/, "") : `${day} 日`,
      value: day,
    }));
}
