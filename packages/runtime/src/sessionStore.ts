import { and, eq, lte, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { type Session, sessionSchema } from "./entities.js";
import { sessions, type tables } from "./schema.js";

/** 会话表 DAO：只负责读写，不承载业务决策。 */
export class SessionStore {
  constructor(private db: BetterSQLite3Database<typeof tables>) {}

  getSession(id: string): Session | undefined {
    const row = this.db.select().from(sessions).where(eq(sessions.id, id)).get();
    return row ? sessionSchema.parse(JSON.parse(row.payload)) : undefined;
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
}
