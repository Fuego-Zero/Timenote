import { type Challenge, createChallenge, randomInt, solveChallenge, verifySolution } from "altcha-lib";
import { deriveKey } from "altcha-lib/algorithms/pbkdf2";

/** 题目大约两分钟内有效，浏览器在这段时间里算完即可。 */
const challengeTtlMs = 2 * 60 * 1000;

function secrets(signMasterKey: Buffer) {
  const key = signMasterKey.toString("base64url");
  return {
    hmacSignatureSecret: key,
    // 和签名密钥分开，避免同一串 HMAC 密钥兼做两件事。
    hmacKeySignatureSecret: `${key}:altcha-key`,
  };
}

/** 公开注册的计算题：服务端签发并核对，同一题只能用一次。 */
export class RegisterChallenges {
  private readonly used = new Map<string, number>();

  constructor(private readonly signMasterKey: Buffer) {}

  async issue(nowMs: number, easy = false): Promise<Challenge> {
    this.purge(nowMs);
    return createChallenge({
      algorithm: "PBKDF2/SHA-256",
      // 正式环境大约要算一两秒，页面会停在「正在验证」。测试用小代价，避免每条注册都等数秒。
      cost: easy ? 50 : 4000,
      counter: randomInt(easy ? 4 : 1800, easy ? 16 : 3200),
      deriveKey,
      // 过期时间放进签名数据，核对时用服务端时钟。库自带的 expiresAt 按机器时间判断，测试时钟对不上就会误判。
      data: { issuedAt: nowMs },
      ...secrets(this.signMasterKey),
    });
  }

  async consume(payload: string, nowMs: number): Promise<boolean> {
    this.purge(nowMs);
    let decoded: { challenge?: Challenge; solution?: { counter: number; derivedKey: string } };
    try {
      decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as typeof decoded;
    } catch {
      return false;
    }

    const signature = decoded.challenge?.signature;
    const issuedAt = decoded.challenge?.parameters.data?.issuedAt;
    if (
      !signature ||
      !decoded.challenge ||
      !decoded.solution ||
      typeof issuedAt !== "number" ||
      nowMs < issuedAt ||
      nowMs - issuedAt > challengeTtlMs ||
      this.used.has(signature)
    ) {
      return false;
    }

    const result = await verifySolution({
      challenge: decoded.challenge,
      solution: decoded.solution,
      deriveKey,
      ...secrets(this.signMasterKey),
    });
    if (!result.verified) {
      return false;
    }

    const expiresMs = issuedAt + challengeTtlMs;
    this.used.set(signature, expiresMs);
    return true;
  }

  private purge(nowMs: number) {
    for (const [signature, expiresAt] of this.used) {
      if (expiresAt <= nowMs) {
        this.used.delete(signature);
      }
    }
  }
}

/** 测试里模拟浏览器把题算完，得到注册请求要带的 payload。 */
export async function encodeSolvedAltcha(challenge: Challenge): Promise<string> {
  const solution = await solveChallenge({ challenge, deriveKey });
  if (!solution) {
    throw new Error("解不出注册校验题");
  }

  return Buffer.from(
    JSON.stringify({
      challenge: { parameters: challenge.parameters, signature: challenge.signature },
      solution,
    })
  ).toString("base64");
}
