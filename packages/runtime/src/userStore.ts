import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { type StoredUser, storedUserSchema } from "./entities.js";
import { tables, users } from "./schema.js";

/** 用户表 DAO：只负责读写，不承载业务决策。 */
export class UserStore {
  constructor(private db: BetterSQLite3Database<typeof tables>) {}

  getUser(id: string): StoredUser | undefined {
    const row = this.db.select().from(users).where(eq(users.id, id)).get();
    return row ? storedUserSchema.parse(JSON.parse(row.payload)) : undefined;
  }

  getUserByUsername(username: string): StoredUser | undefined {
    const row = this.db.select().from(users).where(eq(users.username, username)).get();
    return row ? storedUserSchema.parse(JSON.parse(row.payload)) : undefined;
  }

  listUsers(): StoredUser[] {
    return this.db
      .select()
      .from(users)
      .orderBy(users.username)
      .all()
      .map(row => storedUserSchema.parse(JSON.parse(row.payload)));
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
}
