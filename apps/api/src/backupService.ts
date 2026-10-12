import { randomUUID } from "node:crypto";

import type { BackupFile, CalendarEvent, EventInput } from "@timenote/contracts";
import type { OpenedRepository } from "@timenote/runtime";

import { createEvent, reviseEvent } from "./eventService.js";
import { parseEventInput } from "./parseEventInput.js";

export function exportBackup(repo: OpenedRepository, ownerId: string, now: number): BackupFile {
  return {
    format: "timenote-backup",
    version: 1,
    exportedAt: new Date(now).toISOString(),
    events: repo.events.listEvents(ownerId).map(event => ({ id: event.id, event: editableFields(event) })),
  };
}

function editableFields(event: CalendarEvent): EventInput {
  const { kind, name, titleTemplate, titlePrefix, note, date, durationDays, rules, alarms } = event;
  return { kind, name, titleTemplate, titlePrefix, note, date, durationDays, rules, alarms };
}

/**
 * 导入只新增或覆盖本人的事件，不删除任何现有数据。
 * 同 ID 属于本人时作为修改；ID 已被其他账号占用时分配新 ID，不能借导入改写他人数据。
 */
export function importBackup(repo: OpenedRepository, ownerId: string, file: BackupFile, now: number) {
  const inputs = file.events.map((item, index) => ({
    id: item.id,
    input: parseEventInput(item.event, `events.${index}.event.`),
  }));
  return repo.transaction(() => {
    let created = 0;
    let updated = 0;
    for (const { id, input } of inputs) {
      const existing = repo.events.getEvent(ownerId, id);
      if (existing) {
        repo.events.putEvent(reviseEvent(existing, input, now));
        updated += 1;
      } else {
        createEvent(repo, ownerId, input, now, repo.events.eventIdTaken(id) ? randomUUID() : id);
        created += 1;
      }
    }

    return { created, updated };
  });
}
