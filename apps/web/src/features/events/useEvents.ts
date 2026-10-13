import type { CalendarEvent, EventInput, EventPageQuery, PageResult } from "@timenote/contracts";

import { apiPath } from "../../api/apiPath.js";
import { api } from "../../api/client.js";
import { useApiResource } from "../../api/useApiResource.js";

export type EventListQuery = Omit<EventPageQuery, "ids">;

export function useEvents(query: Partial<EventListQuery>) {
  const resource = useApiResource<PageResult<CalendarEvent>>(apiPath("/events", query));
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
