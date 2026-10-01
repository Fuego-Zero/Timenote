import { randomUUID } from "node:crypto";

import { CalendarRangeError, eventDateIssues } from "@timenote/calendar";
import { type BackupFile, type CalendarEvent, type EventInput, eventInputSchema } from "@timenote/contracts";
import { BusinessError, type Repository } from "@timenote/runtime";

/** 契约校验 + 日历库校验；字段错误统一用 INVALID_INPUT 返回，路径与表单字段一致。 */
export function parseEventInput(body: unknown, fieldPrefix = ""): EventInput {
  const parsed = eventInputSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[`${fieldPrefix}${issue.path.join(".")}`] ??= issue.message;
    }

    throw new BusinessError("INVALID_INPUT", { fields });
  }

  let issues: Record<string, string>;
  try {
    issues = eventDateIssues(parsed.data);
  } catch (error) {
    if (error instanceof CalendarRangeError) {
      throw new BusinessError("CALENDAR_RANGE", { message: error.message });
    }

    throw error;
  }

  if (Object.keys(issues).length) {
    const fields = Object.fromEntries(
      Object.entries(issues).map(([path, message]) => [`${fieldPrefix}${path}`, message])
    );
    throw new BusinessError("INVALID_INPUT", { fields });
  }

  return parsed.data;
}

export function createEvent(
  repo: Repository,
  ownerId: string,
  input: EventInput,
  now: number,
  id: string = randomUUID()
) {
  const event: CalendarEvent = { ...input, id, ownerId, revision: 0, createdAt: now, updatedAt: now };
  repo.putEvent(event);
  return event;
}

/** 修改只替换可编辑内容；ID、归属和创建时间不变，revision 递增供订阅识别更新。 */
function revise(existing: CalendarEvent, input: EventInput, now: number): CalendarEvent {
  return {
    ...input,
    id: existing.id,
    ownerId: existing.ownerId,
    createdAt: existing.createdAt,
    revision: existing.revision + 1,
    updatedAt: Math.max(now, existing.updatedAt + 1),
  };
}

export function updateEvent(repo: Repository, ownerId: string, id: string, input: EventInput, now: number) {
  return repo.transaction(() => {
    const existing = repo.getEvent(ownerId, id);
    if (!existing) {
      throw new BusinessError("NOT_FOUND");
    }

    const next = revise(existing, input, now);
    repo.putEvent(next);
    return next;
  });
}

export function exportBackup(repo: Repository, ownerId: string, now: number): BackupFile {
  return {
    format: "timenote-backup",
    version: 1,
    exportedAt: new Date(now).toISOString(),
    events: repo.listEvents(ownerId).map(event => ({ id: event.id, event: editableFields(event) })),
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
export function importBackup(repo: Repository, ownerId: string, file: BackupFile, now: number) {
  const inputs = file.events.map((item, index) => ({
    id: item.id,
    input: parseEventInput(item.event, `events.${index}.event.`),
  }));
  return repo.transaction(() => {
    let created = 0;
    let updated = 0;
    for (const { id, input } of inputs) {
      const existing = repo.getEvent(ownerId, id);
      if (existing) {
        repo.putEvent(revise(existing, input, now));
        updated += 1;
      } else {
        createEvent(repo, ownerId, input, now, repo.eventIdTaken(id) ? randomUUID() : id);
        created += 1;
      }
    }

    return { created, updated };
  });
}
