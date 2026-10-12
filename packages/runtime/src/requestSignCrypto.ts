import { createHash, createHmac, hkdfSync, timingSafeEqual } from "node:crypto";

/** HKDF salt（固定应用标识，勿改以免已发放密钥全部失效）。 */
export const requestSignHkdfSalt = Buffer.from("timenote-request-mac-v1", "utf8");
/** HKDF 输出长度（字节）。 */
export const requestSignKeyLength = 32;

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

export function hmacSign(signKey: Buffer, payload: string): string {
  return createHmac("sha256", signKey).update(payload, "utf8").digest("base64url");
}

export function safeEqualBase64Url(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "base64url");
    const right = Buffer.from(b, "base64url");
    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}
