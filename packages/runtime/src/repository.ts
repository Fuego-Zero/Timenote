import { type CalendarEvent, eventSchema } from "@timenote/contracts";
import type Sqlite from "better-sqlite3";
import { and, eq, lte, sql } from "drizzle-orm";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";

import {
  type Session,
  sessionSchema,
  type StoredFeedToken,
  storedFeedTokenSchema,
  type StoredUser,
  storedUserSchema,
} from "./entities.js";
import { migrationNames } from "./migrate.js";
import { events, feedTokens, sessions, tables, users } from "./schema.js";
import { openDatabase } from "./sqlite.js";

const parse = {
  user: (payload: string) => storedUserSchema.parse(JSON.parse(payload)),
  session: (payload: string) => sessionSchema.parse(JSON.parse(payload)),
  event: (payload: string) => eventSchema.parse(JSON.parse(payload)),
  feed: (payload: string) => storedFeedTokenSchema.parse(JSON.parse(payload)),
};

/** 数据访问边界：只负责读写与归属过滤，不承载业务决策。所有按用户读取的方法都必须带 ownerId。 */
export class Repository {
  private db: BetterSQLite3Database<typeof tables>;

  constructor(private sqlite: Sqlite.Database) {
    this.db = drizzle(sqlite, { schema: tables });
  }

  /** 同步 IMMEDIATE 事务：读取-校验-写入之间不会插入其他写操作。 */
  transaction<T>(fn: () => T): T {
    return this.sqlite.transaction(fn).immediate();
  }

  close() {
    this.sqlite.close();
  }

  getUser(id: string): StoredUser | undefined {
    const row = this.db.select().from(users).where(eq(users.id, id)).get();
    return row ? parse.user(row.payload) : undefined;
  }

  getUserByUsername(username: string): StoredUser | undefined {
    const row = this.db.select().from(users).where(eq(users.username, username)).get();
    return row ? parse.user(row.payload) : undefined;
  }

  listUsers(): StoredUser[] {
    return this.db
      .select()
      .from(users)
      .orderBy(users.username)
      .all()
      .map(row => parse.user(row.payload));
  }

  putUser(user: StoredUser) {
    const payload = JSON.stringify(storedUserSchema.parse(user));
    this.db
      .insert(users)
      .values({ id: user.id, username: user.username, payload })
      .onConflictDoUpdate({ target: users.id, set: { username: user.username, payload } })
      .run();
  }

  /** 删除用户时由外键级联删除其会话、事件和订阅。 */
  removeUser(id: string) {
    this.db.delete(users).where(eq(users.id, id)).run();
  }

  getSession(id: string): Session | undefined {
    const row = this.db.select().from(sessions).where(eq(sessions.id, id)).get();
    return row ? parse.session(row.payload) : undefined;
  }

  putSession(session: Session) {
    const payload = JSON.stringify(sessionSchema.parse(session));
    this.db
      .insert(sessions)
      .values({ id: session.id, owner: session.userId, payload })
      .onConflictDoUpdate({ target: sessions.id, set: { payload } })
      .run();
  }

  removeSession(id: string) {
    this.db.delete(sessions).where(eq(sessions.id, id)).run();
  }

  removeUserSessions(userId: string, exceptSessionId?: string) {
    const owned = eq(sessions.owner, userId);
    this.db
      .delete(sessions)
      .where(exceptSessionId ? and(owned, sql`${sessions.id} <> ${exceptSessionId}`) : owned)
      .run();
  }

  purgeExpiredSessions(now: number) {
    this.db
      .delete(sessions)
      .where(lte(sql`json_extract(${sessions.payload}, '$.expiresAt')`, now))
      .run();
  }

  listEvents(ownerId: string): CalendarEvent[] {
    return this.db
      .select()
      .from(events)
      .where(eq(events.owner, ownerId))
      .all()
      .map(row => parse.event(row.payload))
      .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
  }

  getEvent(ownerId: string, id: string): CalendarEvent | undefined {
    const row = this.db
      .select()
      .from(events)
      .where(and(eq(events.owner, ownerId), eq(events.id, id)))
      .get();
    return row ? parse.event(row.payload) : undefined;
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

  listFeedTokens(ownerId: string): StoredFeedToken[] {
    return this.db
      .select()
      .from(feedTokens)
      .where(eq(feedTokens.owner, ownerId))
      .all()
      .map(row => parse.feed(row.payload))
      .sort((left, right) => left.createdAt - right.createdAt);
  }

  getFeedToken(ownerId: string, id: string): StoredFeedToken | undefined {
    const row = this.db
      .select()
      .from(feedTokens)
      .where(and(eq(feedTokens.owner, ownerId), eq(feedTokens.id, id)))
      .get();
    return row ? parse.feed(row.payload) : undefined;
  }

  getFeedTokenByHash(tokenHash: string): StoredFeedToken | undefined {
    const row = this.db.select().from(feedTokens).where(eq(feedTokens.tokenHash, tokenHash)).get();
    return row ? parse.feed(row.payload) : undefined;
  }

  putFeedToken(feed: StoredFeedToken) {
    const payload = JSON.stringify(storedFeedTokenSchema.parse(feed));
    this.db
      .insert(feedTokens)
      .values({ id: feed.id, owner: feed.ownerId, tokenHash: feed.tokenHash, payload })
      .onConflictDoUpdate({
        target: feedTokens.id,
        set: { tokenHash: feed.tokenHash, payload },
        where: eq(feedTokens.owner, feed.ownerId),
      })
      .run();
  }

  removeFeedToken(ownerId: string, id: string) {
    return this.db
      .delete(feedTokens)
      .where(and(eq(feedTokens.owner, ownerId), eq(feedTokens.id, id)))
      .run().changes;
  }
}

/** 打开已迁移的数据库；未执行迁移时立即失败，不在运行时隐式建表。 */
export function openRepository(path: string) {
  const sqlite = openDatabase(path);
  let applied: { name: string }[];
  try {
    applied = sqlite.prepare("SELECT name FROM schema_migration").all() as { name: string }[];
  } catch (error) {
    sqlite.close();
    throw new Error("缺少 SQLite 迁移；先执行 pnpm db:migrate", { cause: error });
  }

  const missing = migrationNames.filter(name => !applied.some(row => row.name === name));
  if (missing.length) {
    sqlite.close();
    throw new Error(`缺少 SQLite 迁移：${missing.join(", ")}`);
  }

  return new Repository(sqlite);
}
