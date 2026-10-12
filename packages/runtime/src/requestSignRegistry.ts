import { randomBytes } from "node:crypto";

import { BusinessError } from "./apiErrors.js";
import { deriveSignKey, signKeyToBase64Url } from "./requestSignCrypto.js";

/** 匿名 signKey 有效期（毫秒）。 */
export const anonSignTtlMs = 5 * 60 * 1000;
/** 进程内同时存活的匿名 key 上限（防刷）。 */
export const anonSignMaxActive = 200;

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
