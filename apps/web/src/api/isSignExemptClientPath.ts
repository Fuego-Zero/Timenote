export function isSignExemptClientPath(method: string, apiPath: string): boolean {
  // apiPath 形如 `/auth/session`（client 传入的是 `/api` 之后的部分）
  const full = apiPath.startsWith("/api/") ? apiPath : `/api${apiPath.startsWith("/") ? apiPath : `/${apiPath}`}`;
  const path = full.split("?")[0] ?? full;
  if (path.startsWith("/api/feeds/") || path === "/health") {
    return true;
  }

  const upper = method.toUpperCase();
  return upper === "GET" && (path === "/api/auth/session" || path === "/api/setup");
}
