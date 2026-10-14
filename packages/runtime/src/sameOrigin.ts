export function isPrivateIpv4(host: string) {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return false;
  }

  const nums = parts.map(Number);
  if (nums.some(n => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }

  const [a, b] = nums as [number, number, number, number];
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/** 写请求只接受与 WEB_ORIGIN 同源的浏览器请求；非生产环境额外允许回环与私网地址，方便手机调试。 */
export function sameWebOrigin(
  origin: string | undefined,
  allowed: string,
  options: { allowPrivateLan?: boolean } = {}
) {
  if (!origin) {
    return false;
  }

  if (origin === allowed) {
    return true;
  }

  try {
    const a = new URL(origin);
    const b = new URL(allowed);
    const portOf = (url: URL) => url.port || (url.protocol === "https:" ? "443" : "80");
    if (a.protocol !== b.protocol || portOf(a) !== portOf(b)) {
      return false;
    }

    const loopback = (host: string) => host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (loopback(a.hostname) && loopback(b.hostname)) {
      return true;
    }

    return Boolean(options.allowPrivateLan && isPrivateIpv4(a.hostname));
  } catch {
    return false;
  }
}
