import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import type { ViteDevServer } from "vite";

export async function serveIndexHtml(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  built: boolean,
  port: number,
  vite?: ViteDevServer
) {
  const { pathname } = new URL(req.url ?? "/", "http://127.0.0.1");
  const nonce = randomBytes(18).toString("base64");
  let html = await readFile(resolve(root, built ? "dist/index.html" : "index.html"), "utf8");
  if (vite) {
    html = await vite.transformIndexHtml(pathname, html);
  }

  html = html.replaceAll("__TN_NONCE__", nonce);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; worker-src 'self' blob:; style-src 'self' 'nonce-${nonce}'; style-src-attr 'unsafe-inline'; connect-src 'self'${built ? "" : ` ws://127.0.0.1:${port} ws://localhost:${port}`}; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`
  );
  res.end(html);
}
