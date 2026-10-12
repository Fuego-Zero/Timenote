import type { EventKind } from "./eventEnums.js";

/** 标题模板只允许这两个变量，其他 `{{…}}` 或孤立花括号一律拒绝。 */
export const templateVariables = ["name", "years"] as const;

export const defaultTitleTemplates: Record<EventKind, { withYears: string; withoutYears: string }> = {
  birthday: { withYears: "{{name}} {{years}} 岁生日", withoutYears: "{{name}}生日" },
  anniversary: { withYears: "{{name}}第 {{years}} 周年", withoutYears: "{{name}}纪念日" },
  event: { withYears: "{{name}}", withoutYears: "{{name}}" },
};

export function templateIssue(template: string): string | undefined {
  const stripped = template.replaceAll("{{name}}", "").replaceAll("{{years}}", "");
  if (stripped.includes("{") || stripped.includes("}")) {
    return "模板只支持 {{name}} 和 {{years}}";
  }

  return undefined;
}
