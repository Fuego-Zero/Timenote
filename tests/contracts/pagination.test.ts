import { describe, expect, it } from "vitest";

import { eventPageQuerySchema, pageQuerySchema } from "../../packages/contracts/src/index.js";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("分页查询契约", () => {
  it("默认 page=1、pageSize=20", () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it.each([{ page: "0" }, { page: "1.5" }, { page: "" }, { pageSize: "101" }])("拒绝 %o", input => {
    expect(pageQuerySchema.safeParse(input).success).toBe(false);
  });

  it("空白关键字视为未搜索，超长拒绝", () => {
    expect(pageQuerySchema.parse({ q: "  " }).q).toBeUndefined();
    expect(pageQuerySchema.parse({ q: " 小明 " }).q).toBe("小明");
    expect(pageQuerySchema.safeParse({ q: "a".repeat(51) }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ q: "a".repeat(50) }).success).toBe(true);
  });
});

describe("事件列表查询契约", () => {
  it("sort 默认 createdAt，hasAlarm=false 解析为 false", () => {
    const parsed = eventPageQuerySchema.parse({ hasAlarm: "false" });
    expect(parsed.sort).toBe("createdAt");
    expect(parsed.hasAlarm).toBe(false);
    expect(eventPageQuerySchema.parse({ hasAlarm: "true" }).hasAlarm).toBe(true);
  });

  it("ids 逗号拆分，超 100 或含非 uuid 拒绝", () => {
    expect(eventPageQuerySchema.parse({ ids: `${uuid(1)},${uuid(2)}` }).ids).toEqual([uuid(1), uuid(2)]);
    const tooMany = Array.from({ length: 101 }, (_value, index) => uuid(index)).join(",");
    expect(eventPageQuerySchema.safeParse({ ids: tooMany }).success).toBe(false);
    expect(eventPageQuerySchema.safeParse({ ids: `${uuid(1)},not-a-uuid` }).success).toBe(false);
  });

  it("筛选枚举与 nextWithinDays 范围", () => {
    expect(eventPageQuerySchema.safeParse({ kind: "holiday" }).success).toBe(true);
    expect(eventPageQuerySchema.safeParse({ kind: "x".repeat(33) }).success).toBe(false);
    expect(eventPageQuerySchema.safeParse({ calendar: "lunar", nextWithinDays: "366" }).success).toBe(true);
    expect(eventPageQuerySchema.safeParse({ nextWithinDays: "367" }).success).toBe(false);
  });
});
