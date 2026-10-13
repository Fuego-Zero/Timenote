import { join } from "node:path";

import { expect, it } from "vitest";

import { openRepository } from "../../packages/runtime/src/index.js";
import { migrate } from "../../packages/runtime/src/migrate.js";
import { openDatabase } from "../../packages/runtime/src/sqlite.js";
import { calendarEvent, temporaryDirectory } from "../fixtures.js";

it("0005 用 json_set 回填重复规则默认值，不改 revision 和 updatedAt，已有字段不动", async () => {
  const path = join(await temporaryDirectory("migrate-0005-"), "db.sqlite");
  migrate(path);
  const db = openDatabase(path);
  db.prepare("INSERT INTO user (id, username, payload) VALUES (?, ?, ?)").run(
    "owner",
    "owner",
    JSON.stringify({ id: "owner", username: "owner" })
  );
  const event = calendarEvent({ revision: 3 });
  // 升级前的事件没有这四个字段。
  const newFields = new Set(["recurrence", "gregorianMissingDay", "milestones", "milestoneTemplate"]);
  const legacy = Object.fromEntries(Object.entries(event).filter(([key]) => !newFields.has(key)));
  db.prepare("INSERT INTO event (id, owner, payload) VALUES (?, ?, ?)").run(
    event.id,
    event.ownerId,
    JSON.stringify(legacy)
  );
  db.prepare("DELETE FROM schema_migration WHERE name = '0005_recurrence'").run();
  db.close();

  migrate(path);
  migrate(path);
  const repo = openRepository(path);
  const migrated = repo.events.getEvent("owner", event.id);
  repo.close();
  expect(migrated).toEqual(calendarEvent({ revision: 3 }));
});
