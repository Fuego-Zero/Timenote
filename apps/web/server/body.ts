import type { IncomingMessage } from "node:http";

import { BODY_LIMIT_BYTES } from "@timenote/runtime";

export async function readRequestBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string | Uint8Array));
  }

  return Buffer.concat(chunks);
}

export function decodeLoggedBody(buf: Buffer | undefined, contentType?: string): unknown {
  if (!buf || buf.length === 0) {
    return undefined;
  }

  if (contentType?.includes("json")) {
    try {
      return JSON.parse(buf.toString("utf8")) as unknown;
    } catch {
      return { contentType, bytes: buf.length };
    }
  }

  if (contentType?.includes("text") && !contentType.includes("calendar") && buf.length <= BODY_LIMIT_BYTES) {
    return buf.toString("utf8");
  }

  return { contentType: contentType ?? "application/octet-stream", bytes: buf.length };
}
