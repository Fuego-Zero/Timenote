import { hashToken, type StoredUser } from "@timenote/runtime";
import type { FastifyRequest } from "fastify";

import type { ApiContext } from "./context.js";
import { assertCsrfOrigin, isPublicPath } from "./csrfOrigin.js";
import { pickDevBypassAdmin } from "./pickDevBypassAdmin.js";

declare module "fastify" {
  interface FastifyRequest {
    sessionId?: string;
    user?: StoredUser;
  }
}

const sessionTouchIntervalMs = 10 * 60 * 1000;

export function authenticate(ctx: ApiContext, req: FastifyRequest, allowPrivateLan: boolean) {
  const { config, repo } = ctx;
  const path = req.url.split("?")[0] ?? "/";
  if (isPublicPath(path)) {
    return;
  }

  assertCsrfOrigin(req, config.webOrigin, allowPrivateLan);

  const raw = req.cookies[config.cookieName];
  if (raw && /^[A-Za-z0-9_-]{43}$/.test(raw)) {
    const session = repo.sessions.getSession(hashToken(raw));
    const now = ctx.now();
    if (session && session.expiresAt > now) {
      const user = repo.users.getUser(session.userId);
      if (user && !user.disabled) {
        if (now - session.lastActiveAt > sessionTouchIntervalMs) {
          repo.sessions.putSession({ ...session, lastActiveAt: now, expiresAt: now + config.sessionTtlSeconds * 1000 });
        }

        req.user = user;
        req.sessionId = session.id;
        req.userId = user.id;
        return;
      }
    }
  }

  // development 免登录：不落库、不设 Cookie，只挂 req.user；无启用 admin 则不注入。
  // 身份必须稳定（最早创建的启用 admin），避免升任其他管理员后旁路换人并换 SIGN 密钥。
  if (config.devAuthBypass) {
    const admin = pickDevBypassAdmin(repo.users.listUsers());
    if (admin) {
      req.user = admin;
      req.userId = admin.id;
    }
  }
}
