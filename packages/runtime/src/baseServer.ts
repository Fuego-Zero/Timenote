import { randomUUID } from "node:crypto";

import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";

import type { Config } from "./configTypes.js";
import { safeMessages, toApiError } from "./apiErrors.js";
import { incomingTraceId } from "./traceTypes.js";
import { writeSpan } from "./writeSpan.js";

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
