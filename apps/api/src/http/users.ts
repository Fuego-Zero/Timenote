import { createUserInputSchema, resetPasswordInputSchema, updateUserInputSchema } from "@timenote/contracts";
import { z } from "zod";

import { createUser, deleteUser, resetPassword, toPublicUser, updateUser } from "../accounts.js";
import type { ApiContext } from "../context.js";
import { requireAdmin } from "../session.js";

const idParams = z.object({ id: z.uuid() });

/** 管理员后台：只管理账号本身，不提供读取其他账号事件或订阅的接口。 */
export function registerUsers(ctx: ApiContext) {
  const { app, config, repo } = ctx;
  app.get("/api/admin/users", req => {
    requireAdmin(req);
    return { users: repo.listUsers().map(toPublicUser) };
  });

  app.post("/api/admin/users", async (req, reply) => {
    requireAdmin(req);
    const input = createUserInputSchema.parse(req.body);
    const user = await createUser(repo, input, config.defaultTimeZone, ctx.now());
    return reply.code(201).send({ user: toPublicUser(user) });
  });

  app.patch("/api/admin/users/:id", req => {
    const actor = requireAdmin(req);
    const { id } = idParams.parse(req.params);
    const input = updateUserInputSchema.parse(req.body);
    return { user: toPublicUser(updateUser(repo, actor, id, input, ctx.now())) };
  });

  app.post("/api/admin/users/:id/password", async req => {
    requireAdmin(req);
    const { id } = idParams.parse(req.params);
    const input = resetPasswordInputSchema.parse(req.body);
    return { user: toPublicUser(await resetPassword(repo, id, input.password, ctx.now())) };
  });

  app.delete("/api/admin/users/:id", req => {
    const actor = requireAdmin(req);
    const { id } = idParams.parse(req.params);
    deleteUser(repo, actor, id);
    return { success: true };
  });
}
