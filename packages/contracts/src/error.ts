import { z } from "zod";

export const errorCodes = [
  "AUTH_REQUIRED",
  "INVALID_CREDENTIALS",
  "FORBIDDEN",
  "NOT_FOUND",
  "INVALID_INPUT",
  "USERNAME_TAKEN",
  "LAST_ADMIN",
  "CALENDAR_RANGE",
  "RECURRENCE_LIMIT",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "SIGN_INVALID",
  "SIGN_EXPIRED",
  "SIGN_REPLAY",
  "INTERNAL_ERROR",
] as const;
export type ErrorCode = (typeof errorCodes)[number];

const errorParamSchema = z.record(z.string(), z.union([z.string(), z.number()]));

/** 字段错误只带稳定 detail 和参数，文案由网页按当前语言生成。 */
export const fieldErrorSchema = z.object({
  detail: z.string(),
  params: errorParamSchema.optional(),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

export const apiErrorSchema = z.object({
  code: z.enum(errorCodes),
  detail: z.string().optional(),
  params: errorParamSchema.optional(),
  requestId: z.string().optional(),
  /** 字段路径（如 `date.day`）到稳定 detail，不带自然语言。 */
  fields: z.record(z.string(), fieldErrorSchema).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** 写进校验 message 的稳定错误。无参数时就是 detail；有参数时是 JSON。 */
export function issueDetail(detail: string, params?: Record<string, string | number>) {
  return params ? JSON.stringify({ detail, params }) : detail;
}

export function parseIssueDetail(raw: string): FieldError {
  if (raw.startsWith("{")) {
    try {
      const parsed = fieldErrorSchema.safeParse(JSON.parse(raw));
      if (parsed.success && /^[a-z0-9_]+$/.test(parsed.data.detail)) {
        return parsed.data;
      }
    } catch {
      return { detail: "invalid" };
    }
  }

  if (/^[a-z0-9_]+$/.test(raw)) {
    return { detail: raw };
  }

  return { detail: "invalid" };
}
