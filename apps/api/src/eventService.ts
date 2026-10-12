import { randomUUID } from "node:crypto";

import type { CalendarEvent, EventInput } from "@timenote/contracts";
import { BusinessError, type OpenedRepository } from "@timenote/runtime";

export function createEvent(
  repo: OpenedRepository,
  ownerId: string,
  input: EventInput,
  now: number,
  id: string = randomUUID()
) {
  const event: CalendarEvent = { ...input, id, ownerId, revision: 0, createdAt: now, updatedAt: now };
  repo.events.putEvent(event);
  return event;
}

/** 修改只替换可编辑内容；ID、归属和创建时间不变，revision 递增供订阅识别更新。 */
export function reviseEvent(existing: CalendarEvent, input: EventInput, now: number): CalendarEvent {
  return {
    ...input,
    id: existing.id,
    ownerId: existing.ownerId,
    createdAt: existing.createdAt,
    revision: existing.revision + 1,
    updatedAt: Math.max(now, existing.updatedAt + 1),
  };
}

export function updateEvent(repo: OpenedRepository, ownerId: string, id: string, input: EventInput, now: number) {
  return repo.transaction(() => {
    const existing = repo.events.getEvent(ownerId, id);
    if (!existing) {
      throw new BusinessError("NOT_FOUND");
    }

    const next = reviseEvent(existing, input, now);
    repo.events.putEvent(next);
    return next;
  });
}
