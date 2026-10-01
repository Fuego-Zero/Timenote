import { readFile, stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { extname, resolve, sep } from "node:path";

const mime: Record<string, string> = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

export async function serveBuiltAsset(res: ServerResponse, root: string, pathname: string) {
  const assetRoot = resolve(root, "dist");
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = "";
  }

  const asset = resolve(assetRoot, `.${decoded}`);
  if (!decoded || !asset.startsWith(assetRoot + sep) || !(await stat(asset).catch(() => undefined))?.isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }

  res.setHeader("Content-Type", mime[extname(asset)] ?? "application/octet-stream");
  // Vite 产物带内容哈希，可长期缓存；其他静态文件每次校验。
  res.setHeader("Cache-Control", pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
  res.end(await readFile(asset));
}
