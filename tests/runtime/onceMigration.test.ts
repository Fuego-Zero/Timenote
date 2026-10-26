import { createHash } from "node:crypto";
import { join } from "node:path";

import { expect, it } from "vitest";

import { buildFeed } from "../../packages/calendar/src/index.js";
import { openRepository } from "../../packages/runtime/src/index.js";
import { migrate } from "../../packages/runtime/src/migrate.js";
import { openDatabase } from "../../packages/runtime/src/sqlite.js";
import { calendarEvent, temporaryDirectory } from "../fixtures.js";

it("0006 把普通事件的重复改成 null，不改 revision，订阅与只发生一次的结果一致", async () => {
  const path = join(await temporaryDirectory("migrate-0006-"), "db.sqlite");
  migrate(path);
  const db = openDatabase(path);
  db.prepare("INSERT INTO user (id, username, payload) VALUES (?, ?, ?)").run(
    "owner",
    "owner",
    JSON.stringify({ id: "owner", username: "owner" })
  );
  const once = calendarEvent({
    kind: "event",
    name: "旅行",
    titleTemplate: "{{name}}",
    recurrence: null,
    date: { year: 2026, month: 10, day: 1 },
    revision: 4,
  });
  const legacy = { ...once, recurrence: { unit: "year", interval: 1, end: { type: "never" } } };
  const birthday = calendarEvent({
    id: "22222222-2222-4222-8222-222222222222",
    kind: "birthday",
    revision: 2,
  });
  const insert = db.prepare("INSERT INTO event (id, owner, payload) VALUES (?, ?, ?)");
  insert.run(legacy.id, legacy.ownerId, JSON.stringify(legacy));
  insert.run(birthday.id, birthday.ownerId, JSON.stringify(birthday));
  db.prepare("DELETE FROM schema_migration WHERE name = '0006_once_recurrence'").run();
  db.close();

  migrate(path);
  const repo = openRepository(path);
  const migrated = repo.events.getEvent("owner", once.id);
  const kept = repo.events.getEvent("owner", birthday.id);
  const body = buildFeed({
    calendarName: "c",
    events: migrated ? [migrated] : [],
    timeZone: "Asia/Shanghai",
    today: "2026-10-02",
    window: { fromYear: 2026, toYear: 2027 },
  });
  const expected = buildFeed({
    calendarName: "c",
    events: [once],
    timeZone: "Asia/Shanghai",
    today: "2026-10-02",
    window: { fromYear: 2026, toYear: 2027 },
  });
  repo.close();
  expect(migrated?.recurrence).toBeNull();
  expect(migrated?.revision).toBe(4);
  expect(kept?.recurrence).toEqual({ unit: "year", interval: 1, end: { type: "never" } });
  expect(body).toBe(expected);
  expect(createHash("sha256").update(body).digest("base64url")).toBe(
    createHash("sha256").update(expected).digest("base64url")
  );
});
