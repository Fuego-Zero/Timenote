import type { FeedToken } from "@timenote/contracts";

export type GuideSegment = "event" | "feed";

/** 「开始使用」清单的显示状态；未记录表示这个浏览器还没为该账号决定过。 */
export type ChecklistState = "active" | "dismissed";

/** 上手进度全部来自服务端数据，不记录「点过哪个按钮」。 */
export interface GuideProgress {
  eventCount: number;
  feedCount: number;
  /** 至少一个订阅地址被日历客户端拉取过（服务端在拉取时写入 lastFetchedAt）。 */
  fetched: boolean;
}

export function progressFrom(
  eventTotal: number,
  feeds: { items: readonly Pick<FeedToken, "lastFetchedAt">[]; total: number }
): GuideProgress {
  return {
    eventCount: eventTotal,
    feedCount: feeds.total,
    fetched: feeds.items.some(feed => feed.lastFetchedAt !== null),
  };
}

export function progressDone(progress: GuideProgress) {
  return progress.eventCount > 0 && progress.feedCount > 0 && progress.fetched;
}

/**
 * 没有记录时，只有账号还没有任何事件才自动开启清单；已有数据的账号（例如老用户换了浏览器）不自动打扰，
 * 需要时从「帮助」重新打开。
 */
export function initialChecklistState(
  stored: ChecklistState | undefined,
  progress: GuideProgress
): ChecklistState | undefined {
  return stored ?? (progress.eventCount === 0 ? "active" : undefined);
}

const storagePrefix = "timenote.guide.";
const autoTourPrefix = "timenote.guide.auto.";

function storageKey(userId: string) {
  return `${storagePrefix}${userId}`;
}

export function readChecklistState(userId: string): ChecklistState | undefined {
  try {
    const value = localStorage.getItem(storageKey(userId));
    return value === "active" || value === "dismissed" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function writeChecklistState(userId: string, state: ChecklistState) {
  try {
    localStorage.setItem(storageKey(userId), state);
  } catch {
    // 隐私模式等写失败时只在本次会话内生效，刷新后按「未记录」重新判断。
  }
}

/** 新用户自动引导是否已经开始过。开始即记为完成，刷新或再次登录不会再自动开始。 */
export function readAutoTourDone(userId: string) {
  try {
    return localStorage.getItem(`${autoTourPrefix}${userId}`) === "done";
  } catch {
    return false;
  }
}

export function writeAutoTourDone(userId: string) {
  try {
    localStorage.setItem(`${autoTourPrefix}${userId}`, "done");
  } catch {
    // 写失败时本次会话内不再重试；刷新后会再自动开始一次。
  }
}
