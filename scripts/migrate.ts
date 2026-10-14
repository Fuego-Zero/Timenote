import { loadDotenv } from "../packages/runtime/src/env.js";
import { migrate } from "../packages/runtime/src/migrate.js";

loadDotenv(".env");
if (!process.env.SQLITE_PATH) {
  throw new Error("缺少 SQLITE_PATH");
}

migrate(process.env.SQLITE_PATH);
console.log("SQLite 迁移完成");
