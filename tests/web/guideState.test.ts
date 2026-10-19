// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  initialChecklistState,
  progressDone,
  progressFrom,
  readAutoTourDone,
  readChecklistState,
  writeAutoTourDone,
  writeChecklistState,
} from "../../apps/web/src/features/guide/guideState.js";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("上手进度", () => {
  it("从事件数、订阅数和拉取记录推导", () => {
    expect(progressFrom(0, { items: [], total: 0 })).toEqual({ eventCount: 0, feedCount: 0, fetched: false });
    expect(
      progressFrom(3, { items: [{ lastFetchedAt: null }, { lastFetchedAt: 1_700_000_000_000 }], total: 2 })
    ).toEqual({ eventCount: 3, feedCount: 2, fetched: true });
  });

  it("三步都完成才算完成", () => {
    expect(progressDone({ eventCount: 1, feedCount: 1, fetched: false })).toBe(false);
    expect(progressDone({ eventCount: 0, feedCount: 1, fetched: true })).toBe(false);
    expect(progressDone({ eventCount: 1, feedCount: 1, fetched: true })).toBe(true);
  });
});

describe("清单显示状态", () => {
  const empty = { eventCount: 0, feedCount: 0, fetched: false };
  const existing = { eventCount: 5, feedCount: 1, fetched: true };

  it("未记录时只为还没有事件的账号自动开启", () => {
    expect(initialChecklistState(undefined, empty)).toBe("active");
    expect(initialChecklistState(undefined, existing)).toBeUndefined();
  });

  it("用户跳过后不再自动出现，重新打开后保持开启", () => {
    expect(initialChecklistState("dismissed", empty)).toBe("dismissed");
    expect(initialChecklistState("active", existing)).toBe("active");
  });

  it("按账号分别记录", () => {
    writeChecklistState("user-a", "dismissed");
    writeChecklistState("user-b", "active");
    expect(readChecklistState("user-a")).toBe("dismissed");
    expect(readChecklistState("user-b")).toBe("active");
    expect(readChecklistState("user-c")).toBeUndefined();
  });

  it("忽略无法识别的存储值", () => {
    localStorage.setItem("timenote.guide.user-a", "done");
    expect(readChecklistState("user-a")).toBeUndefined();
  });

  it("自动引导按账号只记一次，且不影响清单开关", () => {
    expect(readAutoTourDone("user-a")).toBe(false);
    writeAutoTourDone("user-a");
    expect(readAutoTourDone("user-a")).toBe(true);
    expect(readAutoTourDone("user-b")).toBe(false);
    expect(readChecklistState("user-a")).toBeUndefined();
  });

  it("存储不可用时不抛错", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeChecklistState("user-a", "dismissed")).not.toThrow();
    expect(() => writeAutoTourDone("user-a")).not.toThrow();
    expect(readChecklistState("user-a")).toBeUndefined();
    expect(readAutoTourDone("user-a")).toBe(false);
  });
});
