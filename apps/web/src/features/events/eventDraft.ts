import { eventDateIssues } from "@timenote/calendar";
import { type CalendarEvent, type EventInput, eventInputSchema } from "@timenote/contracts";

import { i18n } from "../../i18n/index.js";
import { translateDetail } from "../../i18n/translateMessage.js";

export {
  applyPreset,
  displayedPresetId,
  draftForSave,
  kindLabel,
  kindLabels,
  kindTone,
  newDraft,
  normalizeRecurrence,
  type PresetId,
  presetIds,
  presetMatches,
  presetViews,
  type SwitchChange,
  switchChanges,
  withKind,
  withRecurrence,
  withYear,
  yearlyRecurrence,
} from "./eventPresets.js";

export function draftFromEvent(event: CalendarEvent): EventInput {
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

/** 与服务端同一套校验：契约 Schema + 日历库校验，返回字段路径到提示。 */
export function draftIssues(draft: EventInput): Record<string, string> {
  const parsed = eventInputSchema.safeParse(draft);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".")] ??= translateDetail(issue.message);
    }

    return fields;
  }

  try {
    return Object.fromEntries(
      Object.entries(eventDateIssues(parsed.data)).map(([path, message]) => [path, translateDetail(message)])
    );
  } catch (error) {
    return {
      "date.year":
        error instanceof Error ? translateDetail(error.message) : i18n.t("draft.dateOutOfRange", { ns: "events" }),
    };
  }
}
