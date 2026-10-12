import { createHash, randomUUID } from "node:crypto";

import { buildFeed, CalendarRangeError, feedWindow } from "@timenote/calendar";
import type { CreateFeedTokenInput, FeedEventScope, FeedToken, UpdateFeedTokenInput } from "@timenote/contracts";
import {
  BusinessError,
  type Config,
  hashToken,
  opaqueToken,
  type Repository,
  type StoredFeedToken,
} from "@timenote/runtime";

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
export function assertOwnedEventIds(repo: Repository, ownerId: string, eventIds: string[]) {
  if (eventIds.length === 0) {
    return;
  }

  const owned = new Set(repo.listEvents(ownerId).map(event => event.id));
  const foreign = eventIds.filter(id => !owned.has(id));
  if (foreign.length > 0) {
    throw new BusinessError("INVALID_INPUT", { message: "所选事件不属于当前账号" });
  }
}

function resolveScopeInput(
  repo: Repository,
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
export function eventsForFeed(repo: Repository, ownerId: string, feed: StoredFeedToken) {
  const { eventScope, eventIds } = normalizeFeedScope(feed);
  if (eventScope === "all") {
    return repo.listEvents(ownerId);
  }

  const wanted = new Set(eventIds);
  return repo.listEvents(ownerId).filter(event => wanted.has(event.id));
}

export function toFeedToken(config: Config, feed: StoredFeedToken): FeedToken {
  const url = feed.token ? `${config.webOrigin}/api/feeds/${feed.token}.ics` : null;
  const scope = normalizeFeedScope(feed);
  return {
    id: feed.id,
    name: feed.name,
    url,
    webcalUrl: url ? url.replace(/^https?:/, "webcal:") : null,
    createdAt: feed.createdAt,
    rotatedAt: feed.rotatedAt,
    eventScope: scope.eventScope,
    eventIds: scope.eventIds,
  };
}

export function createFeedToken(
  repo: Repository,
  config: Config,
  ownerId: string,
  input: CreateFeedTokenInput,
  now: number
) {
  const token = opaqueToken();
  const scope = resolveScopeInput(repo, ownerId, input.eventScope, input.eventIds);
  const feed: StoredFeedToken = {
    id: randomUUID(),
    ownerId,
    name: input.name,
    token,
    tokenHash: hashToken(token),
    createdAt: now,
    rotatedAt: now,
    ...scope,
  };
  repo.transaction(() => {
    if (repo.listFeedTokens(ownerId).length >= maxFeedTokensPerUser) {
      throw new BusinessError("INVALID_INPUT", { message: `每个账号最多 ${maxFeedTokensPerUser} 个订阅地址` });
    }

    repo.putFeedToken(feed);
  });
  return { feed: toFeedToken(config, feed) };
}

/** 更新名称与/或事件范围；未传的字段保持原值。 */
export function updateFeedToken(
  repo: Repository,
  config: Config,
  ownerId: string,
  id: string,
  input: UpdateFeedTokenInput
) {
  const feed = repo.transaction(() => {
    const existing = repo.getFeedToken(ownerId, id);
    if (!existing) {
      throw new BusinessError("NOT_FOUND");
    }

    const current = normalizeFeedScope(existing);
    const nextScope = input.eventScope ?? current.eventScope;
    const nextIds = input.eventIds ?? (nextScope === "selected" ? current.eventIds : []);
    const scope = resolveScopeInput(repo, ownerId, nextScope, nextIds);
    const next: StoredFeedToken = {
      ...existing,
      name: input.name ?? existing.name,
      ...scope,
    };
    // all 时去掉 eventIds，避免把 [] 存成「未配置」混淆
    if (scope.eventScope === "all") {
      delete next.eventIds;
    }

    repo.putFeedToken(next);
    return next;
  });
  return { feed: toFeedToken(config, feed) };
}

/** 轮换后旧地址立即失效，返回 404；名称与 ID 保持不变。 */
export function rotateFeedToken(repo: Repository, config: Config, ownerId: string, id: string, now: number) {
  const token = opaqueToken();
  const feed = repo.transaction(() => {
    const existing = repo.getFeedToken(ownerId, id);
    if (!existing) {
      throw new BusinessError("NOT_FOUND");
    }

    const next = { ...existing, token, tokenHash: hashToken(token), rotatedAt: now };
    repo.putFeedToken(next);
    return next;
  });
  return { feed: toFeedToken(config, feed) };
}

export interface RenderedFeed {
  body: string;
  etag: string;
}

/** 解析订阅 token 到归属账号并生成内容；token 无效、已撤销或账号停用时统一返回 undefined（404）。 */
export function renderFeedForToken(
  repo: Repository,
  config: Config,
  token: string,
  now: number
): RenderedFeed | undefined {
  const feed = repo.getFeedTokenByHash(hashToken(token));
  if (!feed) {
    return undefined;
  }

  const owner = repo.getUser(feed.ownerId);
  if (!owner || owner.disabled) {
    return undefined;
  }

  let body: string;
  try {
    body = buildFeed({
      calendarName: `${owner.displayName || owner.username}的纪念日`,
      timeZone: owner.timeZone,
      window: feedWindow(new Date(now), owner.timeZone, config.feedPastYears, config.feedFutureYears),
      events: eventsForFeed(repo, owner.id, feed),
    });
  } catch (error) {
    if (error instanceof CalendarRangeError) {
      throw new BusinessError("CALENDAR_RANGE", { message: error.message });
    }

    throw error;
  }

  return { body, etag: `"${createHash("sha256").update(body).digest("base64url")}"` };
}
