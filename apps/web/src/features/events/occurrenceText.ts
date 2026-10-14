import type { Occurrence } from "@timenote/calendar";

const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

function dateText(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${year}年${month}月${day}日 周${weekdays[weekday]}`;
}

export function rangeText(occurrence: Occurrence) {
  if (occurrence.start === occurrence.lastDay) {
    return dateText(occurrence.start);
  }

  return `${dateText(occurrence.start)} 至 ${dateText(occurrence.lastDay)}`;
}

/** 提醒的绝对时间按账号时区显示，与订阅里的 UTC TRIGGER 是同一时刻。 */
export function alarmText(at: string, timeZone: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(at));
}
