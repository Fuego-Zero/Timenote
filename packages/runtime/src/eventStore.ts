import { type CalendarEvent, eventSchema } from "@timenote/contracts";
import { and, eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { events, tables } from "./schema.js";

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
