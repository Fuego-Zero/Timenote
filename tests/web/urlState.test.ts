import { describe, expect, it } from "vitest";

import { enumParam, readUrlState, writeUrlState } from "../../apps/web/src/ui/urlState.js";
import { eventPageQuerySchema } from "../../packages/contracts/src/index.js";

const schema = eventPageQuerySchema.omit({ ids: true });

describe("URL 状态同步", () => {
  it("没有参数时取默认值", () => {
    expect(readUrlState(schema, "")).toEqual({ page: 1, pageSize: 20, sort: "createdAt" });
  });

  it("写入后再读取能还原（刷新、分享链接）", () => {
    const state = readUrlState(schema, "");
    const search = writeUrlState(
      schema,
      { ...state, q: "小明", page: 3, pageSize: 50, sort: "nextOccurrence", kind: "birthday", hasAlarm: false },
      "?tab=events"
    );
    expect(search).toContain("tab=events");
    expect(search).not.toContain("calendar");
    expect(readUrlState(schema, search)).toEqual({
      q: "小明",
      page: 3,
      pageSize: 50,
      sort: "nextOccurrence",
      kind: "birthday",
      hasAlarm: false,
    });
  });

  it("非法参数只回退该项，其余参数保留", () => {
    expect(readUrlState(schema, "?page=0&pageSize=500&sort=bad&kind=birthday&hasAlarm=yes&q=%20")).toEqual({
      page: 1,
      pageSize: 20,
      sort: "createdAt",
      kind: "birthday",
    });
  });

  it("等于默认值的参数从地址里省略，不认识的参数原样保留", () => {
    expect(writeUrlState(schema, readUrlState(schema, ""), "?tab=feeds&page=4")).toBe("?tab=feeds");
  });
});

describe("页签参数", () => {
  const tabs = enumParam("tab", ["events", "feeds"], "events");

  it("合法值保留，非法值回退默认", () => {
    expect(readUrlState(tabs, "?tab=feeds")).toEqual({ tab: "feeds" });
    expect(readUrlState(tabs, "?tab=admin")).toEqual({ tab: "events" });
    expect(writeUrlState(tabs, { tab: "events" }, "?tab=feeds&q=x")).toBe("?q=x");
  });
});
