import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { FeedToken } from "../../packages/contracts/src/index.js";
import {
  hashPassword,
  loadConfig,
  openRepository,
  redact,
  redactPath,
  verifyPassword,
} from "../../packages/runtime/src/index.js";
import { migrate } from "../../packages/runtime/src/migrate.js";
import { openDatabase } from "../../packages/runtime/src/sqlite.js";
import { eventInput, temporaryDirectory } from "../fixtures.js";
import { adminPassword, harness } from "../helpers.js";

describe("迁移", () => {
  it("可重复执行，已应用的迁移不重复执行", async () => {
    const path = join(await temporaryDirectory("migrate-"), "db.sqlite");
    migrate(path);
    migrate(path);
    const db = openDatabase(path);
    expect(db.prepare("SELECT name FROM schema_migration ORDER BY name").all()).toEqual([
      { name: "0001_initial" },
      { name: "0002_feed_token" },
      { name: "0003_feed_event_ids_cleanup" },
      { name: "0004_list_indexes" },
    ]);
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    db.close();
    openRepository(path).close();
  });

  it("拒绝迁移含未登记表的数据库，也拒绝未迁移的数据库被直接打开", async () => {
    const dir = await temporaryDirectory("migrate-");
    const foreign = join(dir, "foreign.sqlite");
    const db = openDatabase(foreign);
    db.exec("CREATE TABLE something_else (id TEXT)");
    db.close();
    expect(() => migrate(foreign)).toThrow(/未登记的表/);
    expect(() => openRepository(join(dir, "empty.sqlite"))).toThrow();
  });

  it("已应用迁移的校验和被改动时拒绝继续", async () => {
    const path = join(await temporaryDirectory("migrate-"), "db.sqlite");
    migrate(path);
    const db = openDatabase(path);
    db.prepare("UPDATE schema_migration SET checksum = 'tampered'").run();
    db.close();
    expect(() => migrate(path)).toThrow(/校验和不匹配/);
  });
});

describe("配置", () => {
  const base = { SQLITE_PATH: ".tmp/x.sqlite" };

  it("默认值与端口", () => {
    const config = loadConfig(base);
    expect(config).toMatchObject({
      env: "development",
      apiPort: 8721,
      webPort: 8720,
      webBindHost: "127.0.0.1",
      webOrigin: "http://127.0.0.1:8720",
      cookieSecure: false,
      cookieName: "timenote.session",
      devAuthBypass: true,
      defaultTimeZone: "Asia/Shanghai",
      feedPastYears: 1,
      feedFutureYears: 20,
    });
  });

  it("生产环境要求 HTTPS 来源，强制安全 Cookie 并使用 __Host- 前缀", () => {
    expect(() => loadConfig({ ...base, NODE_ENV: "production" })).toThrow();
    const prod = loadConfig({
      ...base,
      NODE_ENV: "production",
      WEB_ORIGIN: "https://cal.example.com",
      SIGN_MASTER_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    });
    expect(prod).toMatchObject({ cookieSecure: true, cookieName: "__Host-timenote", devAuthBypass: false });
    expect(() =>
      loadConfig({
        ...base,
        NODE_ENV: "production",
        WEB_ORIGIN: "https://cal.example.com",
        SIGN_MASTER_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        COOKIE_SECURE: "false",
      })
    ).toThrow(/COOKIE_SECURE/);
  });

  it("拒绝缺失或不合法的值", () => {
    expect(() => loadConfig({})).toThrow(/SQLITE_PATH/);
    expect(() => loadConfig({ SQLITE_PATH: ":memory:" })).toThrow();
    expect(() => loadConfig({ ...base, API_PORT: "70000" })).toThrow(/API_PORT/);
    expect(() => loadConfig({ ...base, DEFAULT_TIME_ZONE: "Mars/Base" })).toThrow(/DEFAULT_TIME_ZONE/);
    expect(() => loadConfig({ ...base, WEB_ORIGIN: "http://127.0.0.1:8720/app" })).toThrow();
  });

  it("DEV_AUTH_BYPASS only enables in development", () => {
    expect(loadConfig(base).devAuthBypass).toBe(true);
    expect(loadConfig({ ...base, DEV_AUTH_BYPASS: "0" }).devAuthBypass).toBe(false);
    expect(loadConfig({ ...base, NODE_ENV: "test" }).devAuthBypass).toBe(false);
    expect(
      loadConfig({
        ...base,
        NODE_ENV: "production",
        WEB_ORIGIN: "https://cal.example.com",
        SIGN_MASTER_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      }).devAuthBypass
    ).toBe(false);
    expect(
      loadConfig({
        ...base,
        NODE_ENV: "production",
        WEB_ORIGIN: "https://cal.example.com",
        SIGN_MASTER_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        DEV_AUTH_BYPASS: "1",
      }).devAuthBypass
    ).toBe(false);
  });
});

describe("安全", () => {
  it("密码使用带盐 scrypt，同一密码每次哈希不同", async () => {
    const first = await hashPassword("correct horse");
    const second = await hashPassword("correct horse");
    expect(first).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(first).not.toBe(second);
    expect(await verifyPassword("correct horse", first)).toBe(true);
    expect(await verifyPassword("wrong horse", first)).toBe(false);
  });

  it("日志路径只保留 token 前 4 位，敏感字段整体脱敏", () => {
    expect(redactPath(`/api/feeds/${"A".repeat(43)}.ics`)).toBe("/api/feeds/AAAA….ics");
    expect(redact({ username: "a", password: "p", nested: { url: "u", feedToken: "t" } })).toEqual({
      username: "a",
      password: "[redacted]",
      nested: { url: "[redacted]", feedToken: "[redacted]" },
    });
  });

  it("开发环境的完整请求日志里不出现密码、会话 Cookie 或完整订阅 token", async () => {
    const lines: string[] = [];
    const h = await harness({ NODE_ENV: "development" }, { logSink: { write: line => lines.push(line) } });
    try {
      const b = h.browser();
      const login = await b.login();
      const session = /=([\w-]{43})/.exec(String(login.headers["set-cookie"]))![1]!;
      await b.request("POST", "/api/events", eventInput());
      const issued = await b.request<{ feed: FeedToken }>("POST", "/api/feed-tokens", { name: "iPhone" });
      const token = /([\w-]{43})\.ics$/.exec(issued.json.feed.url!)![1]!;
      await b.request("GET", new URL(issued.json.feed.url!).pathname);

      const log = lines.join("\n");
      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(log).toContain(`/api/feeds/${token.slice(0, 4)}…`);
      for (const secret of [adminPassword, session, token]) {
        expect(log).not.toContain(secret);
      }
    } finally {
      await h.close();
    }
  });
});
