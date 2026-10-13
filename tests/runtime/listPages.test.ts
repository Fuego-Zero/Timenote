import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";

import { EventStore, FeedTokenStore, openRepository, UserStore } from "../../packages/runtime/src/index.js";
import { migrate } from "../../packages/runtime/src/migrate.js";
import { tables } from "../../packages/runtime/src/schema.js";
import { openDatabase } from "../../packages/runtime/src/sqlite.js";
import { calendarEvent, temporaryDirectory } from "../fixtures.js";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const hash = (n: number) => String(n).padStart(64, "0");
const page = (pageNumber = 1, pageSize = 20) => ({ page: pageNumber, pageSize });

function user(id: string, username: string, createdAt: number, displayName = "") {
  return {
    id,
    username,
    displayName,
    role: "user" as const,
    disabled: false,
    timeZone: "Asia/Shanghai",
    mustChangePassword: false,
    createdAt,
    updatedAt: createdAt,
    passwordHash: "scrypt$test",
  };
}

async function freshRepository() {
  const path = join(await temporaryDirectory("pages-"), "db.sqlite");
  migrate(path);
  return { path, repo: openRepository(path) };
}

describe("分页仓储", () => {
  it("事件：createdAt DESC, id 排序稳定、分页边界、total 与 owner 隔离", async () => {
    const { repo } = await freshRepository();
    repo.users.putUser(user("alice", "alice", 1));
    repo.users.putUser(user("bob", "bob", 2));
    // uuid(2) 与 uuid(3) createdAt 相同，按 id 升序。
    const times = [100, 300, 300, 200, 50];
    times.forEach((createdAt, index) =>
      repo.events.putEvent(calendarEvent({ id: uuid(index + 1), ownerId: "alice", createdAt, updatedAt: createdAt }))
    );
    repo.events.putEvent(calendarEvent({ id: uuid(99), ownerId: "bob", createdAt: 999, updatedAt: 999 }));

    const first = repo.events.listEventsPage("alice", page(1, 2));
    expect(first.total).toBe(5);
    expect(first.items.map(event => event.id)).toEqual([uuid(2), uuid(3)]);
    expect(repo.events.listEventsPage("alice", page(2, 2)).items.map(event => event.id)).toEqual([uuid(4), uuid(1)]);
    expect(repo.events.listEventsPage("alice", page(3, 2)).items.map(event => event.id)).toEqual([uuid(5)]);
    expect(repo.events.listEventsPage("alice", page(4, 2))).toEqual({ items: [], total: 5, page: 4, pageSize: 2 });
    expect(repo.events.listEventsPage("bob", page()).items.map(event => event.id)).toEqual([uuid(99)]);
    expect(repo.events.listEventsByIds("alice", [uuid(1), uuid(99), uuid(3)]).map(event => event.id)).toEqual([
      uuid(3),
      uuid(1),
    ]);
    expect(repo.events.listEventsByIds("alice", [])).toEqual([]);
    repo.close();
  });

  it("事件：% _ \\ 字面匹配，kind/calendar/hasAlarm/ids 以 AND 组合", async () => {
    const { repo } = await freshRepository();
    repo.users.putUser(user("alice", "alice", 1));
    const names = ["100%满意", "a_b", "a\\b", "axb", "普通"];
    names.forEach((name, index) =>
      repo.events.putEvent(
        calendarEvent({
          id: uuid(index + 1),
          ownerId: "alice",
          name,
          createdAt: index + 1,
          kind: index === 4 ? "anniversary" : "birthday",
          date: index === 3 ? { calendar: "lunar", year: 1990, month: 1, day: 1 } : {},
          alarms: index === 0 ? [{ daysBefore: 1, time: "09:00" }] : [],
        })
      )
    );
    const names_ = (query: Parameters<typeof repo.events.listEventsPage>[1]) =>
      repo.events.listEventsPage("alice", query).items.map(event => event.name);

    expect(names_({ ...page(), q: "%" })).toEqual(["100%满意"]);
    expect(names_({ ...page(), q: "_" })).toEqual(["a_b"]);
    expect(names_({ ...page(), q: "\\" })).toEqual(["a\\b"]);
    expect(names_({ ...page(), kind: "anniversary" })).toEqual(["普通"]);
    expect(names_({ ...page(), calendar: "lunar" })).toEqual(["axb"]);
    expect(names_({ ...page(), hasAlarm: true })).toEqual(["100%满意"]);
    expect(names_({ ...page(), hasAlarm: false })).toHaveLength(4);
    expect(names_({ ...page(), ids: [uuid(1), uuid(2)], hasAlarm: false })).toEqual(["a_b"]);
    repo.close();
  });

  it("订阅与用户：分页、字面搜索、排序；removeEventIdFromFeeds 只动本人订阅并保序", async () => {
    const { repo } = await freshRepository();
    repo.users.putUser(user("alice", "alice", 10, "爱丽丝"));
    repo.users.putUser(user("bob", "b_ob", 20));
    repo.users.putUser(user("carol", "carol", 20, "50%"));
    const feed = (id: number, ownerId: string, name: string, createdAt: number, eventIds?: string[]) => ({
      id: uuid(id),
      ownerId,
      name,
      tokenHash: hash(id),
      createdAt,
      rotatedAt: createdAt,
      ...(eventIds ? { eventScope: "selected" as const, eventIds } : {}),
    });
    repo.feedTokens.putFeedToken(feed(1, "alice", "iPhone_1", 1, [uuid(7), uuid(8), uuid(9)]));
    repo.feedTokens.putFeedToken(feed(2, "alice", "iPhonex1", 2, [uuid(8)]));
    repo.feedTokens.putFeedToken(feed(3, "alice", "电脑", 3));
    repo.feedTokens.putFeedToken(feed(4, "bob", "bob", 4, [uuid(8)]));

    const feeds = repo.feedTokens.listFeedTokensPage("alice", page(1, 2));
    expect(feeds.total).toBe(3);
    expect(feeds.items.map(item => item.name)).toEqual(["电脑", "iPhonex1"]);
    expect(repo.feedTokens.listFeedTokensPage("alice", { ...page(), q: "_" }).items.map(item => item.name)).toEqual([
      "iPhone_1",
    ]);

    expect(repo.feedTokens.removeEventIdFromFeeds("alice", uuid(8))).toBe(2);
    expect(repo.feedTokens.getFeedToken("alice", uuid(1))?.eventIds).toEqual([uuid(7), uuid(9)]);
    expect(repo.feedTokens.getFeedToken("alice", uuid(2))?.eventIds).toEqual([]);
    expect(repo.feedTokens.getFeedToken("alice", uuid(3))?.eventIds).toBeUndefined();
    expect(repo.feedTokens.getFeedToken("bob", uuid(4))?.eventIds).toEqual([uuid(8)]);

    const users = repo.users.listUsersPage(page(1, 2));
    expect(users.total).toBe(3);
    expect(users.items.map(item => item.id)).toEqual(["bob", "carol"]);
    expect(repo.users.listUsersPage({ ...page(), q: "_" }).items.map(item => item.id)).toEqual(["bob"]);
    expect(repo.users.listUsersPage({ ...page(), q: "%" }).items.map(item => item.id)).toEqual(["carol"]);
    expect(repo.users.listUsersPage({ ...page(), q: "爱丽" }).items.map(item => item.id)).toEqual(["alice"]);
    repo.close();
  });
});

describe("迁移 0003/0004", () => {
  function applyOldMigrations(path: string) {
    const db = openDatabase(path);
    db.exec(
      "CREATE TABLE schema_migration (name TEXT PRIMARY KEY NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)"
    );
    for (const name of ["0001_initial", "0002_feed_token"]) {
      const sql = readFileSync(join(process.cwd(), "packages/runtime/migrations", `${name}.sql`), "utf8");
      db.exec(sql);
      db.prepare("INSERT INTO schema_migration VALUES (?, ?, ?)").run(
        name,
        createHash("sha256").update(sql).digest("hex"),
        Date.now()
      );
    }

    return db;
  }

  it("旧库：清理悬空与他人的 eventIds、保序，空数组与全悬空为 []，不动 all 订阅；重复执行不报错", async () => {
    const path = join(await temporaryDirectory("migrate-old-"), "db.sqlite");
    const db = applyOldMigrations(path);
    const insertUser = db.prepare('INSERT INTO "user" (id, username, payload) VALUES (?, ?, ?)');
    for (const id of ["alice", "bob"]) {
      insertUser.run(id, id, JSON.stringify({ id, username: id, createdAt: 1 }));
    }

    const insertEvent = db.prepare("INSERT INTO event (id, owner, payload) VALUES (?, ?, ?)");
    for (const [id, owner] of [
      [uuid(1), "alice"],
      [uuid(2), "alice"],
      [uuid(3), "alice"],
      [uuid(9), "bob"],
    ] as const) {
      insertEvent.run(id, owner, JSON.stringify({ id, ownerId: owner, createdAt: 1 }));
    }

    const insertFeed = db.prepare("INSERT INTO feed_token (id, owner, token_hash, payload) VALUES (?, ?, ?, ?)");
    const feeds: [number, string, string[] | undefined][] = [
      [11, "alice", [uuid(3), uuid(50), uuid(1), uuid(9)]],
      [12, "alice", []],
      [13, "alice", [uuid(50), uuid(9)]],
      [14, "alice", undefined],
    ];
    for (const [n, owner, eventIds] of feeds) {
      const payload = {
        id: uuid(n),
        ownerId: owner,
        tokenHash: hash(n),
        createdAt: n,
        ...(eventIds ? { eventIds } : {}),
      };
      insertFeed.run(uuid(n), owner, hash(n), JSON.stringify(payload));
    }

    db.close();
    migrate(path);
    migrate(path);

    const check = openDatabase(path);
    const ids = (n: number) =>
      check.prepare("SELECT json_extract(payload, '$.eventIds') AS ids FROM feed_token WHERE id = ?").get(uuid(n)) as {
        ids: string | null;
      };
    expect(JSON.parse(ids(11).ids!)).toEqual([uuid(3), uuid(1)]);
    expect(JSON.parse(ids(12).ids!)).toEqual([]);
    expect(JSON.parse(ids(13).ids!)).toEqual([]);
    expect(ids(14).ids).toBeNull();
    expect(
      check
        .prepare(
          "SELECT count(*) AS n FROM feed_token WHERE json_type(payload, '$.eventIds') IS NOT NULL AND json_type(payload, '$.eventIds') <> 'array'"
        )
        .get()
    ).toEqual({ n: 0 });
    expect(
      check
        .prepare(
          "SELECT count(*) AS n FROM feed_token WHERE id IN (?, ?, ?) AND json_type(payload, '$.eventIds') = 'array'"
        )
        .get(uuid(11), uuid(12), uuid(13))
    ).toEqual({ n: 3 });
    expect(
      check
        .prepare(
          "SELECT count(*) AS n FROM feed_token f, json_each(f.payload, '$.eventIds') j WHERE NOT EXISTS (SELECT 1 FROM event e WHERE e.id = j.value AND e.owner = f.owner)"
        )
        .get()
    ).toEqual({ n: 0 });
    expect(
      check
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE '%created_idx' ORDER BY name")
        .all()
    ).toEqual([
      { name: "event_owner_created_idx" },
      { name: "feed_token_owner_created_idx" },
      { name: "user_created_idx" },
    ]);
    expect(
      check.prepare("SELECT count(*) AS n FROM \"user\" WHERE json_extract(payload,'$.createdAt') IS NULL").get()
    ).toEqual({
      n: 0,
    });
    check.close();
  });

  it("仓储实际执行的分页查询命中 *_created_idx", async () => {
    const { path, repo } = await freshRepository();
    repo.close();
    const sqlite = openDatabase(path);
    const logged: { query: string; params: unknown[] }[] = [];
    const db = drizzle(sqlite, {
      schema: tables,
      logger: { logQuery: (query, params) => logged.push({ query, params }) },
    });
    const planOf = (run: () => unknown) => {
      logged.length = 0;
      run();
      const paged = logged.find(entry => entry.query.includes("limit"))!;
      const detail = (sqlite.prepare(`EXPLAIN QUERY PLAN ${paged.query}`).all(...paged.params) as { detail: string }[])
        .map(row => row.detail)
        .join(" | ");
      console.log(`${paged.query}\n  => ${detail}`);
      return detail;
    };

    expect(planOf(() => new EventStore(db).listEventsPage("a", page()))).toMatch(/USING INDEX event_owner_created_idx/);
    expect(planOf(() => new FeedTokenStore(db).listFeedTokensPage("a", page()))).toMatch(
      /USING INDEX feed_token_owner_created_idx/
    );
    expect(planOf(() => new UserStore(db).listUsersPage(page()))).toMatch(/USING INDEX user_created_idx/);
    sqlite.close();
  });
});
