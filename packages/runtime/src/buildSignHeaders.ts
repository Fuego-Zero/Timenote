import { randomBytes } from "node:crypto";

import { canonicalSignPayload, requestSignHeaderNames } from "@timenote/contracts";

import { bodySha256Hex, hmacSign } from "./requestSignCrypto.js";
import { normalizeSignPath, normalizeSignQuery } from "./requestSignPaths.js";

/** 客户端/测试共用：用已派生的 signKey（base64url）计算签名头。 */
export function buildSignHeaders(input: {
  method: string;
  url: string;
  bodyText?: string;
  signKeyBase64Url: string;
  anonKeyId?: string;
  nowMs?: number;
  nonce?: string;
}): Record<string, string> {
  const nowMs = input.nowMs ?? Date.now();
  const timestamp = String(Math.floor(nowMs / 1000));
  const nonce = input.nonce ?? randomBytes(16).toString("base64url");
  const path = normalizeSignPath(input.url);
  const query = normalizeSignQuery(input.url);
  const payload = canonicalSignPayload({
    method: input.method,
    path,
    query,
    timestamp,
    nonce,
    bodyHash: bodySha256Hex(input.bodyText),
  });
  const signKey = Buffer.from(input.signKeyBase64Url, "base64url");
  const headers: Record<string, string> = {
    [requestSignHeaderNames.timestamp]: timestamp,
    [requestSignHeaderNames.nonce]: nonce,
    [requestSignHeaderNames.signature]: hmacSign(signKey, payload),
  };
  if (input.anonKeyId) {
    headers[requestSignHeaderNames.anonId] = input.anonKeyId;
  }

  return headers;
}
