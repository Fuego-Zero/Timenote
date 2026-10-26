import { extraBoundPerEvent, maxExtraFeedOccurrences } from "./eventEnums.js";
import type { EventInput } from "./eventSchema.js";

/** 单个事件在订阅里额外条目的上界：非按年重复计 extraBoundPerEvent，每个里程碑计 1。只发生一次与按年相同。 */
export function recurrenceBound(event: Pick<EventInput, "milestones" | "recurrence">) {
  const yearly = event.recurrence === null || event.recurrence.unit === "year";
  return (yearly ? 0 : extraBoundPerEvent) + event.milestones.length;
}

/** 每个用户全部事件的上界合计不能超过 maxExtraFeedOccurrences；保存和导入时检查。 */
export function exceedsRecurrenceLimit(events: readonly Pick<EventInput, "milestones" | "recurrence">[]) {
  return events.reduce((sum, event) => sum + recurrenceBound(event), 0) > maxExtraFeedOccurrences;
}
