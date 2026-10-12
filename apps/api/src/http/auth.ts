import { changePasswordInputSchema, loginInputSchema, updateProfileInputSchema } from "@timenote/contracts";
import { BusinessError, dummyPasswordHash, hashPassword, verifyPassword } from "@timenote/runtime";

import { toPublicUser } from "../accounts.js";
import type { ApiContext } from "../context.js";
import { issueSessionSignKey } from "../requestSign.js";
import { endSession, requireUser, startSession } from "../session.js";

export function registerAuth(ctx: ApiContext) {
  const { app, config, repo } = ctx;
  app.get("/api/auth/session", req => {
    if (req.user) {
      return {
        user: toPublicUser(req.user),
        signKey: issueSessionSignKey(ctx, req.sessionId, req.user.id),
      };
    }

    return { user: null, anonSign: ctx.requestSign.issueAnon(ctx.now()) };
  });

  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: config.env === "test" ? 1000 : config.loginLimit, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const input = loginInputSchema.parse(req.body);
      const user = repo.getUserByUsername(input.username);
      const valid = await verifyPassword(input.password, user?.passwordHash ?? dummyPasswordHash);
      // 账号不存在、已停用与密码错误返回同一提示，不暴露账号状态。
      if (!user || user.disabled || !valid) {
        throw new BusinessError("INVALID_CREDENTIALS");
      }

      const sessionId = startSession(ctx, reply, user.id);
      req.userId = user.id;
      req.sessionId = sessionId;
      return { user: toPublicUser(user), signKey: ctx.requestSign.sessionSignKey(sessionId) };
    }
  );

  app.post("/api/auth/logout", (req, reply) => {
    endSession(ctx, req, reply);
    return { success: true };
  });

  app.put("/api/auth/profile", req => {
    const user = requireUser(req);
    const input = updateProfileInputSchema.parse(req.body);
    const next = { ...user, displayName: input.displayName, timeZone: input.timeZone, updatedAt: ctx.now() };
    repo.putUser(next);
    return { user: toPublicUser(next) };
  });

  app.post("/api/auth/password", async req => {
    const user = requireUser(req);
    const input = changePasswordInputSchema.parse(req.body);
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new BusinessError("INVALID_INPUT", { fields: { currentPassword: "当前密码不正确" } });
    }

    const passwordHash = await hashPassword(input.newPassword);
    repo.transaction(() => {
      repo.putUser({ ...user, passwordHash, mustChangePassword: false, updatedAt: ctx.now() });
      // 改密后其他设备上的登录全部失效，只保留当前会话。
      repo.removeUserSessions(user.id, req.sessionId);
    });
    return { success: true };
  });
}
