import type { CalendarEvent, EventInput, EventPageQuery, PageResult } from "@timenote/contracts";

import { api } from "../../api/client.js";
import { useApiResource } from "../../api/useApiResource.js";

export type EventListQuery = Omit<EventPageQuery, "ids">;

/** 把列表查询转成 GET /api/events 的查询串，未设置的参数省略。 */
export function eventsPath(query: Partial<EventListQuery>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const text = params.toString();
  return text ? `/events?${text}` : "/events";
}

export function useEvents(query: Partial<EventListQuery>) {
  const resource = useApiResource<PageResult<CalendarEvent>>(eventsPath(query));
  return {
    page: resource.data,
    error: resource.error,
    reload: resource.reload,
    async save(input: EventInput, id?: string) {
      await (id ? api(`/events/${id}`, "PUT", input) : api("/events", "POST", input));
      resource.reload();
    },
    /** 只删除，不刷新：由调用方决定刷新当前页还是退回上一页。 */
    async remove(id: string) {
      await api(`/events/${id}`, "DELETE");
    },
  };
}
