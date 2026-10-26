import ICAL from "ical.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { BackupFile, CalendarEvent, FeedToken, Recurrence } from "../../packages/contracts/src/index.js";
import { calendarEvent, eventInput } from "../fixtures.js";
import { harness, type Harness } from "../helpers.js";

let h: Harness;
beforeEach(async () => {
  h = await harness();
});
afterEach(async () => {
  await h.close();
});

const daily: Recurrence = { unit: "day", interval: 1, end: { type: "never" } };
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function signedIn() {
  const b = h.browser();
  await b.login();
  const feed = await b.request<{ feed: FeedToken }>("POST", "/api/feed-tokens", { name: "iPhone" });
  const path = new URL(feed.json.feed.url ?? "").pathname;
  const fetchFeed = () => h.browser().request("GET", path);
  return { b, fetchFeed };
}

function vevents(body: string) {
  return ICAL.Component.fromString(body)
    .getAllSubcomponents("vevent")
    .map(vevent => ({
      uid: String(vevent.getFirstPropertyValue("uid")),
      summary: String(vevent.getFirstPropertyValue("summary")),
      start: String(vevent.getFirstPropertyValue("dtstart")),
      sequence: Number(vevent.getFirstPropertyValue("sequence")),
    }));
}

describe("重复规则与订阅", () => {
  it("每月 31 日、共 6 个周期、里程碑 100：条数、SUMMARY、UID、SEQUENCE 正确；改规则后旧 UID 消失", async () => {
    const { b, fetchFeed } = await signedIn();
    const created = await b.request<{ event: CalendarEvent }>(
      "POST",
      "/api/events",
      eventInput({
        kind: "anniversary",
        name: "恋爱",
        titlePrefix: "",
        titleTemplate: "{{name}}第 {{count}} 个月",
        date: { year: 2026, month: 1, day: 31 },
        recurrence: { unit: "month", interval: 1, end: { type: "count", count: 6 } },
        milestones: [100],
      })
    );
    expect(created.status).toBe(201);
    const { id } = created.json.event;
    const first = vevents((await fetchFeed()).body);
    expect(first).toEqual([
      { uid: `${id}-k1@timenote`, summary: "恋爱第 1 个月", start: "2026-02-28", sequence: 0 },
      { uid: `${id}-k2@timenote`, summary: "恋爱第 2 个月", start: "2026-03-31", sequence: 0 },
      { uid: `${id}-k3@timenote`, summary: "恋爱第 3 个月", start: "2026-04-30", sequence: 0 },
      { uid: `${id}-k4@timenote`, summary: "恋爱第 4 个月", start: "2026-05-31", sequence: 0 },
      { uid: `${id}-k5@timenote`, summary: "恋爱第 5 个月", start: "2026-06-30", sequence: 0 },
      { uid: `${id}-k6@timenote`, summary: "恋爱第 6 个月", start: "2026-07-31", sequence: 0 },
      { uid: `${id}-m100@timenote`, summary: "恋爱第 100 天", start: "2026-05-11", sequence: 0 },
    ]);

    const updated = await b.request<{ event: CalendarEvent }>("PUT", `/api/events/${id}`, {
      ...created.json.event,
      recurrence: { unit: "week", interval: 2, end: { type: "count", count: 2 } },
      titleTemplate: "{{name}}第 {{count}} 次",
      milestones: [],
    });
    expect(updated.json.event.revision).toBe(1);
    const second = (await fetchFeed()).body;
    expect(vevents(second).map(item => [item.uid, item.sequence])).toEqual([
      [`${id}-k1@timenote`, 1],
      [`${id}-k2@timenote`, 1],
    ]);
    expect(second).not.toMatch(/m100|RRULE|CANCELLED/);
  });

  it("超出总量上限时保存和导入都返回 RECURRENCE_LIMIT，订阅仍 200", async () => {
    const { b, fetchFeed } = await signedIn();
    const ownerId = h.repo.users.getUserByUsername("admin")?.id ?? "";
    // 208 个按天重复的事件，每个计 72，合计 14976。
    for (let n = 1; n <= 208; n += 1) {
      h.repo.events.putEvent(
        calendarEvent({
          id: uuid(n),
          ownerId,
          kind: "anniversary",
          titleTemplate: "{{name}}第 {{count}} 天",
          date: { year: 2026, month: 1, day: 1 },
          recurrence: daily,
        })
      );
    }

    const extra = eventInput({
      kind: "anniversary",
      titleTemplate: "{{name}}第 {{years}} 周年",
      milestones: Array.from({ length: 20 }, (_, i) => (i + 1) * 100),
    });
    const kept = await b.request<{ event: CalendarEvent }>("POST", "/api/events", extra);
    expect(kept.status).toBe(201);
    const over = await b.request<{ code: string; message: string }>("POST", "/api/events", { ...extra, name: "再加" });
    expect(over.status).toBe(422);
    expect(over.json).toMatchObject({ code: "RECURRENCE_LIMIT" });

    // 修改同样检查：把这条改成按天重复（+72）会超出上限，返回 422 且库里保持原样。
    const before = h.repo.events.getEvent(ownerId, kept.json.event.id);
    const updated = await b.request<{ code: string }>("PUT", `/api/events/${kept.json.event.id}`, {
      ...extra,
      titleTemplate: "{{name}}第 {{count}} 天",
      recurrence: daily,
    });
    expect(updated.status).toBe(422);
    expect(updated.json.code).toBe("RECURRENCE_LIMIT");
    expect(h.repo.events.getEvent(ownerId, kept.json.event.id)).toEqual(before);

    const file: BackupFile = {
      format: "timenote-backup",
      version: 3,
      exportedAt: new Date(h.clock.now).toISOString(),
      events: [
        { id: uuid(900), event: eventInput({ name: "合法" }) },
        { id: uuid(901), event: { ...extra, name: "超出" } },
      ],
    };
    const count = h.repo.events.listEvents(ownerId).length;
    const preview = await b.request<{ code: string }>("POST", "/api/backup/preview", file);
    expect(preview.json.code).toBe("RECURRENCE_LIMIT");
    const imported = await b.request<{ code: string }>("POST", "/api/backup", file);
    expect(imported.status).toBe(422);
    expect(imported.json.code).toBe("RECURRENCE_LIMIT");
    expect(h.repo.events.listEvents(ownerId)).toHaveLength(count);

    const feed = await fetchFeed();
    expect(feed.status).toBe(200);
  });

  it("备份 v3 往返无损，更早版本被拒", async () => {
    const { b } = await signedIn();
    await b.request(
      "POST",
      "/api/events",
      eventInput({
        kind: "anniversary",
        titleTemplate: "{{name}}第 {{count}} 次",
        recurrence: { unit: "week", interval: 3, end: { type: "until", until: "2030-01-01" } },
        gregorianMissingDay: "skip",
        milestones: [520, 100],
        milestoneTemplate: "{{days}} 天啦",
      })
    );
    const exported = await b.request<BackupFile>("GET", "/api/backup");
    expect(exported.json.version).toBe(3);
    const reimport = await b.request("POST", "/api/backup", exported.json);
    expect(reimport.json).toEqual({ created: 0, updated: 1 });
    const again = await b.request<BackupFile>("GET", "/api/backup");
    expect(again.json.events).toEqual(exported.json.events);

    const v1 = await b.request<{ code: string; fields: Record<string, { detail: string }> }>("POST", "/api/backup", {
      ...exported.json,
      version: 1,
    });
    expect(v1.status).toBe(400);
    expect(Object.values(v1.json.fields ?? {}).map(field => field.detail)).toContain("backup_v1");
  });
});
