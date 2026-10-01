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
  "INTERNAL_ERROR",
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export const apiErrorSchema = z.object({
  code: z.enum(errorCodes),
  message: z.string(),
  requestId: z.string().optional(),
  /** 字段路径（如 `date.day`）到中文错误提示，供表单直接定位。 */
  fields: z.record(z.string(), z.string()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
