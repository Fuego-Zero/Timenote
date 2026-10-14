import { existsSync } from "node:fs";

import { openDatabase } from "./sqlite.js";

export async function backupDatabase(source: string, destination: string) {
  if (existsSync(destination)) {
    throw new Error("备份路径必须未占用");
  }

  const db = openDatabase(source);
  try {
    await db.backup(destination);
  } finally {
    db.close();
  }
}
