import { z } from "zod";

import { calendarSystems, eventKinds } from "./eventEnums.js";
import { maxPageSize, pageQuerySchema } from "./pagination.js";

export {
  type CalendarSystem,
  calendarSystems,
  type EventKind,
  eventKinds,
  extraBoundPerEvent,
  feb29Policies,
  gregorianMissingDayPolicies,
  leapMonthPolicies,
  maxAlarms,
  maxDurationDays,
  maxExtraFeedOccurrences,
  maxFutureOccurrences,
  maxInterval,
  maxMilestoneDays,
  maxMilestones,
  maxPastOccurrences,
  maxRecurrenceCount,
  minCycleDays,
  missingDayPolicies,
  recurrenceEndTypes,
  type RecurrenceUnit,
  recurrenceUnits,
} from "./eventEnums.js";
export {
  defaultMilestoneTemplate,
  defaultRecurrenceTemplates,
  defaultTitleTemplates,
  templateIssue,
  type TemplateVariable,
  templateVariables,
  usedVariables,
} from "./titleTemplate.js";
export {
  alarmSchema,
  type CalendarEvent,
  type EventInput,
  eventInputSchema,
  eventRulesSchema,
  eventSchema,
  isYearlyEveryYear,
  milestoneVariables,
  originalDateSchema,
  type Recurrence,
  recurrenceEndSchema,
  recurrenceSchema,
  titleVariables,
} from "./eventSchema.js";

export { exceedsRecurrenceLimit, recurrenceBound } from "./recurrenceBound.js";

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
