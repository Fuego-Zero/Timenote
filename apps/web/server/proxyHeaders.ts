import type { IncomingMessage } from "node:http";

export const proxyRequestHeaderNames = [
  "content-type",
  "cookie",
  "origin",
  "sec-fetch-site",
  "if-none-match",
  "user-agent",
  "x-timenote-timestamp",
  "x-timenote-nonce",
  "x-timenote-signature",
  "x-timenote-anon-id",
] as const;

export const proxyResponseHeaderNames = [
  "content-type",
  "cache-control",
  "content-disposition",
  "etag",
  "content-security-policy",
  "x-content-type-options",
] as const;

export function pickProxyRequestHeaders(req: IncomingMessage, traceId: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const key of proxyRequestHeaderNames) {
    const value = req.headers[key];
    if (typeof value === "string") {
      headers[key] = value;
    }
  }

  headers["x-trace-id"] = traceId;
  // 覆盖客户端自带的转发头：API 只信任本机反代写入的这一跳地址。
  headers["x-forwarded-for"] = req.socket.remoteAddress ?? "";
  return headers;
}

export function pickProxyResponseHeaders(
  response: Response,
  traceId: string
): Record<string, string | string[]> {
  const outgoing: Record<string, string | string[]> = { "x-trace-id": traceId };
  for (const key of proxyResponseHeaderNames) {
    const value = response.headers.get(key);
    if (value) {
      outgoing[key] = value;
    }
  }

  const cookies = response.headers.getSetCookie();
  if (cookies.length) {
    outgoing["set-cookie"] = cookies;
  }

  return outgoing;
}
