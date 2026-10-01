import { randomUUID } from "node:crypto";

import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { ApiError, ErrorCode } from "@timenote/contracts";
import Fastify from "fastify";
import type { ZodError } from "zod";

import type { Config } from "./config.js";
import { incomingTraceId, writeSpan } from "./log.js";

export const safeMessages: Record<ErrorCode, string> = {
  AUTH_REQUIRED: "请先登录",
  INVALID_CREDENTIALS: "用户名或密码错误",
  FORBIDDEN: "没有权限执行该操作",
  NOT_FOUND: "内容不存在",
  INVALID_INPUT: "请求无效",
  USERNAME_TAKEN: "用户名已被使用",
  LAST_ADMIN: "至少需要保留一个启用的管理员",
  CALENDAR_RANGE: "日期超出支持范围",
  PAYLOAD_TOO_LARGE: "请求体过大",
  RATE_LIMITED: "请求过于频繁，请稍后再试",
  INTERNAL_ERROR: "服务暂时不可用",
};

const statusByCode: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INVALID_INPUT: 400,
  USERNAME_TAKEN: 409,
  LAST_ADMIN: 409,
  CALENDAR_RANGE: 422,
  PAYLOAD_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

/** 预期内的业务错误：对外只返回稳定 code、中文提示和字段定位，不暴露内部细节。 */
export class BusinessError extends Error {
  readonly fields?: Record<string, string>;

  constructor(
    public code: ErrorCode,
    options: { message?: string; fields?: Record<string, string> } = {}
  ) {
    super(options.message ?? safeMessages[code]);
    this.name = "BusinessError";
    this.fields = options.fields;
  }
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof Error && error.name === "ZodError" && Array.isArray((error as { issues?: unknown }).issues);
}

function zodFields(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_";
    fields[path] ??= issue.message;
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

function toApiError(error: unknown): { status: number; body: Omit<ApiError, "requestId"> } {
  if (error instanceof BusinessError) {
    return {
      status: statusByCode[error.code],
      body: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) },
    };
  }

  if (isZodError(error)) {
    return {
      status: 400,
      body: { code: "INVALID_INPUT", message: safeMessages.INVALID_INPUT, fields: zodFields(error) },
    };
  }

  const code = frameworkErrorCode((error as { statusCode?: number }).statusCode);
  if (code) {
    return { status: statusByCode[code], body: { code, message: safeMessages[code] } };
  }

  return { status: 500, body: { code: "INTERNAL_ERROR", message: safeMessages.INTERNAL_ERROR } };
}

/** 写请求只接受与 WEB_ORIGIN 同源的浏览器请求；非生产环境额外允许回环与私网地址，方便手机调试。 */
export function sameWebOrigin(
  origin: string | undefined,
  allowed: string,
  options: { allowPrivateLan?: boolean } = {}
) {
  if (!origin) {
    return false;
  }

  if (origin === allowed) {
    return true;
  }

  try {
    const a = new URL(origin);
    const b = new URL(allowed);
    const portOf = (url: URL) => url.port || (url.protocol === "https:" ? "443" : "80");
    if (a.protocol !== b.protocol || portOf(a) !== portOf(b)) {
      return false;
    }

    const loopback = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (loopback(a.hostname) && loopback(b.hostname)) {
      return true;
    }

    return Boolean(options.allowPrivateLan && isPrivateIpv4(a.hostname));
  } catch {
    return false;
  }
}

function isPrivateIpv4(host: string) {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return false;
  }

  const nums = parts.map(Number);
  if (nums.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }

  const [a, b] = nums as [number, number, number, number];
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

function requestPath(url: string | undefined) {
  return (url ?? "/").split("?")[0] ?? "/";
}

function decodePayload(payload: unknown): unknown {
  if (typeof payload !== "string") {
    return undefined;
  }

  const trimmed = payload.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(payload);
    } catch {
      return { contentType: "text", bytes: Buffer.byteLength(payload) };
    }
  }

  return { contentType: "text", bytes: Buffer.byteLength(payload) };
}

declare module "fastify" {
  interface FastifyRequest {
    traceError?: { name: string; message: string };
    traceId: string;
    tracePayload?: unknown;
    traceStarted: number;
    userId?: string;
  }
}

export async function baseServer(config: Config) {
  const app = Fastify({
    logger: false,
    bodyLimit: config.bodyLimit,
    genReqId: () => randomUUID(),
    requestTimeout: 35000,
    // 只信任同机 Web 反代写入的 X-Forwarded-For，限流按真实浏览器地址计数。
    trustProxy: "127.0.0.1",
  });
  app.addHook("onRequest", async (req, reply) => {
    req.traceStarted = Date.now();
    req.traceId = incomingTraceId(req.headers["x-trace-id"], req.id);
    void reply.header("X-Trace-Id", req.traceId);
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
  });
  await app.register(rateLimit, { max: config.env === "test" ? 1000 : 120, timeWindow: "1 minute" });
  app.addHook("onSend", async (req, _reply, payload) => {
    req.tracePayload = payload;
    return payload;
  });
  app.addHook("onResponse", async (req, reply) => {
    const path = requestPath(req.url);
    if (path === "/health") {
      return;
    }

    const response = decodePayload(req.tracePayload);
    writeSpan(
      config.logSink,
      {
        traceId: req.traceId,
        requestId: req.id,
        hop: "api",
        method: req.method,
        path,
        status: reply.statusCode,
        code: (response as { code?: string } | undefined)?.code,
        durationMs: Date.now() - (req.traceStarted || Date.now()),
        ok: reply.statusCode < 400,
        userId: req.userId,
        error: req.traceError,
        request: req.body,
        response,
      },
      config.env
    );
  });

  app.get("/health", () => ({ status: "ok" }));
  app.setNotFoundHandler((req, reply) => {
    void reply.code(404).send({ code: "NOT_FOUND", message: safeMessages.NOT_FOUND, requestId: req.traceId });
  });
  app.setErrorHandler((error, req, reply) => {
    const { status, body } = toApiError(error);
    if (status >= 500) {
      req.traceError =
        error instanceof Error ? { name: error.name, message: error.message } : { name: "Unknown", message: "" };
    }

    void reply
      .code(status)
      .header("X-Trace-Id", req.traceId ?? req.id)
      .send({ ...body, requestId: req.traceId ?? req.id });
  });
  return app;
}
