import { join } from "node:path";

import { expect, it } from "vitest";

import { openRepository } from "../../packages/runtime/src/index.js";
import { migrate } from "../../packages/runtime/src/migrate.js";
import { calendarEvent, temporaryDirectory } from "../fixtures.js";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

it("listEventsByIds 不截断：json_each 传参，超过 SQLite 变量上限的 id 列表也能查全", async () => {
  const path = join(await temporaryDirectory("by-ids-"), "db.sqlite");
  migrate(path);
  const repo = openRepository(path);
  repo.users.putUser({
    id: "alice",
    username: "alice",
    displayName: "",
    role: "user",
    disabled: false,
    timeZone: "Asia/Shanghai",
    mustChangePassword: false,
    createdAt: 1,
    updatedAt: 1,
    passwordHash: "scrypt$test",
  });
  for (let n = 1; n <= 150; n += 1) {
    repo.events.putEvent(calendarEvent({ id: uuid(n), ownerId: "alice", createdAt: n, updatedAt: n }));
  }

  const owned = Array.from({ length: 150 }, (_value, index) => uuid(index + 1));
  expect(repo.events.listEventsByIds("alice", owned)).toHaveLength(150);
  // 40000 个 id 超过 SQLite 默认 32766 个绑定变量上限
  const many = [...owned, ...Array.from({ length: 40000 }, (_value, index) => uuid(100000 + index))];
  expect(repo.events.listEventsByIds("alice", many)).toHaveLength(150);
  expect(repo.events.listEventsByIds("bob", owned)).toEqual([]);
  repo.close();
});
