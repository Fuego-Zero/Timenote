import { createFeedTokenInputSchema } from "@timenote/contracts";
import { BusinessError } from "@timenote/runtime";
import { z } from "zod";

import type { ApiContext } from "../context.js";
import { createFeedToken, rotateFeedToken, toFeedToken } from "../feeds.js";
import { requireUser } from "../session.js";

const idParams = z.object({ id: z.uuid() });

export function registerFeedTokens(ctx: ApiContext) {
  const { app, config, repo } = ctx;
  app.get("/api/feed-tokens", req => {
    const user = requireUser(req);
    return { feeds: repo.listFeedTokens(user.id).map(toFeedToken) };
  });

  app.post("/api/feed-tokens", (req, reply) => {
    const user = requireUser(req);
    const input = createFeedTokenInputSchema.parse(req.body);
    return reply.code(201).send(createFeedToken(repo, config, user.id, input.name, ctx.now()));
  });

  app.post("/api/feed-tokens/:id/rotate", req => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    return rotateFeedToken(repo, config, user.id, id, ctx.now());
  });

  app.delete("/api/feed-tokens/:id", req => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    if (!repo.removeFeedToken(user.id, id)) {
      throw new BusinessError("NOT_FOUND");
    }

    return { success: true };
  });
}
