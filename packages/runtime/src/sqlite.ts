import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Sqlite from "better-sqlite3";

export function openDatabase(path: string): Sqlite.Database {
  if (!path || path === ":memory:") {
    throw new Error("SQLITE_PATH");
  }

  try {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  } catch {
    /* Windows may ignore directory mode. */
  }

  let db: Sqlite.Database;
  try {
    db = new Sqlite(path);
  } catch (error) {
    throw new Error(`SQLite 无法打开：${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }

  try {
    chmodSync(path, 0o600);
  } catch {
    /* Windows file mode is best-effort. */
  }

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = FULL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  return db;
}
