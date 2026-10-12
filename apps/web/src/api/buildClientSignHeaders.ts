import { canonicalSignPayload, requestSignHeaderNames } from "@timenote/contracts";

import {
  base64UrlToBytes,
  bytesToBase64Url,
  normalizeClientSignPath,
  normalizeClientSignQuery,
  randomNonce,
  sha256Hex,
} from "./clientSignCrypto.js";
import { clearRequestSign, getRequestSignState } from "./requestSignState.js";

/** 为 `/api...` 完整路径生成签名头；无可用密钥时返回空对象。 */
export async function buildClientSignHeaders(input: {
  method: string;
  apiUrl: string;
  bodyText?: string;
}): Promise<Record<string, string>> {
  const current = getRequestSignState();
  if (!current) {
    return {};
  }

  if (current.kind === "anon" && current.expiresAt <= Date.now()) {
    clearRequestSign();
    return {};
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomNonce();
  const payload = canonicalSignPayload({
    method: input.method,
    path: normalizeClientSignPath(input.apiUrl),
    query: normalizeClientSignQuery(input.apiUrl),
    timestamp,
    nonce,
    bodyHash: await sha256Hex(input.bodyText ?? ""),
  });
  const keyBytes = base64UrlToBytes(current.signKey);
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = bytesToBase64Url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  const headers: Record<string, string> = {
    [requestSignHeaderNames.timestamp]: timestamp,
    [requestSignHeaderNames.nonce]: nonce,
    [requestSignHeaderNames.signature]: signature,
  };
  if (current.kind === "anon") {
    headers[requestSignHeaderNames.anonId] = current.anonKeyId;
  }

  return headers;
}
