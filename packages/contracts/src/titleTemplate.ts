import type { EventKind } from "./eventEnums.js";

/** 标题模板可用的全部变量；每个模板实际可用哪些由事件规则决定，其他 `{{…}}` 或孤立花括号一律拒绝。 */
export const templateVariables = ["name", "years", "count", "days"] as const;
export type TemplateVariable = (typeof templateVariables)[number];

export const defaultTitleTemplates: Record<EventKind, { withYears: string; withoutYears: string }> = {
  birthday: { withYears: "{{name}} {{years}} 岁生日", withoutYears: "{{name}}生日" },
  anniversary: { withYears: "{{name}}第 {{years}} 周年", withoutYears: "{{name}}纪念日" },
  event: { withYears: "{{name}}", withoutYears: "{{name}}" },
};

/** 纪念日按非「每 1 年」重复时的默认标题；只在模板仍是默认值时自动替换。 */
export const defaultRecurrenceTemplates = {
  everyNYears: "{{name}}第 {{count}} 次",
  weekly: "{{name}}第 {{count}} 周",
  monthly: "{{name}}第 {{count}} 个月",
  other: "{{name}}第 {{count}} 次",
} as const;

export const defaultMilestoneTemplate = "{{name}}第 {{days}} 天";

function variableText(variables: readonly TemplateVariable[]) {
  const names = variables.map(variable => `{{${variable}}}`);
  return names.length > 1 ? `${names.slice(0, -1).join("、")} 和 ${names.at(-1)}` : names.join("");
}

/** 白名单检查：只允许 allowed 中的变量，其余 `{{…}}` 和孤立花括号都拒绝。 */
export function templateIssue(template: string, allowed: readonly TemplateVariable[]): string | undefined {
  const stripped = allowed.reduce((text, variable) => text.replaceAll(`{{${variable}}}`, ""), template);
  if (stripped.includes("{") || stripped.includes("}")) {
    return `模板只支持 ${variableText(allowed)}`;
  }

  return undefined;
}

/** 模板里出现的已知变量。 */
export function usedVariables(template: string): TemplateVariable[] {
  return templateVariables.filter(variable => template.includes(`{{${variable}}}`));
}
