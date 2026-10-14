import { BusinessError, type StoredUser } from "@timenote/runtime";
import type { FastifyRequest } from "fastify";

export function requireUser(req: FastifyRequest): StoredUser {
  if (!req.user) {
    throw new BusinessError("AUTH_REQUIRED");
  }

  return req.user;
}

/** 权限在服务端判断，不依赖前端隐藏入口。 */
export function requireAdmin(req: FastifyRequest): StoredUser {
  const user = requireUser(req);
  if (user.role !== "admin") {
    throw new BusinessError("FORBIDDEN");
  }

  return user;
}
