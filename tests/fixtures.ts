import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";

import type { CalendarEvent, EventInput } from "../packages/contracts/src/index.js";

type InputOverrides = Omit<Partial<EventInput>, "date" | "rules"> & {
  date?: Partial<EventInput["date"]>;
  rules?: Partial<EventInput["rules"]>;
};

export function eventInput(overrides: InputOverrides = {}): EventInput {
  const { date, rules, ...rest } = overrides;
  return {
    kind: "birthday",
    name: "小明",
    titleTemplate: "{{name}} {{years}} 岁生日",
    titlePrefix: "",
    note: "",
    durationDays: 1,
    alarms: [],
    ...rest,
    date: { calendar: "gregorian", year: 1990, month: 5, day: 20, leapMonth: false, ...date },
    rules: { feb29: "feb28", leapMonth: "regular", missingDay: "lastDay", ...rules },
  };
}

export function calendarEvent(overrides: InputOverrides & Partial<Omit<CalendarEvent, keyof EventInput>> = {}) {
  const { id, ownerId, revision, createdAt, updatedAt, ...input } = overrides;
  const event: CalendarEvent = {
    ...eventInput(input),
    id: id ?? "11111111-1111-4111-8111-111111111111",
    ownerId: ownerId ?? "owner",
    revision: revision ?? 0,
    createdAt: createdAt ?? Date.UTC(2026, 0, 1),
    updatedAt: updatedAt ?? Date.UTC(2026, 0, 1, 8, 30, 15, 789),
  };
  return event;
}

export async function temporaryDirectory(prefix: string) {
  const root = join(process.cwd(), ".tmp", "tests");
  await mkdir(root, { recursive: true });
  return mkdtemp(join(root, prefix));
}
