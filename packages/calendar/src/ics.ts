import type { CalendarEvent } from "@timenote/contracts";
import ical, { ICalAlarmType, ICalCalendarMethod, ICalEventTransparency } from "ical-generator";

import type { IsoDate } from "./dates.js";
import { expandEvent, type YearWindow } from "./occurrences.js";

export interface FeedInput {
  calendarName: string;
  events: CalendarEvent[];
  timeZone: string;
  /** 按天/周/月截断过去与未来次数的基准日（用户时区的今天），由调用方显式传入。 */
  today: IsoDate;
  window: YearWindow;
}

const refreshSeconds = 6 * 60 * 60;

function stableOrder(left: CalendarEvent, right: CalendarEvent) {
  return left.createdAt - right.createdAt || left.id.localeCompare(right.id, "en");
}

/**
 * 生成 RFC 5545 订阅内容。相同事件、窗口和时区产生相同字节：
 * DTSTAMP/LAST-MODIFIED 取事件 updatedAt，SEQUENCE 取 revision，不使用请求时刻。
 */
export function buildFeed(input: FeedInput): string {
  const calendar = ical({
    prodId: { company: "timenote", product: "timenote", language: "ZH" },
    name: input.calendarName,
    method: ICalCalendarMethod.PUBLISH,
    ttl: refreshSeconds,
    x: [["X-WR-TIMEZONE", input.timeZone]],
  });
  for (const event of [...input.events].sort(stableOrder)) {
    const updated = new Date(Math.floor(event.updatedAt / 1000) * 1000);
    for (const occurrence of expandEvent(event, input.window, input.timeZone, input.today)) {
      calendar.createEvent({
        // 按年为「ID-逻辑年份」，按天/周/月为「ID-k序号」，里程碑为「ID-m天数」；只发生一次时主条目保留稳定事件 ID。
        id:
          event.recurrence === null && !occurrence.key.startsWith("m")
            ? `${event.id}@timenote`
            : `${event.id}-${occurrence.key}@timenote`,
        allDay: true,
        start: occurrence.start,
        end: occurrence.end,
        stamp: updated,
        lastModified: updated,
        sequence: event.revision,
        summary: occurrence.title,
        description: event.note.trim() || null,
        transparency: ICalEventTransparency.TRANSPARENT,
        alarms: occurrence.alarms.map(alarm => ({
          type: ICalAlarmType.display,
          trigger: new Date(alarm.at),
          description: occurrence.title,
        })),
      });
    }
  }

  // ical-generator 不输出末尾换行；RFC 5545 要求每个内容行以 CRLF 结束。
  return `${calendar.toString()}\r\n`;
}
