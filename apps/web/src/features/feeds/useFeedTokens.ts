import type { FeedToken, IssuedFeed } from "@timenote/contracts";

import { api } from "../../api/client.js";
import { useApiResource } from "../../api/useApiResource.js";

export function useFeedTokens() {
  const resource = useApiResource<{ feeds: FeedToken[] }>("/feed-tokens");
  return {
    feeds: resource.data?.feeds,
    error: resource.error,
    async create(name: string) {
      const issued = await api<IssuedFeed>("/feed-tokens", "POST", { name });
      resource.reload();
      return issued;
    },
    async rotate(id: string) {
      const issued = await api<IssuedFeed>(`/feed-tokens/${id}/rotate`, "POST");
      resource.reload();
      return issued;
    },
    async revoke(id: string) {
      await api(`/feed-tokens/${id}`, "DELETE");
      resource.reload();
    },
  };
}
