import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

import {
  canonicalSignPayload,
  requestSignHeaderNames,
  requestSignWindowSeconds,
} from "@timenote/contracts";

import { BusinessError } from "./http.js";

/** HKDF salt（固定应用标识，勿改以免已发放密钥全部失效）。 */
export const requestSignHkdfSalt = Buffer.from("timenote-request-mac-v1", "utf8");
/** HKDF 输出长度（字节）。 */
export const requestSignKeyLength = 32;
/** 匿名 signKey 有效期（毫秒）。 */
export const anonSignTtlMs = 5 * 60 * 1000;
/** 进程内同时存活的匿名 key 上限（防刷）。 */
export const anonSignMaxActive = 200;

export type SignKeyKind = "session" | "anon";

export function deriveSignKey(masterKey: Buffer, kind: SignKeyKind, id: string): Buffer {
  const info = Buffer.from(`${kind}:${id}`, "utf8");
  return Buffer.from(hkdfSync("sha256", masterKey, requestSignHkdfSalt, info, requestSignKeyLength));
}

export function signKeyToBase64Url(key: Buffer): string {
  return key.toString("base64url");
}

export function bodySha256Hex(raw: Buffer | string | undefined): string {
  const buf = raw === undefined ? Buffer.alloc(0) : typeof raw === "string" ? Buffer.from(raw, "utf8") : raw;
  return createHash("sha256").update(buf).digest("hex");
}

/** 路径：去掉 query；非根路径去掉尾部 `/`。 */
export function normalizeSignPath(url: string): string {
  const path = (url.split("?")[0] || "/").trim() || "/";
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

/** query：按键名排序后 `k=v&k2=v2`；无 query 为空串。值保持 URLSearchParams 解码后再按 encodeURIComponent 重编码。 */
export function normalizeSignQuery(url: string): string {
  const qIndex = url.indexOf("?");
  if (qIndex < 0) {
    return "";
  }

  const qs = url.slice(qIndex + 1);
  if (!qs) {
    return "";
  }

  const params = new URLSearchParams(qs);
  const pairs: Array<[string, string]> = [];
  for (const [key, value] of params.entries()) {
    pairs.push([key, value]);
  }

  pairs.sort((a, b) => {
    if (a[0] !== b[0]) {
      return a[0] < b[0] ? -1 : 1;
    }

    return a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
  });
  return pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
}

export function hmacSign(signKey: Buffer, payload: string): string {
  return createHmac("sha256", signKey).update(payload, "utf8").digest("base64url");
}

function safeEqualBase64Url(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "base64url");
    const right = Buffer.from(b, "base64url");
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function isSignExemptPath(method: string, path: string): boolean {
  if (path === "/health" || path.startsWith("/api/feeds/")) {
    return true;
  }

  const upper = method.toUpperCase();
  if (upper === "GET" && (path === "/api/auth/session" || path === "/api/setup")) {
    return true;
  }

  return false;
}

export function isAnonSignPath(method: string, path: string): boolean {
  const upper = method.toUpperCase();
  return (
    (upper === "POST" && path === "/api/auth/login") || (upper === "POST" && path === "/api/setup/admin")
  );
}

/** 进程内 nonce 去重与匿名 key 登记（单进程；多实例靠同一主密钥派生，nonce 不跨实例共享）。 */
export class RequestSignRegistry {
  private readonly nonces = new Map<string, number>();
  private readonly anons = new Map<string, number>();

  constructor(private readonly masterKey: Buffer) {}

  issueAnon(nowMs: number): { anonKeyId: string; signKey: string; expiresAt: number } {
    this.purge(nowMs);
    if (this.anons.size >= anonSignMaxActive) {
      throw new BusinessError("RATE_LIMITED", { message: "匿名签名密钥发放过于频繁，请稍后再试" });
    }

    const anonKeyId = randomBytes(32).toString("base64url");
    const expiresAt = nowMs + anonSignTtlMs;
    this.anons.set(anonKeyId, expiresAt);
    const signKey = signKeyToBase64Url(deriveSignKey(this.masterKey, "anon", anonKeyId));
    return { anonKeyId, signKey, expiresAt };
  }

  sessionSignKey(sessionId: string): string {
    return signKeyToBase64Url(deriveSignKey(this.masterKey, "session", sessionId));
  }

  /** development 无 cookie 注入用户时的稳定派生 id。 */
  devBypassSignKey(userId: string): string {
    return signKeyToBase64Url(deriveSignKey(this.masterKey, "session", `dev:${userId}`));
  }

  assertAnon(anonKeyId: string, nowMs: number) {
    this.purge(nowMs);
    const expiresAt = this.anons.get(anonKeyId);
    if (expiresAt === undefined || expiresAt <= nowMs) {
      throw new BusinessError("SIGN_INVALID");
    }
  }

  consumeNonce(nonce: string, expiresAtMs: number, nowMs: number) {
    this.purge(nowMs);
    if (this.nonces.has(nonce)) {
      throw new BusinessError("SIGN_REPLAY");
    }

    this.nonces.set(nonce, expiresAtMs);
  }

  private purge(nowMs: number) {
    for (const [nonce, expiresAt] of this.nonces) {
      if (expiresAt <= nowMs) {
        this.nonces.delete(nonce);
      }
    }

    for (const [id, expiresAt] of this.anons) {
      if (expiresAt <= nowMs) {
        this.anons.delete(id);
      }
    }
  }
}

export interface VerifySignInput {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  rawBody: Buffer | string | undefined;
  nowMs: number;
  /** 已认证会话 id（cookie 会话）；与 anon 二选一。 */
  sessionKeyId?: string;
  requireAnon: boolean;
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
