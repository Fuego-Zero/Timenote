export interface LogSink {
  write(message: string): void;
}

export interface Config {
  apiPort: number;
  bodyLimit: number;
  cookieName: string;
  cookieSecure: boolean;
  defaultTimeZone: string;
  /** development 且 DEV_AUTH_BYPASS 未设为 0 时，无真实会话则注入最早创建的启用 admin（不落库、不设 Cookie；身份按 createdAt 稳定，不随 username 排序变化）。 */
  devAuthBypass: boolean;
  env: string;
  feedFutureYears: number;
  feedPastYears: number;
  loginLimit: number;
  logSink?: LogSink;
  /** 是否开放公开自助注册；默认 false。 */
  publicRegisterEnabled: boolean;
  /** 公开注册新账号是否默认停用；默认 true。为 false 时账号可立即登录，仍不在注册时建会话。 */
  registerDefaultDisabled: boolean;
  /** 公开注册每分钟每来源上限；默认 ≤ loginLimit。 */
  registerLimit: number;
  sessionTtlSeconds: number;
  /** 请求完整性 MAC 的 HKDF 主密钥（≥32 字节）。 */
  signMasterKey: Buffer;
  sqlitePath: string;
  webBindHost: string;
  /** 浏览器访问的同源地址，同时是订阅链接的公网基址。 */
  webOrigin: string;
  webPort: number;
}
