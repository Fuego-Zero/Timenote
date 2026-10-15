import {
  changePasswordInputSchema,
  loginInputSchema,
  registerInputSchema,
  updateProfileInputSchema,
} from "@timenote/contracts";

import { toPublicUser } from "../accounts.js";
import {
  authenticateCredentials,
  changeOwnPassword,
  recordLogin,
  registerPublicUser,
  updateProfile,
} from "../authService.js";
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
        publicRegisterEnabled: config.publicRegisterEnabled,
      };
    }

    return {
      user: null,
      anonSign: ctx.requestSign.issueAnon(ctx.now()),
      publicRegisterEnabled: config.publicRegisterEnabled,
    };
  });

  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: config.env === "test" ? 1000 : config.loginLimit, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const input = loginInputSchema.parse(req.body);
      const user = await authenticateCredentials(repo, input.username, input.password);
      const now = ctx.now();
      recordLogin(repo, user.id, now);
      const sessionId = startSession(ctx, reply, user.id);
      req.userId = user.id;
      req.sessionId = sessionId;
      return {
        user: toPublicUser({ ...user, lastLoginAt: now }),
        signKey: ctx.requestSign.sessionSignKey(sessionId),
      };
    }
  );

  app.post(
    "/api/auth/register",
    {
      config: {
        rateLimit: { max: config.env === "test" ? 1000 : config.registerLimit, timeWindow: "1 minute" },
      },
    },
    async req => {
      const input = registerInputSchema.parse(req.body);
      await registerPublicUser(repo, config, input, ctx.now());
      return { success: true };
    }
  );

  app.post("/api/auth/logout", (req, reply) => {
    endSession(ctx, req, reply);
    return { success: true };
  });

  app.put("/api/auth/profile", req => {
    const user = requireUser(req);
    const input = updateProfileInputSchema.parse(req.body);
    const next = updateProfile(repo, user, input, ctx.now());
    return { user: toPublicUser(next) };
  });

  app.post("/api/auth/password", async req => {
    const user = requireUser(req);
    const input = changePasswordInputSchema.parse(req.body);
    await changeOwnPassword(repo, user, input, ctx.now(), req.sessionId);
    return { success: true };
  });
}
