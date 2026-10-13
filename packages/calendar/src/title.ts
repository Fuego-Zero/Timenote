import { templateIssue } from "@timenote/contracts";

export interface TitleSource {
  name: string;
  titlePrefix: string;
  titleTemplate: string;
}

/**
 * 只做白名单变量的字面替换，不执行表达式；years 为 null 时模板不得包含 {{years}}（契约已校验）。
 * 前缀幂等：渲染结果已以前缀开头时不再重复添加。
 */
export function renderTitle(source: TitleSource, years: number | null) {
  const problem = templateIssue(source.titleTemplate, ["name", "years"]);
  if (problem) {
    throw new Error(problem);
  }

  if (years === null && source.titleTemplate.includes("{{years}}")) {
    throw new Error("年份未知时模板不能使用 {{years}}");
  }

  if (years !== null && (!Number.isInteger(years) || years < 1)) {
    throw new Error("周年数必须是正整数");
  }

  const rendered = source.titleTemplate
    .replaceAll("{{name}}", source.name.trim())
    .replaceAll("{{years}}", years === null ? "" : String(years))
    .trim();
  const prefix = source.titlePrefix.trim();
  if (!prefix || rendered.startsWith(prefix)) {
    return rendered;
  }

  return `${prefix} ${rendered}`;
}
