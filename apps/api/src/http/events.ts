import { eventPageQuerySchema } from "@timenote/contracts";
import { z } from "zod";

import type { ApiContext } from "../context.js";
import { createEvent, deleteEvent, listEventsByNextOccurrence, parseEventInput, updateEvent } from "../events.js";
import { requireUser } from "../session.js";

const idParams = z.object({ id: z.uuid() });

export function registerEvents(ctx: ApiContext) {
  const { app, repo } = ctx;
  app.get("/api/events", req => {
    const user = requireUser(req);
    const { sort, ...query } = eventPageQuerySchema.parse(req.query);
    // 下次发生依赖用户时区与今天，只能在服务层计算；按 nextWithinDays 过滤时同样走这里，结果按下次发生排序。
    if (sort === "nextOccurrence" || query.nextWithinDays !== undefined) {
      return listEventsByNextOccurrence(repo, user.id, query, ctx.now(), user.timeZone);
    }

    return repo.events.listEventsPage(user.id, query);
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
    deleteEvent(repo, user.id, id);
    return { success: true };
  });
}
