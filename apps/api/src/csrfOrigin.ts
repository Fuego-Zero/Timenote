import { BusinessError, sameWebOrigin } from "@timenote/runtime";
import type { FastifyRequest } from "fastify";

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** 订阅地址由日历客户端无交互拉取，凭 token 鉴权，不走 Cookie 会话与同源校验。 */
export function isPublicPath(path: string) {
  return path === "/health" || path.startsWith("/api/feeds/");
}

/** CSRF/同源：写方法必须带合法 Origin；任意 Origin 头也须合法；拒 cross-site。 */
export function assertCsrfOrigin(req: FastifyRequest, webOrigin: string, allowPrivateLan: boolean) {
  const { origin } = req.headers;
  if (writeMethods.has(req.method) && !sameWebOrigin(origin, webOrigin, { allowPrivateLan })) {
    throw new BusinessError("FORBIDDEN");
  }

  if (origin && !sameWebOrigin(origin, webOrigin, { allowPrivateLan })) {
    throw new BusinessError("FORBIDDEN");
  }

  if (req.headers["sec-fetch-site"] === "cross-site") {
    throw new BusinessError("FORBIDDEN");
  }
}
