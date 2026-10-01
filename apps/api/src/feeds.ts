import { createHash, randomUUID } from "node:crypto";

import { buildFeed, CalendarRangeError, feedWindow } from "@timenote/calendar";
import type { FeedToken, IssuedFeed } from "@timenote/contracts";
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

export function toFeedToken(feed: StoredFeedToken): FeedToken {
  return {
    id: feed.id,
    name: feed.name,
    tokenHint: feed.tokenHint,
    createdAt: feed.createdAt,
    rotatedAt: feed.rotatedAt,
  };
}

function issued(config: Config, feed: StoredFeedToken, token: string): IssuedFeed {
  const url = `${config.webOrigin}/api/feeds/${token}.ics`;
  return { feed: toFeedToken(feed), url, webcalUrl: url.replace(/^https?:/, "webcal:") };
}

export function createFeedToken(repo: Repository, config: Config, ownerId: string, name: string, now: number) {
  const token = opaqueToken();
  const feed: StoredFeedToken = {
    id: randomUUID(),
    ownerId,
    name,
    tokenHint: token.slice(0, 4),
    tokenHash: hashToken(token),
    createdAt: now,
    rotatedAt: now,
  };
  repo.transaction(() => {
    if (repo.listFeedTokens(ownerId).length >= maxFeedTokensPerUser) {
      throw new BusinessError("INVALID_INPUT", { message: `每个账号最多 ${maxFeedTokensPerUser} 个订阅地址` });
    }

    repo.putFeedToken(feed);
  });
  return issued(config, feed, token);
}

/** 轮换后旧地址立即失效（返回 404），名称与 ID 保持不变。 */
export function rotateFeedToken(repo: Repository, config: Config, ownerId: string, id: string, now: number) {
  const token = opaqueToken();
  const feed = repo.transaction(() => {
    const existing = repo.getFeedToken(ownerId, id);
    if (!existing) {
      throw new BusinessError("NOT_FOUND");
    }

    const next = { ...existing, tokenHint: token.slice(0, 4), tokenHash: hashToken(token), rotatedAt: now };
    repo.putFeedToken(next);
    return next;
  });
  return issued(config, feed, token);
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
      events: repo.listEvents(owner.id),
    });
  } catch (error) {
    if (error instanceof CalendarRangeError) {
      throw new BusinessError("CALENDAR_RANGE", { message: error.message });
    }

    throw error;
  }

  return { body, etag: `"${createHash("sha256").update(body).digest("base64url")}"` };
}
