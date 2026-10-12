import { createHash } from "node:crypto";

import { buildFeed, CalendarRangeError, feedWindow } from "@timenote/calendar";
import { BusinessError, type Config, hashToken, type OpenedRepository } from "@timenote/runtime";

import { eventsForFeed } from "./feedScope.js";

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
