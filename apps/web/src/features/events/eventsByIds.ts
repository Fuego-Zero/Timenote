import { type CalendarEvent, maxPageSize, type PageResult } from "@timenote/contracts";

import { api } from "../../api/client.js";

export type FetchEventsPage = (query: string) => Promise<PageResult<CalendarEvent>>;

/** 按接口的 ids 上限切批。 */
export function chunkIds(ids: readonly string[], size = maxPageSize) {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }

  return chunks;
}

/**
 * 按 id 取本人事件：GET /api/events 的 ids 每次最多 100 个，超过时切批并行请求后合并。
 * 结果按传入顺序排列，去重；已不存在的 id 不出现在结果里。
 */
export async function fetchEventsByIds(
  ids: readonly string[],
  fetchPage: FetchEventsPage = query => api<PageResult<CalendarEvent>>(`/events?${query}`)
) {
  const unique = [...new Set(ids)];
  const pages = await Promise.all(
    chunkIds(unique).map(chunk =>
      fetchPage(new URLSearchParams({ ids: chunk.join(","), pageSize: String(maxPageSize) }).toString())
    )
  );
  const byId = new Map(pages.flatMap(page => page.items).map(event => [event.id, event]));
  return unique.flatMap(id => {
    const event = byId.get(id);
    return event ? [event] : [];
  });
}
