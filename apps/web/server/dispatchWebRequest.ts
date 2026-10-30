import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { incomingTraceId } from "@timenote/runtime";
import type { ViteDevServer } from "vite";

import { serveBuiltAsset } from "./assets.js";
import { serveIndexHtml } from "./html.js";
import { proxyToApi } from "./proxy.js";
import type { WebLogging } from "./types.js";
import { manifestForLanguage, manifestLanguage } from "./webManifest.js";

export async function dispatchWebRequest(
  req: IncomingMessage,
  res: ServerResponse,
  options: {
    apiUrl: string;
    root: string;
    built: boolean;
    port: number;
    vite?: ViteDevServer;
    logging?: WebLogging;
    feedbackOrigin?: string;
  }
) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.url?.startsWith("/api/")) {
    await handleApi(req, res, options.apiUrl, options.logging);
    return;
  }

  const { pathname } = new URL(req.url ?? "/", "http://127.0.0.1");
  if (pathname === "/site.webmanifest") {
    const body = manifestForLanguage(manifestLanguage(req.url ?? "/", req.headers["accept-language"]));
    res.writeHead(200, { "Content-Type": "application/manifest+json", "Cache-Control": "no-cache" });
    res.end(JSON.stringify(body));
    return;
  }

  if (pathname === "/" || pathname === "/index.html") {
    await serveIndexHtml(req, res, options.root, options.built, options.port, options.vite, options.feedbackOrigin);
    return;
  }

  if (options.vite) {
    options.vite.middlewares(req, res, () => {
      res.writeHead(404);
      res.end();
    });
    return;
  }

  await serveBuiltAsset(res, options.root, pathname);
}

async function handleApi(req: IncomingMessage, res: ServerResponse, apiUrl: string, logging?: WebLogging) {
  const requestId = randomUUID();
  const traceId = incomingTraceId(req.headers["x-trace-id"], requestId);
  res.setHeader("X-Trace-Id", traceId);
  try {
    await proxyToApi(req, res, apiUrl, traceId, requestId, logging);
  } catch {
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json", "X-Trace-Id": traceId });
    }

    if (!res.writableEnded) {
      res.end(JSON.stringify({ code: "INTERNAL_ERROR", requestId: traceId }));
    }
  }
}
