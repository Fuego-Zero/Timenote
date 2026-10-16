import { type ApiError, type ErrorCode, type FieldError, parseIssueDetail } from "@timenote/contracts";
import type { ZodError } from "zod";

export const safeMessages: Record<ErrorCode, string> = {
  AUTH_REQUIRED: "请先登录",
  INVALID_CREDENTIALS: "用户名或密码错误",
  FORBIDDEN: "没有权限执行该操作",
  NOT_FOUND: "内容不存在",
  INVALID_INPUT: "请求无效",
  USERNAME_TAKEN: "用户名已被使用",
  LAST_ADMIN: "至少需要保留一个启用的管理员",
  CALENDAR_RANGE: "日期超出支持范围",
  RECURRENCE_LIMIT: "重复和里程碑总量超出上限，请减少按天/周/月重复的事件或里程碑",
  PAYLOAD_TOO_LARGE: "请求体过大",
  RATE_LIMITED: "请求过于频繁，请稍后再试",
  SIGN_INVALID: "请求签名无效",
  SIGN_EXPIRED: "请求签名已过期",
  SIGN_REPLAY: "请求签名已被使用",
  INTERNAL_ERROR: "服务暂时不可用",
};

export const statusByCode: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  USERNAME_TAKEN: 409,
  LAST_ADMIN: 409,
  CALENDAR_RANGE: 422,
  RECURRENCE_LIMIT: 422,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  SIGN_INVALID: 403,
  SIGN_EXPIRED: 403,
  SIGN_REPLAY: 403,
  INTERNAL_ERROR: 500,
};

/** 预期内的业务错误。HTTP 只带 code、detail 和参数；safeMessages 仅用于进程内日志。 */
export class BusinessError extends Error {
  readonly detail?: string;
  readonly params?: Record<string, string | number>;
  readonly fields?: Record<string, FieldError>;

  constructor(
    public code: ErrorCode,
    options: {
      detail?: string;
      params?: Record<string, string | number>;
      fields?: Record<string, string | FieldError>;
    } = {}
  ) {
    super(options.detail ?? safeMessages[code]);
    this.name = "BusinessError";
    this.detail = options.detail;
    this.params = options.params;
    this.fields = options.fields
      ? Object.fromEntries(
          Object.entries(options.fields).map(([path, value]) => [
            path,
            typeof value === "string" ? parseIssueDetail(value) : value,
          ])
        )
      : undefined;
  }
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof Error && error.name === "ZodError" && Array.isArray((error as { issues?: unknown }).issues);
}

function zodFields(error: ZodError) {
  const fields: Record<string, FieldError> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    fields[path] ??= parseIssueDetail(issue.message);
  }

  return fields;
}

/** Fastify 与插件抛出的带 statusCode 错误（JSON 解析失败、超限、限流等）映射为稳定 code。 */
function frameworkErrorCode(statusCode: number | undefined): ErrorCode | undefined {
  if (statusCode === 413) {
    return "PAYLOAD_TOO_LARGE";
  }

  if (statusCode === 429) {
    return "RATE_LIMITED";
  }

  if (statusCode === 404) {
    return "NOT_FOUND";
  }

  if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
    return "INVALID_INPUT";
  }

  return undefined;
}

export function toApiError(error: unknown): { status: number; body: Omit<ApiError, "requestId"> } {
  if (error instanceof BusinessError) {
    return {
      status: statusByCode[error.code],
      body: {
        code: error.code,
        ...(error.detail ? { detail: error.detail } : {}),
        ...(error.params ? { params: error.params } : {}),
        ...(error.fields ? { fields: error.fields } : {}),
      },
    };
  }

  if (isZodError(error)) {
    return {
      status: 400,
      body: { code: "INVALID_INPUT", fields: zodFields(error) },
    };
  }

  const code = frameworkErrorCode((error as { statusCode?: number }).statusCode);
  if (code) {
    return { status: statusByCode[code], body: { code } };
  }

  return { status: 500, body: { code: "INTERNAL_ERROR" } };
}
