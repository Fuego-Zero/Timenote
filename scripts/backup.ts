import { backupDatabase } from "../packages/runtime/src/backup.js";
import { loadDotenv } from "../packages/runtime/src/env.js";

loadDotenv(".env");
if (!process.env.SQLITE_PATH || !process.env.SQLITE_BACKUP_PATH) {
  throw new Error("配置 SQLITE_PATH 和未占用的 SQLITE_BACKUP_PATH");
}

await backupDatabase(process.env.SQLITE_PATH, process.env.SQLITE_BACKUP_PATH);
console.log("SQLite 一致性备份完成");
