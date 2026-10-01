import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type { LogSink } from "./config.js";

export const defaultLogRoot = ".tmp/logs";
export const BODY_LIMIT_BYTES = 8192;

export type Hop = "web" | "api";

export interface TraceSpan {
  code?: string | number;
  durationMs: number;
  error?: { name: string; message: string };
  hop: Hop;
  method?: string;
  ok: boolean;
  path?: string;
  request?: unknown;
  requestId: string;
  response?: unknown;
  status?: number;
  traceId: string;
  ts?: string;
  userId?: string;
}

export function resolveLogRoot(env: NodeJS.Dict<string> = process.env): string {
  const dir = env.LOG_DIR?.trim();
  if (!dir) {
    return defaultLogRoot;
  }

  return dir;
}

export function incomingTraceId(value: string | string[] | undefined, fallback: string): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed && /^[\w-]{1,64}$/.test(trimmed) ? trimmed : fallback;
}

/** 订阅地址里的 token 只保留前 4 位，日志不记录完整 token。 */
export function redactPath(path: string) {
  return path.replace(/^\/api\/feeds\/([^/?]+?)(\.ics)?$/, (_match, token: string, suffix = "") => {
    return `/api/feeds/${token.slice(0, 4)}…${suffix}`;
  });
}

function sensitiveKey(key: string) {
  return /password|token|authorization|cookie|url/i.test(key);
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redact);
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = sensitiveKey(key) ? "[redacted]" : redact(nested);
    }

    return out;
  }

  return value;
}

export function clipBody(value: unknown, limit = BODY_LIMIT_BYTES): unknown {
  if (value === undefined) {
    return undefined;
  }

  const json = typeof value === "string" ? value : (JSON.stringify(value) ?? "null");
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes <= limit) {
    return value;
  }

  return { truncated: true, bytes, preview: json.slice(0, limit) };
}

/** 开发环境记录全部请求并附带脱敏后的请求体；生产和测试只记录失败请求，不附带请求体。 */
function verboseLog(env: string) {
  return env !== "production" && env !== "test";
}

export function serializeSpan(span: TraceSpan, env: string): Record<string, unknown> {
  const row: Record<string, unknown> = {
    ts: span.ts ?? new Date().toISOString(),
    traceId: span.traceId,
    requestId: span.requestId,
    hop: span.hop,
    durationMs: span.durationMs,
    ok: span.ok,
  };
  for (const key of ["method", "status", "code", "userId", "error"] as const) {
    if (span[key] !== undefined) {
      row[key] = span[key];
    }
  }

  if (span.path !== undefined) {
    row.path = redactPath(span.path);
  }

  if (verboseLog(env)) {
    if (span.request !== undefined) {
      row.request = clipBody(redact(span.request));
    }

    if (span.response !== undefined) {
      row.response = clipBody(redact(span.response));
    }
  }

  return row;
}

export function writeSpan(sink: LogSink | undefined, span: TraceSpan, env = "development") {
  if (!sink || (!verboseLog(env) && span.ok)) {
    return;
  }

  sink.write(JSON.stringify(serializeSpan(span, env)));
}

function dayStamp(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** 按 hop 分目录、按天分文件写 JSONL；测试环境不落盘。 */
export function createFileLogSink(root = defaultLogRoot, env = process.env.NODE_ENV ?? "development"): LogSink {
  const persist = env !== "test";
  return {
    write(message: string) {
      if (!persist) {
        return;
      }

      let hop: Hop = "api";
      try {
        const parsed = JSON.parse(message) as { hop?: unknown };
        if (parsed.hop === "web") {
          hop = "web";
        }
      } catch {
        hop = "api";
      }

      const dir = join(root, hop);
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, `${dayStamp()}.jsonl`), `${message}\n`);
    },
  };
}
