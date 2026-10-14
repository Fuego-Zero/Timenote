import { nextOccurrence as calendarNextOccurrence } from "@timenote/calendar";
import type { CalendarEvent } from "@timenote/contracts";

export function nextOccurrence(event: CalendarEvent, timeZone: string) {
  try {
    return calendarNextOccurrence(event, new Date(), timeZone);
  } catch {
    return undefined;
  }
}
