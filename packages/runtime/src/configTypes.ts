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
