import { randomUUID } from "node:crypto";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { incomingTraceId } from "@timenote/runtime";
import type { createServer as createViteServer } from "vite";

import { serveBuiltAsset } from "./assets.js";
import { serveIndexHtml } from "./html.js";
import { proxyToApi } from "./proxy.js";
import type { WebLogging } from "./types.js";

export type { WebLogging } from "./types.js";

const root = fileURLToPath(new URL("..", import.meta.url));

export async function startWeb(
  apiUrl: string,
  port: number,
  built: boolean,
  options: { host: string; logging?: WebLogging }
) {
  let vite: Awaited<ReturnType<typeof createViteServer>> | undefined;
  const server = createHttpServer((req, res) => {
    void (async () => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Referrer-Policy", "no-referrer");
      if (req.url?.startsWith("/api/")) {
        await handleApi(req, res, apiUrl, options.logging);
        return;
      }

      const { pathname } = new URL(req.url ?? "/", "http://127.0.0.1");
      if (pathname === "/" || pathname === "/index.html") {
        await serveIndexHtml(req, res, root, built, port, vite);
        return;
      }

      if (vite) {
        vite.middlewares(req, res, () => {
          res.writeHead(404);
          res.end();
        });
        return;
      }

      await serveBuiltAsset(res, root, pathname);
    })().catch(() => {
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
      }

      res.end('{"code":"INTERNAL_ERROR","message":"请求失败"}');
    });
  });
  if (!built) {
    // Production uses --built and does not install Vite.
    // eslint-disable-next-line import-x/no-extraneous-dependencies
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({
      root,
      configFile: resolve(root, "vite.config.ts"),
      appType: "custom",
      server: {
        middlewareMode: true,
        host: options.host === "127.0.0.1" || options.host === "localhost" ? options.host : true,
        ws: { server, clientPort: port },
        hmr: { overlay: false },
        forwardConsole: false,
      },
    });
  }

  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, options.host, resolveListen);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    port: actualPort,
    async close() {
      await vite?.close();
      server.closeAllConnections();
      await new Promise<void>(resolveClose => server.close(() => resolveClose()));
    },
  };
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
      res.end(JSON.stringify({ code: "INTERNAL_ERROR", message: "请求失败", requestId: traceId }));
    }
  }
}
