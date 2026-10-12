import { setupAdminInputSchema } from "@timenote/contracts";

import { toPublicUser } from "../accounts.js";
import type { ApiContext } from "../context.js";
import { startSession } from "../session.js";
import { createInitialAdmin, hasEnabledAdmin } from "../setupService.js";

export function registerSetup(ctx: ApiContext) {
  const { app, config, repo } = ctx;

  app.get("/api/setup", () => {
    const needed = !hasEnabledAdmin(repo);
    // 匿名短时 key：login/setup 写前领取；needed 与否都可下发（只读探测，不扩大写权限）。
    return { needed, anonSign: ctx.requestSign.issueAnon(ctx.now()) };
  });

  app.post(
    "/api/setup/admin",
    { config: { rateLimit: { max: config.env === "test" ? 1000 : config.loginLimit, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const input = setupAdminInputSchema.parse(req.body);
      const created = await createInitialAdmin(repo, config, input, ctx.now());
      const sessionId = startSession(ctx, reply, created.id);
      req.userId = created.id;
      req.sessionId = sessionId;
      return { user: toPublicUser(created), signKey: ctx.requestSign.sessionSignKey(sessionId) };
    }
  );
}
