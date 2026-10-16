import { issueDetail, templateIssue, templateVariables, usedVariables } from "@timenote/contracts";

export interface TitleSource {
  name: string;
  titlePrefix: string;
}

export interface TitleValues {
  count?: number | null;
  days?: number | null;
  years?: number | null;
}

function variableValue(variable: "count" | "days" | "years", value: number | null | undefined) {
  if (value === null || value === undefined) {
    throw new Error(
      variable === "years" ? issueDetail("years_unknown") : issueDetail("missing_template_var", { name: variable })
    );
  }

  if (variable === "years" && (!Number.isInteger(value) || value < 1)) {
    throw new Error(issueDetail("anniversary_count"));
  }

  return String(value);
}

/**
 * 只做白名单变量的字面替换，不执行表达式；模板用到的变量必须有取值（契约已按规则校验）。
 * 前缀幂等：渲染结果已以前缀开头时不再重复添加。
 */
export function renderTitle(source: TitleSource, template: string, values: TitleValues) {
  const problem = templateIssue(template, templateVariables);
  if (problem) {
    throw new Error(problem);
  }

  let rendered = template.replaceAll("{{name}}", source.name.trim());
  for (const variable of usedVariables(template)) {
    if (variable !== "name") {
      rendered = rendered.replaceAll(`{{${variable}}}`, variableValue(variable, values[variable]));
    }
  }

  rendered = rendered.trim();
  const prefix = source.titlePrefix.trim();
  if (!prefix || rendered.startsWith(prefix)) {
    return rendered;
  }

  return `${prefix} ${rendered}`;
}
