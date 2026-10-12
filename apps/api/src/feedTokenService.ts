import { randomUUID } from "node:crypto";

import type { CreateFeedTokenInput, FeedToken, UpdateFeedTokenInput } from "@timenote/contracts";
import {
  BusinessError,
  type Config,
  hashToken,
  opaqueToken,
  type OpenedRepository,
  type StoredFeedToken,
} from "@timenote/runtime";

import { maxFeedTokensPerUser, normalizeFeedScope, resolveScopeInput } from "./feedScope.js";

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
  repo: OpenedRepository,
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
    if (repo.feedTokens.listFeedTokens(ownerId).length >= maxFeedTokensPerUser) {
      throw new BusinessError("INVALID_INPUT", { message: `每个账号最多 ${maxFeedTokensPerUser} 个订阅地址` });
    }

    repo.feedTokens.putFeedToken(feed);
  });
  return { feed: toFeedToken(config, feed) };
}

/** 更新名称与/或事件范围；未传的字段保持原值。 */
export function updateFeedToken(
  repo: OpenedRepository,
  config: Config,
  ownerId: string,
  id: string,
  input: UpdateFeedTokenInput
) {
  const feed = repo.transaction(() => {
    const existing = repo.feedTokens.getFeedToken(ownerId, id);
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

    repo.feedTokens.putFeedToken(next);
    return next;
  });
  return { feed: toFeedToken(config, feed) };
}

/** 轮换后旧地址立即失效，返回 404；名称与 ID 保持不变。 */
export function rotateFeedToken(repo: OpenedRepository, config: Config, ownerId: string, id: string, now: number) {
  const token = opaqueToken();
  const feed = repo.transaction(() => {
    const existing = repo.feedTokens.getFeedToken(ownerId, id);
    if (!existing) {
      throw new BusinessError("NOT_FOUND");
    }

    const next = { ...existing, token, tokenHash: hashToken(token), rotatedAt: now };
    repo.feedTokens.putFeedToken(next);
    return next;
  });
  return { feed: toFeedToken(config, feed) };
}
