import { createHash } from "node:crypto";
import { join } from "node:path";

import { expect, it } from "vitest";

import { buildFeed } from "../../packages/calendar/src/index.js";
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

/**
 * 迁移前后订阅逐字节一致：golden 由迁移前代码（feature/init 66a90e4 的 packages/calendar）对同一事件生成，
 * ETag 与 renderFeed 同算法（sha256 base64url）。
 */
const goldenFeed =
  "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//timenote//timenote//ZH\r\nMETHOD:PUBLISH\r\nNAME:c\r\nX-WR-CALNAME:c\r\nREFRESH-INTERVAL;VALUE=DURATION:PT6H\r\nX-PUBLISHED-TTL:PT6H\r\nBEGIN:VEVENT\r\nUID:11111111-1111-4111-8111-111111111111-2026@timenote\r\nSEQUENCE:3\r\nDTSTAMP:20260101T083015Z\r\nDTSTART;VALUE=DATE:20260520\r\nDTEND;VALUE=DATE:20260521\r\nX-MICROSOFT-CDO-ALLDAYEVENT:TRUE\r\nX-MICROSOFT-MSNCALENDAR-ALLDAYEVENT:TRUE\r\nSUMMARY:💞 结婚第 6 周年\r\nTRANSP:TRANSPARENT\r\nDESCRIPTION:备注\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER;VALUE=DATE-TIME:20260519T010000Z\r\nDESCRIPTION:💞 结婚第 6 周年\r\nEND:VALARM\r\nLAST-MODIFIED:20260101T083015Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:11111111-1111-4111-8111-111111111111-2027@timenote\r\nSEQUENCE:3\r\nDTSTAMP:20260101T083015Z\r\nDTSTART;VALUE=DATE:20270520\r\nDTEND;VALUE=DATE:20270521\r\nX-MICROSOFT-CDO-ALLDAYEVENT:TRUE\r\nX-MICROSOFT-MSNCALENDAR-ALLDAYEVENT:TRUE\r\nSUMMARY:💞 结婚第 7 周年\r\nTRANSP:TRANSPARENT\r\nDESCRIPTION:备注\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER;VALUE=DATE-TIME:20270519T010000Z\r\nDESCRIPTION:💞 结婚第 7 周年\r\nEND:VALARM\r\nLAST-MODIFIED:20260101T083015Z\r\nEND:VEVENT\r\nX-WR-TIMEZONE:Asia/Shanghai\r\nEND:VCALENDAR\r\n";

it("迁移 0005 前后同一事件的订阅逐字节一致，ETag 相同", async () => {
  const path = join(await temporaryDirectory("migrate-0005-feed-"), "db.sqlite");
  migrate(path);
  const db = openDatabase(path);
  db.prepare("INSERT INTO user (id, username, payload) VALUES (?, ?, ?)").run(
    "owner",
    "owner",
    JSON.stringify({ id: "owner", username: "owner" })
  );
  // 迁移前的旧形态：没有重复规则四个字段，并把 0005 标为未执行。
  const legacy = {
    kind: "anniversary",
    name: "结婚",
    titleTemplate: "{{name}}第 {{years}} 周年",
    titlePrefix: "💞",
    note: "备注",
    date: { calendar: "gregorian", year: 2020, month: 5, day: 20, leapMonth: false },
    durationDays: 1,
    rules: { feb29: "feb28", leapMonth: "regular", missingDay: "lastDay" },
    alarms: [{ daysBefore: 1, time: "09:00" }],
    id: "11111111-1111-4111-8111-111111111111",
    ownerId: "owner",
    revision: 3,
    createdAt: Date.UTC(2026, 0, 1),
    updatedAt: Date.UTC(2026, 0, 1, 8, 30, 15, 789),
  };
  db.prepare("INSERT INTO event (id, owner, payload) VALUES (?, ?, ?)").run(legacy.id, "owner", JSON.stringify(legacy));
  db.prepare("DELETE FROM schema_migration WHERE name = '0005_recurrence'").run();
  db.close();

  migrate(path);
  const repo = openRepository(path);
  const body = buildFeed({
    calendarName: "c",
    timeZone: "Asia/Shanghai",
    window: { fromYear: 2026, toYear: 2027 },
    today: "2026-10-02",
    events: repo.events.listEvents("owner"),
  });
  repo.close();
  const etag = (text: string) => createHash("sha256").update(text).digest("base64url");
  expect(body).toBe(goldenFeed);
  expect(etag(body)).toBe("H7GByjMyWKpKUnvGbaIngFMpN0wAXxOhhbkv7y0FFy8");
});
