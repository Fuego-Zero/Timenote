import { BusinessError } from "@timenote/runtime";
import { z } from "zod";

import type { ApiContext } from "../context.js";
import { createEvent, parseEventInput, updateEvent } from "../events.js";
import { requireUser } from "../session.js";

const idParams = z.object({ id: z.uuid() });

export function registerEvents(ctx: ApiContext) {
  const { app, repo } = ctx;
  app.get("/api/events", req => {
    const user = requireUser(req);
    return { events: repo.events.listEvents(user.id) };
  });

  app.post("/api/events", (req, reply) => {
    const user = requireUser(req);
    const event = createEvent(repo, user.id, parseEventInput(req.body), ctx.now());
    return reply.code(201).send({ event });
  });

  app.put("/api/events/:id", req => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    return { event: updateEvent(repo, user.id, id, parseEventInput(req.body), ctx.now()) };
  });

  app.delete("/api/events/:id", req => {
    const user = requireUser(req);
    const { id } = idParams.parse(req.params);
    if (!repo.events.removeEvent(user.id, id)) {
      throw new BusinessError("NOT_FOUND");
    }

    return { success: true };
  });
}
