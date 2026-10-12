import type { FeedEventScope } from "@timenote/contracts";
import { BusinessError, type OpenedRepository, type StoredFeedToken } from "@timenote/runtime";

export const maxFeedTokensPerUser = 10;
export const feedTokenPattern = /^([A-Za-z0-9_-]{43})\.ics$/;

/** 缺字段/null → all；selected + [] 保持空订阅，绝不回退 all。 */
export function normalizeFeedScope(feed: StoredFeedToken): { eventScope: FeedEventScope; eventIds: string[] } {
  if (feed.eventScope === "selected") {
    return { eventScope: "selected", eventIds: feed.eventIds ?? [] };
  }

  return { eventScope: "all", eventIds: [] };
}

function scopeForStore(eventScope: FeedEventScope, eventIds: string[]): Pick<StoredFeedToken, "eventScope" | "eventIds"> {
  if (eventScope === "selected") {
    return { eventScope: "selected", eventIds };
  }

  return { eventScope: "all" };
}

/** 写入时校验 eventIds 均属当前账号；非本账号拒绝（400）。 */
export function assertOwnedEventIds(repo: OpenedRepository, ownerId: string, eventIds: string[]) {
  if (eventIds.length === 0) {
    return;
  }

  const owned = new Set(repo.events.listEvents(ownerId).map(event => event.id));
  const foreign = eventIds.filter(id => !owned.has(id));
  if (foreign.length > 0) {
    throw new BusinessError("INVALID_INPUT", { message: "所选事件不属于当前账号" });
  }
}

export function resolveScopeInput(
  repo: OpenedRepository,
  ownerId: string,
  eventScope: FeedEventScope,
  eventIds: string[]
): Pick<StoredFeedToken, "eventScope" | "eventIds"> {
  if (eventScope === "selected") {
    assertOwnedEventIds(repo, ownerId, eventIds);
    return scopeForStore("selected", eventIds);
  }

  return scopeForStore("all", []);
}

/** all=账号全部；selected=仅所选且跳过已删；[]=空日历，不回退 all。 */
export function eventsForFeed(repo: OpenedRepository, ownerId: string, feed: StoredFeedToken) {
  const { eventScope, eventIds } = normalizeFeedScope(feed);
  if (eventScope === "all") {
    return repo.events.listEvents(ownerId);
  }

  const wanted = new Set(eventIds);
  return repo.events.listEvents(ownerId).filter(event => wanted.has(event.id));
}
