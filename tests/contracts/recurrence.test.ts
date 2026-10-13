import { describe, expect, it } from "vitest";

import { backupFileSchema, eventInputSchema } from "../../packages/contracts/src/index.js";
import { eventInput } from "../fixtures.js";

function issues(input: unknown) {
  const parsed = eventInputSchema.safeParse(input);
  return parsed.success
    ? {}
    : Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join("."), issue.message]));
}

describe("重复规则契约", () => {
  it("默认规则每 1 年、永不结束且无里程碑可通过", () => {
    expect(issues(eventInput())).toEqual({});
  });

  it("新字段必填", () => {
    const rest = Object.fromEntries(Object.entries(eventInput()).filter(([key]) => key !== "recurrence"));
    expect(issues(rest)).toHaveProperty("recurrence");
  });

  it("里程碑模板只允许 {{name}} 和 {{days}}", () => {
    expect(issues(eventInput({ milestoneTemplate: "{{name}} {{years}}" }))).toEqual({
      milestoneTemplate: "模板只支持 {{name}} 和 {{days}}",
    });
  });

  it("备份只接受 v2，v1 给出重新导出的提示", () => {
    const file = { format: "timenote-backup", exportedAt: new Date().toISOString(), events: [] };
    expect(backupFileSchema.safeParse({ ...file, version: 2 }).success).toBe(true);
    const v1 = backupFileSchema.safeParse({ ...file, version: 1 });
    expect(v1.success ? "" : v1.error.issues[0]?.message).toBe("不再支持 v1 备份文件，请用升级前的版本重新导出");
  });
});
