import { z } from "zod";

import { calendarSystems, eventKinds } from "./eventEnums.js";
import { maxPageSize, pageQuerySchema } from "./pagination.js";

export {
  type CalendarSystem,
  calendarSystems,
  type EventKind,
  eventKinds,
  feb29Policies,
  leapMonthPolicies,
  maxAlarms,
  maxDurationDays,
  missingDayPolicies,
} from "./eventEnums.js";
export { defaultTitleTemplates, templateIssue, templateVariables } from "./titleTemplate.js";
export {
  alarmSchema,
  type CalendarEvent,
  type EventInput,
  eventInputSchema,
  eventRulesSchema,
  eventSchema,
  originalDateSchema,
} from "./eventSchema.js";

export const eventSorts = ["createdAt", "nextOccurrence"] as const;
export type EventSort = (typeof eventSorts)[number];

/** 事件列表查询；各筛选条件与 ids 之间为 AND。ids 为逗号分隔的 uuid。 */
export const eventPageQuerySchema = pageQuerySchema.extend({
  sort: z.enum(eventSorts).default("createdAt"),
  kind: z.enum(eventKinds).optional(),
  calendar: z.enum(calendarSystems).optional(),
  hasAlarm: z
    .enum(["true", "false"])
    .transform(value => value === "true")
    .optional(),
  nextWithinDays: z.coerce.number().int().min(1).max(366).optional(),
  ids: z
    .string()
    .transform(value =>
      value
        .split(",")
        .map(id => id.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.uuid()).min(1).max(maxPageSize))
    .optional(),
});
export type EventPageQuery = z.infer<typeof eventPageQuerySchema>;
