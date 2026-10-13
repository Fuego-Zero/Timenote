import { type CalendarEvent, type EventPageQuery, eventSchema, type PageResult } from "@timenote/contracts";
import { and, count, eq, inArray, type SQL, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { containsPattern, pageOffset } from "./pageQuery.js";
import { events, type tables } from "./schema.js";

/** 仓储层能处理的事件筛选；sort=nextOccurrence 与 nextWithinDays 依赖日历计算，由服务层处理。 */
export type EventPageFilter = Omit<EventPageQuery, "nextWithinDays" | "sort">;

/** 与索引 event_owner_created_idx 逐字一致。 */
const newestFirst = sql`json_extract(payload,'$.createdAt') DESC, id`;

/** 事件表 DAO：只负责读写与归属过滤，不承载业务决策。所有按用户读取的方法都必须带 ownerId。 */
export class EventStore {
  constructor(private db: BetterSQLite3Database<typeof tables>) {}

  listEvents(ownerId: string): CalendarEvent[] {
    return this.db
      .select()
      .from(events)
      .where(eq(events.owner, ownerId))
      .all()
      .map(row => eventSchema.parse(JSON.parse(row.payload)))
      .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  }

  /** 分页列表：createdAt DESC, id；名称按字面子串匹配。 */
  listEventsPage(ownerId: string, query: EventPageFilter): PageResult<CalendarEvent> {
    const conditions: SQL[] = [eq(events.owner, ownerId)];
    if (query.q !== undefined) {
      conditions.push(sql`json_extract(payload,'$.name') LIKE ${containsPattern(query.q)} ESCAPE '\\'`);
    }

    if (query.kind !== undefined) {
      conditions.push(sql`json_extract(payload,'$.kind') = ${query.kind}`);
    }

    if (query.calendar !== undefined) {
      conditions.push(sql`json_extract(payload,'$.date.calendar') = ${query.calendar}`);
    }

    if (query.hasAlarm !== undefined) {
      conditions.push(
        query.hasAlarm ? sql`json_array_length(payload,'$.alarms') > 0` : sql`json_array_length(payload,'$.alarms') = 0`
      );
    }

    if (query.ids !== undefined) {
      conditions.push(inArray(events.id, query.ids));
    }

    const where = and(...conditions);
    const total = this.db.select({ total: count() }).from(events).where(where).get()?.total ?? 0;
    const items = this.db
      .select({ payload: events.payload })
      .from(events)
      .where(where)
      .orderBy(newestFirst)
      .limit(query.pageSize)
      .offset(pageOffset(query.page, query.pageSize))
      .all()
      .map(row => eventSchema.parse(JSON.parse(row.payload)));
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** 按 id 批量读取本人事件；不属于 ownerId 的 id 被忽略。 */
  listEventsByIds(ownerId: string, ids: readonly string[]): CalendarEvent[] {
    if (!ids.length) {
      return [];
    }

    return this.db
      .select({ payload: events.payload })
      .from(events)
      .where(and(eq(events.owner, ownerId), inArray(events.id, [...ids])))
      .orderBy(newestFirst)
      .all()
      .map(row => eventSchema.parse(JSON.parse(row.payload)));
  }

  getEvent(ownerId: string, id: string): CalendarEvent | undefined {
    const row = this.db
      .select()
      .from(events)
      .where(and(eq(events.owner, ownerId), eq(events.id, id)))
      .get();
    return row ? eventSchema.parse(JSON.parse(row.payload)) : undefined;
  }

  /** 仅判断 ID 是否已被占用（含其他用户），不返回内容。 */
  eventIdTaken(id: string) {
    return Boolean(this.db.select({ id: events.id }).from(events).where(eq(events.id, id)).get());
  }

  putEvent(event: CalendarEvent) {
    const payload = JSON.stringify(eventSchema.parse(event));
    this.db
      .insert(events)
      .values({ id: event.id, owner: event.ownerId, payload })
      .onConflictDoUpdate({ target: events.id, set: { payload }, where: eq(events.owner, event.ownerId) })
      .run();
  }

  removeEvent(ownerId: string, id: string) {
    return this.db
      .delete(events)
      .where(and(eq(events.owner, ownerId), eq(events.id, id)))
      .run().changes;
  }
}
