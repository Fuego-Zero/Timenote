import { drizzle } from "drizzle-orm/better-sqlite3";

import { EventStore } from "./eventStore.js";
import { FeedTokenStore } from "./feedTokenStore.js";
import { migrationNames } from "./migrate.js";
import { tables } from "./schema.js";
import { SessionStore } from "./sessionStore.js";
import { openDatabase } from "./sqlite.js";
import { UserStore } from "./userStore.js";

export interface OpenedRepository {
  close(): void;
  events: EventStore;
  feedTokens: FeedTokenStore;
  sessions: SessionStore;
  /** 同步 IMMEDIATE 事务：读取-校验-写入之间不会插入其他写操作。 */
  transaction<T>(fn: () => T): T;
  users: UserStore;
}

/** 打开已迁移的数据库；未执行迁移时立即失败，不在运行时隐式建表。返回按表拆分的 Store 与薄事务/关闭。 */
export function openRepository(path: string): OpenedRepository {
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

  const db = drizzle(sqlite, { schema: tables });
  return {
    users: new UserStore(db),
    sessions: new SessionStore(db),
    events: new EventStore(db),
    feedTokens: new FeedTokenStore(db),
    transaction<T>(fn: () => T): T {
      return sqlite.transaction(fn).immediate();
    },
    close() {
      sqlite.close();
    },
  };
}
