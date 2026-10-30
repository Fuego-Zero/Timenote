import { createHash } from "node:crypto";

export function requiredEnv(env: NodeJS.Dict<string>, name: string) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`缺少 ${name}`);
  }

  return value;
}

/** 未设置或仅含空白时使用默认值；`.env` 中留空等同于未配置。 */
export function textEnv(env: NodeJS.Dict<string>, name: string, fallback: string) {
  const value = env[name]?.trim();
  if (!value) {
    return fallback;
  }

  return value;
}

/** 未设置或仅含空白时使用默认值；只接受 true / false。 */
export function booleanEnv(env: NodeJS.Dict<string>, name: string, fallback: boolean) {
  const raw = env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  if (raw === "true") {
    return true;
  }

  if (raw === "false") {
    return false;
  }

  throw new Error(`${name} 只能是 true 或 false`);
}

export function integerEnv(env: NodeJS.Dict<string>, name: string, fallback: number, min: number, max: number) {
  const raw = env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} 必须是 ${min}-${max} 之间的整数`);
  }

  return value;
}

export function originEnv(value: string, httpsOnly: boolean, name = "WEB_ORIGIN") {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} 不是有效地址`);
  }

  if (
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password ||
    value.endsWith("/")
  ) {
    throw new Error(`${name} 只能包含协议、主机和端口`);
  }

  if (httpsOnly && parsed.protocol !== "https:") {
    throw new Error(`生产环境 ${name} 必须使用 HTTPS`);
  }

  return parsed.origin;
}

/** production 必填 base64url（解码≥32字节）；development/test 缺省时用固定派生密钥（勿用于生产）。 */
export function signMasterKeyEnv(env: NodeJS.Dict<string>, production: boolean): Buffer {
  const raw = env.SIGN_MASTER_KEY?.trim();
  if (!raw) {
    if (production) {
      throw new Error("缺少 SIGN_MASTER_KEY");
    }

    return createHash("sha256").update("timenote-dev-sign-master-key-v1").digest();
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64url");
  } catch {
    throw new Error("SIGN_MASTER_KEY 必须是 base64url");
  }

  if (key.length < 32) {
    throw new Error("SIGN_MASTER_KEY 解码后至少 32 字节");
  }

  return key;
}
