export const eventKinds = ["birthday", "anniversary", "event"] as const;
export const calendarSystems = ["gregorian", "lunar"] as const;
export const feb29Policies = ["feb28", "mar1", "skip"] as const;
export const leapMonthPolicies = ["regular", "skip"] as const;
export const missingDayPolicies = ["lastDay", "skip"] as const;

export type EventKind = (typeof eventKinds)[number];
export type CalendarSystem = (typeof calendarSystems)[number];

export const maxAlarms = 2;
export const maxDurationDays = 366;
