import cookie from "@fastify/cookie";
import { BusinessError, hashToken, opaqueToken, sameWebOrigin, type StoredUser } from "@timenote/runtime";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { ApiContext } from "./context.js";

declare module "fastify" {
  interface FastifyRequest {
    sessionId?: string;
    user?: StoredUser;
  }
}

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const sessionTouchIntervalMs = 10 * 60 * 1000;

/** 订阅地址由日历客户端无交互拉取，凭 token 鉴权，不走 Cookie 会话与同源校验。 */
function isPublicPath(path: string) {
  return path === "/health" || path.startsWith("/api/feeds/");
}

export async function registerSession(ctx: ApiContext) {
  const { app, config } = ctx;
  await app.register(cookie);
  const allowPrivateLan = config.env !== "production";
  app.addHook("onRequest", (req, _reply, done) => {
    try {
      authenticate(ctx, req, allowPrivateLan);
      done();
    } catch (error) {
      done(error instanceof Error ? error : new Error("authenticate", { cause: error }));
    }
  });
}

function authenticate(ctx: ApiContext, req: FastifyRequest, allowPrivateLan: boolean) {
  const { config, repo } = ctx;
  const path = req.url.split("?")[0] ?? "/";
  if (isPublicPath(path)) {
    return;
  }

  const { origin } = req.headers;
  if (writeMethods.has(req.method) && !sameWebOrigin(origin, config.webOrigin, { allowPrivateLan })) {
    throw new BusinessError("FORBIDDEN");
  }

  if (origin && !sameWebOrigin(origin, config.webOrigin, { allowPrivateLan })) {
    throw new BusinessError("FORBIDDEN");
  }

  if (req.headers["sec-fetch-site"] === "cross-site") {
    throw new BusinessError("FORBIDDEN");
  }

  const raw = req.cookies[config.cookieName];
  if (!raw || !/^[A-Za-z0-9_-]{43}$/.test(raw)) {
    return;
  }

  const session = repo.getSession(hashToken(raw));
  const now = ctx.now();
  if (!session || session.expiresAt <= now) {
    return;
  }

  const user = repo.getUser(session.userId);
  if (!user || user.disabled) {
    return;
  }

  if (now - session.lastActiveAt > sessionTouchIntervalMs) {
    repo.putSession({ ...session, lastActiveAt: now, expiresAt: now + config.sessionTtlSeconds * 1000 });
  }

  req.user = user;
  req.sessionId = session.id;
  req.userId = user.id;
}

export function startSession(ctx: ApiContext, reply: FastifyReply, userId: string) {
  const { config, repo } = ctx;
  const now = ctx.now();
  const token = opaqueToken();
  repo.purgeExpiredSessions(now);
  repo.putSession({
    id: hashToken(token),
    userId,
    createdAt: now,
    lastActiveAt: now,
    expiresAt: now + config.sessionTtlSeconds * 1000,
  });
  void reply.setCookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "lax",
    path: "/",
    maxAge: config.sessionTtlSeconds,
  });
}

export function endSession(ctx: ApiContext, req: FastifyRequest, reply: FastifyReply) {
  if (req.sessionId) {
    ctx.repo.removeSession(req.sessionId);
  }

  void reply.clearCookie(ctx.config.cookieName, {
    httpOnly: true,
    secure: ctx.config.cookieSecure,
    sameSite: "lax",
    path: "/",
  });
}

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
