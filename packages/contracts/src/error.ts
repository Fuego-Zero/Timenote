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
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "SIGN_INVALID",
  "SIGN_EXPIRED",
  "SIGN_REPLAY",
  "INTERNAL_ERROR",
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export const apiErrorSchema = z.object({
  code: z.enum(errorCodes),
  message: z.string(),
  requestId: z.string().optional(),
  /** 字段路径（如 `date.day`），用于把错误提示挂到表单控件上直接定位。 */
  fields: z.record(z.string(), z.string()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
