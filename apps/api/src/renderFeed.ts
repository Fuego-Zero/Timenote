import { createHash } from "node:crypto";

import { buildFeed, CalendarRangeError, feedWindow, LUNAR_MAX_YEAR, LUNAR_MIN_YEAR, todayIn } from "@timenote/calendar";
import { BusinessError, type Config, hashToken, type OpenedRepository, type StoredFeedToken } from "@timenote/runtime";

import { eventsForFeed } from "./feedScope.js";

/** 记录最近拉取时间的最小间隔，避免客户端频繁轮询时每次写库。 */
export const fetchRecordIntervalMs = 60 * 60 * 1000;

export interface RenderedFeed {
  body: string;
  etag: string;
}

/** 解析订阅 token 到归属账号并生成内容；token 无效、已撤销或账号停用时统一返回 undefined（404）。 */
export function renderFeedForToken(
  repo: OpenedRepository,
  config: Config,
  token: string,
  now: number
): RenderedFeed | undefined {
  const feed = repo.feedTokens.getFeedTokenByHash(hashToken(token));
  if (!feed) {
    return undefined;
  }

  const owner = repo.users.getUser(feed.ownerId);
  if (!owner || owner.disabled) {
    return undefined;
  }

  let body: string;
  try {
    body = buildFeed({
      // 优先自定义 calendarName；禁止用 feed.name（设备备注）。空/缺省回退默认拼装。
      calendarName: feed.calendarName?.trim()
        ? feed.calendarName.trim()
        : `${owner.displayName || owner.username}的纪念日`,
      timeZone: owner.timeZone,
      window: feedWindow(new Date(now), owner.timeZone, config.feedPastYears, config.feedFutureYears),
      today: todayIn(new Date(now), owner.timeZone),
      events: eventsForFeed(repo, owner.id, feed),
    });
  } catch (error) {
    if (error instanceof CalendarRangeError) {
      throw new BusinessError("CALENDAR_RANGE", {
        detail: "lunar_range",
        params: { year: error.year, min: LUNAR_MIN_YEAR, max: LUNAR_MAX_YEAR },
      });
    }

    throw error;
  }

  recordFetch(repo, feed, now);
  return { body, etag: `"${createHash("sha256").update(body).digest("base64url")}"` };
}

/** 渲染成功（之后无论返回 200 还是 304）都算一次拉取；同一 token 在事务内重读后写入，避免覆盖并发修改。 */
function recordFetch(repo: OpenedRepository, feed: StoredFeedToken, now: number) {
  if (feed.lastFetchedAt !== undefined && now - feed.lastFetchedAt < fetchRecordIntervalMs) {
    return;
  }

  repo.transaction(() => {
    const current = repo.feedTokens.getFeedToken(feed.ownerId, feed.id);
    if (current?.tokenHash === feed.tokenHash) {
      repo.feedTokens.putFeedToken({ ...current, lastFetchedAt: now });
    }
  });
}
