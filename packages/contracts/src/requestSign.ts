import { z } from "zod";

/** 请求完整性 MAC 的 HTTP 头名（小写；HTTP 头大小写不敏感）。 */
export const requestSignHeaderNames = {
  timestamp: "x-timenote-timestamp",
  nonce: "x-timenote-nonce",
  signature: "x-timenote-signature",
  anonId: "x-timenote-anon-id",
} as const;

/** 服务端允许的请求时间窗（秒）。 */
export const requestSignWindowSeconds = 60;

export const anonSignSchema = z.object({
  anonKeyId: z.string().min(1),
  /** 派生后的 HMAC 密钥（base64url），仅存于客户端内存。 */
  signKey: z.string().min(1),
  expiresAt: z.int(),
});
export type AnonSign = z.infer<typeof anonSignSchema>;

/** 构造待 HMAC 的规范串；前后端必须一致。 */
export function canonicalSignPayload(input: {
  method: string;
  path: string;
  query: string;
  timestamp: string;
  nonce: string;
  bodyHash: string;
}) {
  return [input.method.toUpperCase(), input.path, input.query, input.timestamp, input.nonce, input.bodyHash].join("\n");
}
