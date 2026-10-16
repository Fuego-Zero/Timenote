/** 路径：去掉 query；非根路径去掉尾部 `/`。 */
export function normalizeSignPath(url: string): string {
  const path = (url.split("?")[0] || "/").trim() || "/";
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

/** query：按键名排序后 `k=v&k2=v2`；无 query 为空串。值保持 URLSearchParams 解码后再按 encodeURIComponent 重编码。 */
export function normalizeSignQuery(url: string): string {
  const qIndex = url.indexOf("?");
  if (qIndex < 0) {
    return "";
  }

  const qs = url.slice(qIndex + 1);
  if (!qs) {
    return "";
  }

  const params = new URLSearchParams(qs);
  const pairs: [string, string][] = [];
  for (const [key, value] of params.entries()) {
    pairs.push([key, value]);
  }

  pairs.sort((a, b) => {
    if (a[0] !== b[0]) {
      return a[0] < b[0] ? -1 : 1;
    }

    if (a[1] < b[1]) {
      return -1;
    }

    return a[1] > b[1] ? 1 : 0;
  });
  return pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&");
}

export function isSignExemptPath(method: string, path: string): boolean {
  if (path === "/health" || path.startsWith("/api/feeds/")) {
    return true;
  }

  const upper = method.toUpperCase();
  if (
    upper === "GET" &&
    (path === "/api/auth/session" || path === "/api/auth/register-challenge" || path === "/api/setup")
  ) {
    return true;
  }

  return false;
}

export function isAnonSignPath(method: string, path: string): boolean {
  const upper = method.toUpperCase();
  return (
    (upper === "POST" && path === "/api/auth/login") ||
    (upper === "POST" && path === "/api/auth/register") ||
    (upper === "POST" && path === "/api/setup/admin")
  );
}
