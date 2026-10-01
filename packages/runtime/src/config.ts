import { isTimeZone, passwordSchema, usernameSchema } from "@timenote/contracts";

export interface LogSink {
  write(message: string): void;
}

export interface Config {
  apiPort: number;
  bodyLimit: number;
  cookieName: string;
  cookieSecure: boolean;
  defaultTimeZone: string;
  env: string;
  feedFutureYears: number;
  feedPastYears: number;
  initialAdmin?: { username: string; password: string };
  loginLimit: number;
  logSink?: LogSink;
  sessionTtlSeconds: number;
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

function initialAdmin(env: NodeJS.Dict<string>) {
  const username = env.INITIAL_ADMIN_USERNAME?.trim();
  const password = env.INITIAL_ADMIN_PASSWORD;
  if (!username && !password) {
    return undefined;
  }

  if (!username || !password) {
    throw new Error("INITIAL_ADMIN_USERNAME 和 INITIAL_ADMIN_PASSWORD 必须同时配置");
  }

  const parsedName = usernameSchema.safeParse(username);
  if (!parsedName.success) {
    throw new Error("INITIAL_ADMIN_USERNAME 格式无效");
  }

  if (!passwordSchema.safeParse(password).success) {
    throw new Error("INITIAL_ADMIN_PASSWORD 长度必须为 8-128 位");
  }

  return { username: parsedName.data, password };
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
  return {
    env: nodeEnv,
    apiPort: integer(env, "API_PORT", 8721, 1, 65535),
    webPort: integer(env, "WEB_PORT", 8720, 1, 65535),
    webBindHost,
    webOrigin: origin(text(env, "WEB_ORIGIN", "http://127.0.0.1:8720"), production),
    sqlitePath,
    cookieName: cookieSecure ? "__Host-timenote" : "timenote.session",
    cookieSecure,
    sessionTtlSeconds: integer(env, "SESSION_TTL_SECONDS", defaultSessionTtlSeconds, 300, 365 * 24 * 60 * 60),
    loginLimit: integer(env, "LOGIN_RATE_LIMIT", 10, 1, 1000),
    bodyLimit: integer(env, "REQUEST_BODY_LIMIT", 1024 * 1024, 1024, 16 * 1024 * 1024),
    defaultTimeZone,
    feedPastYears: integer(env, "FEED_WINDOW_PAST_YEARS", 1, 0, 10),
    feedFutureYears: integer(env, "FEED_WINDOW_FUTURE_YEARS", 20, 1, 50),
    initialAdmin: initialAdmin(env),
  };
}
