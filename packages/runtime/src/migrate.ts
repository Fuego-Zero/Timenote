import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { openDatabase } from "./sqlite.js";

export const migrationNames = [
  "0001_initial",
  "0002_feed_token",
  "0003_feed_event_ids_cleanup",
  "0004_list_indexes",
  "0005_recurrence",
] as const;

function sqlPath(name: string) {
  return join(dirname(fileURLToPath(import.meta.url)), "../migrations", `${name}.sql`);
}

/** 按清单顺序执行未应用的迁移；已应用的迁移校验 checksum，可重复执行。 */
export function migrate(path: string) {
  const db = openDatabase(path);
  try {
    const existingTables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    if (existingTables.length && !existingTables.some(row => row.name === "schema_migration")) {
      throw new Error("数据库存在未登记的表，拒绝自动迁移；请确认 SQLITE_PATH 指向岁时记（Timenote）数据库");
    }

    db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migration (name TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)"
    );
    const applied = new Map(
      (db.prepare("SELECT name, checksum FROM schema_migration").all() as { name: string; checksum: string }[]).map(
        row => [row.name, row.checksum]
      )
    );
    for (const name of migrationNames) {
      const sql = readFileSync(sqlPath(name), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = applied.get(name);
      if (existing) {
        if (existing !== checksum) {
          throw new Error(`校验和不匹配：${name}`);
        }

        continue;
      }

      const apply = db.transaction(() => {
        db.exec(sql);
        db.prepare("INSERT INTO schema_migration (name, checksum, applied_at) VALUES (?, ?, ?)").run(
          name,
          checksum,
          Date.now()
        );
      });
      apply.immediate();
    }
  } finally {
    db.close();
  }
}
