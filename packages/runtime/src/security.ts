import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const scryptParams = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const keyLength = 64;

function derive(password: string, salt: Buffer, params: { N: number; r: number; p: number }) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, { ...params, maxmem: scryptParams.maxmem }, (error, key) => {
      if (error) {
        reject(error);
      } else {
        resolve(key);
      }
    });
  });
}

/** 存储格式 `scrypt$N$r$p$salt$hash`，参数随哈希保存，便于以后提高强度。 */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, scryptParams);
  return [
    "scrypt",
    scryptParams.N,
    scryptParams.r,
    scryptParams.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** 32 字节随机值。会话只存 SHA-256；订阅 token 另外保存明文，以便登录后再次显示地址。 */
export function opaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** 用户不存在时仍执行一次等价哈希，避免通过响应时间枚举用户名。 */
export const dummyPasswordHash =
  "scrypt$32768$8$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
