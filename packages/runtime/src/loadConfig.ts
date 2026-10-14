import { isTimeZone } from "@timenote/contracts";

import type { Config } from "./configTypes.js";
import { integerEnv, originEnv, requiredEnv, signMasterKeyEnv, textEnv } from "./envParse.js";

const defaultSessionTtlSeconds = 30 * 24 * 60 * 60;

export function loadConfig(env: NodeJS.Dict<string> = process.env): Config {
  const nodeEnv = textEnv(env, "NODE_ENV", "development");
  const production = nodeEnv === "production";
  const sqlitePath = requiredEnv(env, "SQLITE_PATH");
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

  const defaultTimeZone = textEnv(env, "DEFAULT_TIME_ZONE", "Asia/Shanghai");
  if (!isTimeZone(defaultTimeZone)) {
    throw new Error("DEFAULT_TIME_ZONE 必须是 IANA 时区");
  }

  const webBindHost = textEnv(env, "WEB_BIND_HOST", "127.0.0.1");
  // 仅 development 开启；未设置 DEV_AUTH_BYPASS 视为开启，设为 0 关闭。production/test 一律关闭。
  const devAuthBypass = nodeEnv === "development" && env.DEV_AUTH_BYPASS !== "0";
  return {
    env: nodeEnv,
    devAuthBypass,
    apiPort: integerEnv(env, "API_PORT", 8721, 1, 65535),
    webPort: integerEnv(env, "WEB_PORT", 8720, 1, 65535),
    webBindHost,
    webOrigin: originEnv(textEnv(env, "WEB_ORIGIN", "http://127.0.0.1:8720"), production),
    sqlitePath,
    cookieName: cookieSecure ? "__Host-timenote" : "timenote.session",
    cookieSecure,
    sessionTtlSeconds: integerEnv(env, "SESSION_TTL_SECONDS", defaultSessionTtlSeconds, 300, 365 * 24 * 60 * 60),
    signMasterKey: signMasterKeyEnv(env, production),
    loginLimit: integerEnv(env, "LOGIN_RATE_LIMIT", 10, 1, 1000),
    bodyLimit: integerEnv(env, "REQUEST_BODY_LIMIT", 1024 * 1024, 1024, 16 * 1024 * 1024),
    defaultTimeZone,
    feedPastYears: integerEnv(env, "FEED_WINDOW_PAST_YEARS", 1, 0, 10),
    feedFutureYears: integerEnv(env, "FEED_WINDOW_FUTURE_YEARS", 20, 1, 50),
  };
}
