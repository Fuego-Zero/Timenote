import type { PageQuery, PageResult } from "@timenote/contracts";
import { count, eq, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { type StoredUser, storedUserSchema } from "./entities.js";
import { containsPattern, pageOffset } from "./pageQuery.js";
import { type tables, users } from "./schema.js";

/** 与索引 user_created_idx 逐字一致。 */
const newestFirst = sql`json_extract(payload,'$.createdAt') DESC, id`;

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

  /** 分页列表：createdAt DESC, id；按用户名或显示名称字面子串匹配。 */
  listUsersPage(query: PageQuery): PageResult<StoredUser> {
    const pattern = query.q === undefined ? undefined : containsPattern(query.q);
    const where =
      pattern === undefined
        ? undefined
        : sql`(username LIKE ${pattern} ESCAPE '\\' OR json_extract(payload,'$.displayName') LIKE ${pattern} ESCAPE '\\')`;
    const total = this.db.select({ total: count() }).from(users).where(where).get()?.total ?? 0;
    const items = this.db
      .select({ payload: users.payload })
      .from(users)
      .where(where)
      .orderBy(newestFirst)
      .limit(query.pageSize)
      .offset(pageOffset(query.page, query.pageSize))
      .all()
      .map(row => storedUserSchema.parse(JSON.parse(row.payload)));
    return { items, total, page: query.page, pageSize: query.pageSize };
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
