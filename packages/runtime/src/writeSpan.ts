import type { LogSink } from "./configTypes.js";
import { clipBody, redact, redactPath } from "./logRedact.js";
import type { TraceSpan } from "./traceTypes.js";

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
