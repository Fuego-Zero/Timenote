import { randomUUID } from "node:crypto";

import { addDays, CalendarRangeError, compareIsoDate, type IsoDate, nextOccurrence, todayIn } from "@timenote/calendar";
import {
  type CalendarEvent,
  type EventInput,
  type EventPageQuery,
  exceedsRecurrenceLimit,
  type PageResult,
} from "@timenote/contracts";
import { BusinessError, type OpenedRepository } from "@timenote/runtime";

export function createEvent(
  repo: OpenedRepository,
  ownerId: string,
  input: EventInput,
  now: number,
  id: string = randomUUID()
) {
  const event: CalendarEvent = { ...input, id, ownerId, revision: 0, createdAt: now, updatedAt: now };
  repo.events.putEvent(event);
  return event;
}

/** 本人全部事件的重复与里程碑总量超出上限时拒绝；在写入后的同一事务里调用，抛错即回滚。 */
export function assertRecurrenceLimit(repo: OpenedRepository, ownerId: string) {
  if (exceedsRecurrenceLimit(repo.events.listEvents(ownerId))) {
    throw new BusinessError("RECURRENCE_LIMIT");
  }
}

/** 新建并检查总量上限。 */
export function addEvent(repo: OpenedRepository, ownerId: string, input: EventInput, now: number) {
  return repo.transaction(() => {
    const event = createEvent(repo, ownerId, input, now);
    assertRecurrenceLimit(repo, ownerId);
    return event;
  });
}

/** 修改只替换可编辑内容；ID、归属和创建时间不变，revision 递增供订阅识别更新。 */
export function reviseEvent(existing: CalendarEvent, input: EventInput, now: number): CalendarEvent {
  return {
    ...input,
    id: existing.id,
    ownerId: existing.ownerId,
    createdAt: existing.createdAt,
    revision: existing.revision + 1,
    updatedAt: Math.max(now, existing.updatedAt + 1),
  };
}

/** 删除事件并在同一事务里把它从本人订阅的 eventIds 中移除，之后数据里不会留下悬空 id。 */
export function deleteEvent(repo: OpenedRepository, ownerId: string, id: string) {
  repo.transaction(() => {
    if (!repo.events.removeEvent(ownerId, id)) {
      throw new BusinessError("NOT_FOUND");
    }

    repo.feedTokens.removeEventIdFromFeeds(ownerId, id);
  });
}

export function updateEvent(repo: OpenedRepository, ownerId: string, id: string, input: EventInput, now: number) {
  return repo.transaction(() => {
    const existing = repo.events.getEvent(ownerId, id);
    if (!existing) {
      throw new BusinessError("NOT_FOUND");
    }

    const next = reviseEvent(existing, input, now);
    repo.events.putEvent(next);
    assertRecurrenceLimit(repo, ownerId);
    return next;
  });
}

/** 下次发生的开始日（用户时区）；已全部过去或日历换算超出范围时为 undefined。 */
function nextStart(event: CalendarEvent, now: Date, timeZone: string, today: IsoDate): IsoDate | undefined {
  try {
    const next = nextOccurrence(event, now, timeZone);
    return next && compareIsoDate(next.lastDay, today) >= 0 ? next.start : undefined;
  } catch (error) {
    if (error instanceof CalendarRangeError) {
      return undefined;
    }

    throw error;
  }
}

/**
 * sort=nextOccurrence：取本人全部事件（先套用 SQL 能做的筛选），在服务层计算下次发生，
 * 按 nextWithinDays 过滤后以 (下次发生 ASC, id) 排序，算不出下次发生的排最后，最后切页。
 * 下次发生依赖时区与今天且含农历，无法放进 SQL。
 */
export function listEventsByNextOccurrence(
  repo: OpenedRepository,
  ownerId: string,
  query: Omit<EventPageQuery, "sort">,
  now: number,
  timeZone: string
): PageResult<CalendarEvent> {
  const { page, pageSize, nextWithinDays, ...filter } = query;
  const date = new Date(now);
  const today = todayIn(date, timeZone);
  const limit = nextWithinDays === undefined ? undefined : addDays(today, nextWithinDays);
  const ranked = repo.events
    .listEventsFiltered(ownerId, filter)
    .map(event => ({ event, next: nextStart(event, date, timeZone, today) }))
    .filter(item => limit === undefined || (item.next !== undefined && compareIsoDate(item.next, limit) <= 0))
    .sort((left, right) => {
      if (left.next !== right.next) {
        if (left.next === undefined) {
          return 1;
        }

        if (right.next === undefined) {
          return -1;
        }

        return compareIsoDate(left.next, right.next);
      }

      return left.event.id.localeCompare(right.event.id);
    });
  const offset = (page - 1) * pageSize;
  return {
    items: ranked.slice(offset, offset + pageSize).map(item => item.event),
    total: ranked.length,
    page,
    pageSize,
  };
}
