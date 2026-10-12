import type { IncomingMessage, ServerResponse } from "node:http";

import { writeSpan } from "@timenote/runtime";

import { decodeLoggedBody, readRequestBody } from "./body.js";
import { pickProxyRequestHeaders, pickProxyResponseHeaders } from "./proxyHeaders.js";
import type { WebLogging } from "./types.js";

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
  const headers = pickProxyRequestHeaders(req, traceId);
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
    const outgoing = pickProxyResponseHeaders(response, traceId);
    const buf = Buffer.from(await response.arrayBuffer());
    res.writeHead(response.status, outgoing);
    res.end(buf);
    logHop(response.status < 400, response.status, decodeLoggedBody(buf, response.headers.get("content-type") ?? ""));
  } catch (error) {
    logHop(false, res.headersSent ? undefined : 502);
    throw error;
  }
}
