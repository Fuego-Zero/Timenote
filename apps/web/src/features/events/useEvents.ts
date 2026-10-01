import type { CalendarEvent, EventInput } from "@timenote/contracts";

import { api } from "../../api/client.js";
import { useApiResource } from "../../api/useApiResource.js";

export function useEvents() {
  const resource = useApiResource<{ events: CalendarEvent[] }>("/events");
  return {
    events: resource.data?.events,
    error: resource.error,
    async save(input: EventInput, id?: string) {
      await (id ? api(`/events/${id}`, "PUT", input) : api("/events", "POST", input));
      resource.reload();
    },
    async remove(id: string) {
      await api(`/events/${id}`, "DELETE");
      resource.reload();
    },
  };
}
