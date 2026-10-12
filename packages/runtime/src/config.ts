import { createHash } from "node:crypto";

import { isTimeZone } from "@timenote/contracts";

export interface LogSink {
  write(message: string): void;
}

export interface Config {
  apiPort: number;
  bodyLimit: number;
  cookieName: string;
  cookieSecure: boolean;
  defaultTimeZone: string;
  /** development 且 DEV_AUTH_BYPASS 未设为 0 时，无真实会话则注入首个启用 admin（不落库、不设 Cookie）。 */
  devAuthBypass: boolean;
  env: string;
  feedFutureYears: number;
  feedPastYears: number;
  loginLimit: number;
  logSink?: LogSink;
  sessionTtlSeconds: number;
  /** 请求完整性 MAC 的 HKDF 主密钥（≥32 字节）。 */
  signMasterKey: Buffer;
  sqlitePath: string;
  webBindHost: string;
  /** 浏览器访问的同源地址，同时是订阅链接的公网基址。 */
  webOrigin: string;
  webPort: number;
}

const defaultSessionTtlSeconds = 30 * 24 * 60 * 60;

function required(env: NodeJS.Dict<string>, name: string) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`缺少 ${name}`);
  }

  return value;
}

/** 未设置或仅含空白时使用默认值；`.env` 中留空等同于未配置。 */
function text(env: NodeJS.Dict<string>, name: string, fallback: string) {
  const value = env[name]?.trim();
  if (!value) {
    return fallback;
  }

  return value;
}

function integer(env: NodeJS.Dict<string>, name: string, fallback: number, min: number, max: number) {
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

function origin(value: string, httpsOnly: boolean) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("WEB_ORIGIN 不是有效地址");
  }

  if (parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || value.endsWith("/")) {
    throw new Error("WEB_ORIGIN 只能包含协议、主机和端口");
  }

  if (httpsOnly && parsed.protocol !== "https:") {
    throw new Error("生产环境 WEB_ORIGIN 必须使用 HTTPS");
  }

  return parsed.origin;
}


/** production 必填 base64url（解码≥32字节）；development/test 缺省时用固定派生密钥（勿用于生产）。 */
function signMasterKey(env: NodeJS.Dict<string>, production: boolean): Buffer {
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

export function loadConfig(env: NodeJS.Dict<string> = process.env): Config {
  const nodeEnv = text(env, "NODE_ENV", "development");
  const production = nodeEnv === "production";
  const sqlitePath = required(env, "SQLITE_PATH");
  if (sqlitePath === ":memory:") {
    throw new Error("SQLITE_PATH 必须是文件路径");
  }

  let cookieSecure = production;
  if (env.COOKIE_SECURE === "true") {
    cookieSecure = true;
  } else if (env.COOKIE_SECURE === "false") {
    cookieSecure = false;
  } else if (env.COOKIE_SECURE) {
    throw new Error("COOKIE_SECURE 只能是 true 或 false");
  }

  if (production && !cookieSecure) {
    throw new Error("生产环境不能关闭 COOKIE_SECURE");
  }

  const defaultTimeZone = text(env, "DEFAULT_TIME_ZONE", "Asia/Shanghai");
  if (!isTimeZone(defaultTimeZone)) {
    throw new Error("DEFAULT_TIME_ZONE 必须是 IANA 时区");
  }

  const webBindHost = text(env, "WEB_BIND_HOST", "127.0.0.1");
  // 仅 development 开启；未设置 DEV_AUTH_BYPASS 视为开启，设为 0 关闭。production/test 一律关闭。
  const devAuthBypass = nodeEnv === "development" && env.DEV_AUTH_BYPASS !== "0";
  return {
    env: nodeEnv,
    devAuthBypass,
    apiPort: integer(env, "API_PORT", 8721, 1, 65535),
    webPort: integer(env, "WEB_PORT", 8720, 1, 65535),
    webBindHost,
    webOrigin: origin(text(env, "WEB_ORIGIN", "http://127.0.0.1:8720"), production),
    sqlitePath,
    cookieName: cookieSecure ? "__Host-timenote" : "timenote.session",
    cookieSecure,
    sessionTtlSeconds: integer(env, "SESSION_TTL_SECONDS", defaultSessionTtlSeconds, 300, 365 * 24 * 60 * 60),
    signMasterKey: signMasterKey(env, production),
    loginLimit: integer(env, "LOGIN_RATE_LIMIT", 10, 1, 1000),
    bodyLimit: integer(env, "REQUEST_BODY_LIMIT", 1024 * 1024, 1024, 16 * 1024 * 1024),
    defaultTimeZone,
    feedPastYears: integer(env, "FEED_WINDOW_PAST_YEARS", 1, 0, 10),
    feedFutureYears: integer(env, "FEED_WINDOW_FUTURE_YEARS", 20, 1, 50),
  };
}
