import { upcomingOccurrences } from "@timenote/calendar";
import type { CalendarEvent } from "@timenote/contracts";

export function nextOccurrence(event: CalendarEvent, timeZone: string) {
  try {
    return upcomingOccurrences(event, new Date(), timeZone, 1)[0];
  } catch {
    return undefined;
  }
}
