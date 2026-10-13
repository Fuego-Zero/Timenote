import { describe, expect, it } from "vitest";

import { chunkIds, fetchEventsByIds } from "../../apps/web/src/features/events/eventsByIds.js";
import type { CalendarEvent, PageResult } from "../../packages/contracts/src/index.js";
import { calendarEvent } from "../fixtures.js";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("按 id 分批取事件", () => {
  it("150 个 id 切成 100 + 50 两批，并行请求后按原顺序合并", async () => {
    const ids = Array.from({ length: 150 }, (_value, index) => uuid(150 - index));
    expect(chunkIds(ids).map(chunk => chunk.length)).toEqual([100, 50]);

    const queries: URLSearchParams[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const result = await fetchEventsByIds([...ids, ids[0]], async query => {
      const params = new URLSearchParams(query);
      queries.push(params);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      const wanted = params.get("ids")!.split(",");
      const items = wanted
        .filter(id => id !== uuid(7))
        .map(id => calendarEvent({ id, name: id }))
        .reverse();
      return { items, total: items.length, page: 1, pageSize: 100 } satisfies PageResult<CalendarEvent>;
    });

    expect(queries.map(params => params.get("ids")!.split(",").length)).toEqual([100, 50]);
    expect(queries.every(params => params.get("pageSize") === "100")).toBe(true);
    expect(maxInFlight).toBe(2);
    expect(result.map(event => event.id)).toEqual(ids.filter(id => id !== uuid(7)));
  });

  it("空列表不发请求", async () => {
    let called = false;
    await expect(
      fetchEventsByIds([], () => {
        called = true;
        return Promise.reject(new Error("不应请求"));
      })
    ).resolves.toEqual([]);
    expect(called).toBe(false);
  });
});
