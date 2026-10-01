import type { IncomingMessage, ServerResponse } from "node:http";

import { writeSpan } from "@timenote/runtime";

import { decodeLoggedBody, readRequestBody } from "./body.js";
import type { WebLogging } from "./types.js";

const requestHeaders = ["content-type", "cookie", "origin", "sec-fetch-site", "if-none-match", "user-agent"] as const;

const responseHeaders = [
  "content-type",
  "cache-control",
  "content-disposition",
  "etag",
  "content-security-policy",
  "x-content-type-options",
] as const;

const apiTimeoutMs = 30000;

export async function proxyToApi(
  req: IncomingMessage,
  res: ServerResponse,
  apiUrl: string,
  traceId: string,
  requestId: string,
  logging?: WebLogging
) {
  const started = Date.now();
  const method = req.method ?? "GET";
  const path = (req.url ?? "/").split("?")[0] ?? "/";
  const headers: Record<string, string> = {};
  for (const key of requestHeaders) {
    const value = req.headers[key];
    if (typeof value === "string") {
      headers[key] = value;
    }
  }

  headers["x-trace-id"] = traceId;
  // 覆盖客户端自带的转发头：API 只信任本机反代写入的这一跳地址。
  headers["x-forwarded-for"] = req.socket.remoteAddress ?? "";
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });
  const rawBody = method !== "GET" && method !== "HEAD" ? await readRequestBody(req) : undefined;
  const contentType = typeof req.headers["content-type"] === "string" ? req.headers["content-type"] : undefined;
  const logHop = (ok: boolean, status?: number, response?: unknown) =>
    writeSpan(
      logging?.logSink,
      {
        hop: "web",
        traceId,
        requestId,
        method,
        path,
        status,
        code: (response as { code?: string } | undefined)?.code,
        durationMs: Date.now() - started,
        ok,
        request: decodeLoggedBody(rawBody, contentType),
        response,
      },
      logging?.env ?? "development"
    );
  try {
    const response = await fetch(new URL(req.url ?? "/", apiUrl), {
      method,
      headers,
      redirect: "error",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(apiTimeoutMs)]),
      ...(rawBody?.length ? { body: rawBody } : {}),
    });
    const outgoing: Record<string, string | string[]> = { "x-trace-id": traceId };
    for (const key of responseHeaders) {
      const value = response.headers.get(key);
      if (value) {
        outgoing[key] = value;
      }
    }

    const cookies = response.headers.getSetCookie();
    if (cookies.length) {
      outgoing["set-cookie"] = cookies;
    }

    const buf = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, outgoing);
    res.end(buf);
    logHop(response.status < 400, response.status, decodeLoggedBody(buf, response.headers.get("content-type") ?? ""));
  } catch (error) {
    logHop(false, res.headersSent ? undefined : 502);
    throw error;
  }
}
