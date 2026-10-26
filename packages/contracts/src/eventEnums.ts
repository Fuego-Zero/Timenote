export const calendarSystems = ["gregorian", "lunar"] as const;
export const feb29Policies = ["feb28", "mar1", "skip"] as const;
export const leapMonthPolicies = ["regular", "skip"] as const;
export const missingDayPolicies = ["lastDay", "skip"] as const;
/** 公历按月重复时当月没有原始日：lastDay 落到月末，skip 跳过本次。与农历的 missingDay 互不影响。 */
export const gregorianMissingDayPolicies = ["lastDay", "skip"] as const;

export type CalendarSystem = (typeof calendarSystems)[number];

/** 预设标识只作保存和筛选，服务端不解释其含义。 */
export const maxKindLength = 32;

export const maxAlarms = 2;
export const maxDurationDays = 366;

export const recurrenceUnits = ["day", "week", "month", "year"] as const;
export type RecurrenceUnit = (typeof recurrenceUnits)[number];
export const recurrenceEndTypes = ["never", "count", "until"] as const;

/** 各单位允许的最大间隔。 */
export const maxInterval: Record<RecurrenceUnit, number> = { day: 999, week: 99, month: 99, year: 99 };
/** 「共 N 个周期」的上限。 */
export const maxRecurrenceCount = 999;
export const maxMilestones = 20;
export const maxMilestoneDays = 36500;
/** 订阅里非按年重复的事件，每个事件最多输出的过去与未来次数。 */
export const maxPastOccurrences = 12;
export const maxFutureOccurrences = 60;
/** 总量估算：每个非按年重复事件计 extraBoundPerEvent，每个里程碑计 1；每用户合计不超过 maxExtraFeedOccurrences。 */
export const extraBoundPerEvent = maxPastOccurrences + maxFutureOccurrences;
export const maxExtraFeedOccurrences = 15000;
/** 各单位一个周期的最短天数；持续天数与提醒提前天数受它限制，避免相邻两次重叠。 */
export const minCycleDays: Record<RecurrenceUnit, number> = { day: 1, week: 7, month: 28, year: 365 };
