import { hashToken, opaqueToken } from "@timenote/runtime";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { ApiContext } from "./context.js";

export function startSession(ctx: ApiContext, reply: FastifyReply, userId: string): string {
  const { config, repo } = ctx;
  const now = ctx.now();
  const token = opaqueToken();
  const sessionId = hashToken(token);
  repo.sessions.purgeExpiredSessions(now);
  repo.sessions.putSession({
    id: sessionId,
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
  return sessionId;
}

export function endSession(ctx: ApiContext, req: FastifyRequest, reply: FastifyReply) {
  if (req.sessionId) {
    ctx.repo.sessions.removeSession(req.sessionId);
  }

  void reply.clearCookie(ctx.config.cookieName, {
    httpOnly: true,
    secure: ctx.config.cookieSecure,
    sameSite: "lax",
    path: "/",
  });
}
