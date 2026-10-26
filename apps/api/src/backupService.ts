import { randomUUID } from "node:crypto";

import { type BackupFile, type CalendarEvent, type EventInput, exceedsRecurrenceLimit } from "@timenote/contracts";
import { BusinessError, type OpenedRepository } from "@timenote/runtime";

import { assertRecurrenceLimit, createEvent, reviseEvent } from "./eventService.js";
import { parseEventInput } from "./parseEventInput.js";

export function exportBackup(repo: OpenedRepository, ownerId: string, now: number): BackupFile {
  return {
    format: "timenote-backup",
    version: 3,
    exportedAt: new Date(now).toISOString(),
    events: repo.events.listEvents(ownerId).map(event => ({ id: event.id, event: editableFields(event) })),
  };
}

function editableFields(event: CalendarEvent): EventInput {
  const {
    kind,
    name,
    titleTemplate,
    titlePrefix,
    note,
    date,
    durationDays,
    rules,
    alarms,
    recurrence,
    gregorianMissingDay,
    milestones,
    milestoneTemplate,
  } = event;
  return {
    kind,
    name,
    titleTemplate,
    titlePrefix,
    note,
    date,
    durationDays,
    rules,
    alarms,
    recurrence,
    gregorianMissingDay,
    milestones,
    milestoneTemplate,
  };
}

interface ImportItem {
  id: string;
  input: EventInput;
}

/** 导入步骤：update 覆盖本人同 ID 事件；create 时 id 为 null 表示原 ID 已被其他账号占用，导入时分配新 ID。 */
export type ImportStep =
  { action: "create"; id: string | null; input: EventInput } | { action: "update"; id: string; input: EventInput };

export interface ImportLookup {
  /** 该 ID 是否已被任何账号占用。 */
  eventIdTaken(id: string): boolean;
  /** 该 ID 是否已是本人的事件。 */
  ownsEvent(id: string): boolean;
}

/**
 * 纯函数：按现有数据决定每条是新增、覆盖还是换 ID，不写库；预览与实际导入共用。
 * 同一文件里重复的 ID：第一条按原 ID 新增后，后续同 ID 视为覆盖，与逐条写入的结果一致。
 */
export function planImport(items: ImportItem[], lookup: ImportLookup) {
  const createdHere = new Set<string>();
  const steps = items.map(({ id, input }): ImportStep => {
    if (createdHere.has(id) || lookup.ownsEvent(id)) {
      return { action: "update", id, input };
    }

    if (lookup.eventIdTaken(id)) {
      return { action: "create", id: null, input };
    }

    createdHere.add(id);
    return { action: "create", id, input };
  });
  const created = steps.filter(step => step.action === "create").length;
  return { steps, created, updated: steps.length - created };
}

function parseItems(file: BackupFile): ImportItem[] {
  return file.events.map((item, index) => ({
    id: item.id,
    input: parseEventInput(item.event, `events.${index}.event.`),
  }));
}

function lookupFor(repo: OpenedRepository, ownerId: string): ImportLookup {
  return {
    ownsEvent: id => Boolean(repo.events.getEvent(ownerId, id)),
    eventIdTaken: id => repo.events.eventIdTaken(id),
  };
}

/** 导入预览：只读，返回将新增与覆盖的条数。 */
export function previewImport(repo: OpenedRepository, ownerId: string, file: BackupFile) {
  const { steps, created, updated } = planImport(parseItems(file), lookupFor(repo, ownerId));
  // 与实际导入同口径：覆盖的事件按导入内容计，其余现有事件照常计入。
  const replaced = new Set(steps.flatMap(step => (step.action === "update" ? [step.id] : [])));
  const kept = repo.events.listEvents(ownerId).filter(event => !replaced.has(event.id));
  if (exceedsRecurrenceLimit([...kept, ...steps.map(step => step.input)])) {
    throw new BusinessError("RECURRENCE_LIMIT");
  }

  return { created, updated };
}

/**
 * 导入只新增或覆盖本人的事件，不删除任何现有数据。
 * 同 ID 属于本人时作为修改；ID 已被其他账号占用时分配新 ID，不能借导入改写他人数据。
 */
export function importBackup(repo: OpenedRepository, ownerId: string, file: BackupFile, now: number) {
  const items = parseItems(file);
  return repo.transaction(() => {
    const plan = planImport(items, lookupFor(repo, ownerId));
    for (const step of plan.steps) {
      if (step.action === "update") {
        repo.events.putEvent(reviseEvent(repo.events.getEvent(ownerId, step.id)!, step.input, now));
      } else {
        createEvent(repo, ownerId, step.input, now, step.id ?? randomUUID());
      }
    }

    // 超出总量上限时整份拒绝，事务回滚，不导入任何一条。
    assertRecurrenceLimit(repo, ownerId);
    return { created: plan.created, updated: plan.updated };
  });
}
