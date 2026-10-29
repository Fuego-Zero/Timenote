import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";

import type { ViteDevServer } from "vite";

export function contentSecurityPolicy(input: { nonce: string; built: boolean; port: number; feedbackOrigin?: string }) {
  const connect = ["'self'"];
  if (!input.built) {
    connect.push(`ws://127.0.0.1:${input.port}`, `ws://localhost:${input.port}`);
  }

  if (input.feedbackOrigin) {
    connect.push(input.feedbackOrigin);
  }

  const images = ["'self'", "data:"];
  if (input.feedbackOrigin) {
    images.push("blob:");
  }

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${input.nonce}'`,
    "worker-src 'self' blob:",
    `style-src 'self' 'nonce-${input.nonce}'`,
    "style-src-attr 'unsafe-inline'",
    `connect-src ${connect.join(" ")}`,
    `img-src ${images.join(" ")}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}

export async function serveIndexHtml(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  built: boolean,
  port: number,
  vite?: ViteDevServer,
  feedbackOrigin?: string
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
  res.setHeader("Content-Security-Policy", contentSecurityPolicy({ nonce, built, port, feedbackOrigin }));
  res.end(html);
}
