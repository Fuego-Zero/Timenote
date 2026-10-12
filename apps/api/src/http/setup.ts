import { randomUUID } from "node:crypto";

import { setupAdminInputSchema } from "@timenote/contracts";
import {
  BusinessError,
  hashPassword,
  isStrongAdminPassword,
  strongAdminPasswordMessage,
  type StoredUser,
} from "@timenote/runtime";

import { toPublicUser } from "../accounts.js";
import type { ApiContext } from "../context.js";
import { startSession } from "../session.js";

function hasEnabledAdmin(repo: ApiContext["repo"]) {
  return repo.listUsers().some(user => user.role === "admin" && !user.disabled);
}

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
      if (config.env === "production" && !isStrongAdminPassword(input.password)) {
        throw new BusinessError("INVALID_INPUT", {
          fields: { password: strongAdminPasswordMessage() },
        });
      }

      const passwordHash = await hashPassword(input.password);
      const now = ctx.now();
      let created: StoredUser | undefined;
      try {
        created = repo.transaction(() => {
          if (repo.listUsers().length) {
            throw new BusinessError("FORBIDDEN", { message: "已有用户，无法再次引导创建管理员" });
          }

          const user: StoredUser = {
            id: randomUUID(),
            username: input.username,
            displayName: input.displayName?.trim() || "管理员",
            role: "admin",
            disabled: false,
            timeZone: config.defaultTimeZone,
            mustChangePassword: false,
            createdAt: now,
            updatedAt: now,
            passwordHash,
          };
          repo.putUser(user);
          return user;
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/UNIQUE|unique/i.test(message)) {
          throw new BusinessError("FORBIDDEN", { message: "已有用户，无法再次引导创建管理员" });
        }

        throw error;
      }

      const sessionId = startSession(ctx, reply, created.id);
      req.userId = created.id;
      req.sessionId = sessionId;
      return { user: toPublicUser(created), signKey: ctx.requestSign.sessionSignKey(sessionId) };
    }
  );
}
