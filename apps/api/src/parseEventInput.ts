import { CalendarRangeError, eventDateIssues, LUNAR_MAX_YEAR, LUNAR_MIN_YEAR } from "@timenote/calendar";
import { type EventInput, eventInputSchema } from "@timenote/contracts";
import { BusinessError } from "@timenote/runtime";

/** 契约校验 + 日历库校验；字段错误统一用 INVALID_INPUT 返回，路径与表单字段一致。 */
export function parseEventInput(body: unknown, fieldPrefix = ""): EventInput {
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[`${fieldPrefix}${issue.path.join(".")}`] ??= issue.message;
    }

    throw new BusinessError("INVALID_INPUT", { fields });
  }

  let issues: Record<string, string>;
  try {
    issues = eventDateIssues(parsed.data);
  } catch (error) {
    if (error instanceof CalendarRangeError) {
      throw new BusinessError("CALENDAR_RANGE", {
        detail: "lunar_range",
        params: { year: error.year, min: LUNAR_MIN_YEAR, max: LUNAR_MAX_YEAR },
      });
    }

    throw error;
  }

  if (Object.keys(issues).length) {
    const fields = Object.fromEntries(
      Object.entries(issues).map(([path, message]) => [`${fieldPrefix}${path}`, message])
    );
    throw new BusinessError("INVALID_INPUT", { fields });
  }

  return parsed.data;
}
