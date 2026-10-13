import { afterEach, beforeEach, expect, it } from "vitest";

import type { BackupFile, CalendarEvent } from "../../packages/contracts/src/index.js";
import { calendarEvent, eventInput } from "../fixtures.js";
import { harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

it("导入预览不写库，计数与实际导入一致（任务 8）", async () => {
  const b = h.browser();
  await b.login();
  const ownerId = h.repo.users.getUserByUsername("admin")!.id;
  h.repo.events.putEvent(calendarEvent({ id: uuid(1), ownerId, name: "已有" }));
  await b.request("POST", "/api/admin/users", {
    username: "bob",
    displayName: "Bob",
    password: "bob-password-1",
    role: "user",
  });
  const bobId = h.repo.users.getUserByUsername("bob")!.id;
  h.repo.events.putEvent(calendarEvent({ id: uuid(2), ownerId: bobId, name: "他人" }));

  const file: BackupFile = {
    format: "timenote-backup",
    version: 1,
    exportedAt: new Date(h.clock.now).toISOString(),
    events: [
      { id: uuid(1), event: eventInput({ name: "覆盖已有" }) },
      { id: uuid(2), event: eventInput({ name: "撞他人 ID" }) },
      { id: uuid(3), event: eventInput({ name: "新增" }) },
      { id: uuid(3), event: eventInput({ name: "同文件重复" }) },
    ],
  };
  const before = h.repo.events.listEvents(ownerId);
  const preview = await b.request<{ created: number; updated: number }>("POST", "/api/backup/preview", file);
  expect(preview.status).toBe(200);
  expect(preview.json).toEqual({ created: 2, updated: 2 });
  expect(h.repo.events.listEvents(ownerId)).toEqual(before);

  const imported = await b.request<{ created: number; updated: number }>("POST", "/api/backup", file);
  expect(imported.json).toEqual(preview.json);
  const names = h.repo.events.listEvents(ownerId).map((event: CalendarEvent) => event.name);
  expect(names.sort()).toEqual(["同文件重复", "撞他人 ID", "覆盖已有"].sort());
  expect(h.repo.events.getEvent(bobId, uuid(2))?.name).toBe("他人");

  const unauthenticated = await h.browser().request("POST", "/api/backup/preview", file);
  expect(unauthenticated.status).toBe(401);
});
