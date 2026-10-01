import type { EventInput } from "@timenote/contracts";

import { lunarDateIssue } from "./lunar.js";

/**
 * 契约之外、需要日历库才能判断的校验；返回字段路径到中文提示，空对象表示通过。
 * 网页表单与 API 共用，保证两端校验不漂移。
 */
export function eventDateIssues(event: EventInput): Record<string, string> {
  if (event.date.calendar !== "lunar") {
    return {};
  }

  const issue = lunarDateIssue(event.date);
  return issue ? { [`date.${issue.field}`]: issue.message } : {};
}
