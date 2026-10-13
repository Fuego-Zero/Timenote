import { canonicalSignPayload, requestSignHeaderNames, requestSignWindowSeconds } from "@timenote/contracts";

import { BusinessError } from "./apiErrors.js";
import { bodySha256Hex, deriveSignKey, hmacSign, safeEqualBase64Url, type SignKeyKind } from "./requestSignCrypto.js";
import { normalizeSignPath, normalizeSignQuery } from "./requestSignPaths.js";
import type { RequestSignRegistry } from "./requestSignRegistry.js";

export interface VerifySignInput {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  nowMs: number;
  rawBody: Buffer | string | undefined;
  requireAnon: boolean;
  /** 已认证会话 id（cookie 会话）；与 anon 二选一。 */
  sessionKeyId?: string;
  url: string;
}

export function verifyRequestSignature(registry: RequestSignRegistry, masterKey: Buffer, input: VerifySignInput) {
  const timestampRaw = headerValue(input.headers, requestSignHeaderNames.timestamp);
  const nonce = headerValue(input.headers, requestSignHeaderNames.nonce);
  const signature = headerValue(input.headers, requestSignHeaderNames.signature);
  const anonId = headerValue(input.headers, requestSignHeaderNames.anonId);

  if (!timestampRaw || !nonce || !signature) {
    throw new BusinessError("SIGN_INVALID");
  }

  if (!/^\d{1,16}$/.test(timestampRaw) || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) {
    throw new BusinessError("SIGN_INVALID");
  }

  const timestampSec = Number(timestampRaw);
  const nowSec = Math.floor(input.nowMs / 1000);
  if (!Number.isFinite(timestampSec) || Math.abs(nowSec - timestampSec) > requestSignWindowSeconds) {
    throw new BusinessError("SIGN_EXPIRED");
  }

  let kind: SignKeyKind;
  let keyId: string;
  if (input.requireAnon) {
    if (!anonId || !/^[A-Za-z0-9_-]{16,128}$/.test(anonId)) {
      throw new BusinessError("SIGN_INVALID");
    }

    registry.assertAnon(anonId, input.nowMs);
    kind = "anon";
    keyId = anonId;
  } else if (input.sessionKeyId) {
    kind = "session";
    keyId = input.sessionKeyId;
  } else {
    throw new BusinessError("SIGN_INVALID");
  }

  const path = normalizeSignPath(input.url);
  const query = normalizeSignQuery(input.url);
  const payload = canonicalSignPayload({
    method: input.method,
    path,
    query,
    timestamp: timestampRaw,
    nonce,
    bodyHash: bodySha256Hex(input.rawBody),
  });
  const expected = hmacSign(deriveSignKey(masterKey, kind, keyId), payload);
  if (!safeEqualBase64Url(expected, signature)) {
    throw new BusinessError("SIGN_INVALID");
  }

  registry.consumeNonce(nonce, (timestampSec + requestSignWindowSeconds) * 1000, input.nowMs);
}

function headerValue(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const raw = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(raw)) {
    return raw[0]?.trim() || undefined;
  }

  return raw?.trim() || undefined;
}
