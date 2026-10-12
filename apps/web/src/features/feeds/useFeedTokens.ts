import type { CreateFeedTokenInput, FeedToken, UpdateFeedTokenInput } from "@timenote/contracts";

import { api } from "../../api/client.js";
import { useApiResource } from "../../api/useApiResource.js";

export function useFeedTokens() {
  const resource = useApiResource<{ feeds: FeedToken[] }>("/feed-tokens");
  return {
    feeds: resource.data?.feeds,
    error: resource.error,
    async create(input: CreateFeedTokenInput) {
      await api("/feed-tokens", "POST", input);
      resource.reload();
    },
    async update(id: string, input: UpdateFeedTokenInput) {
      await api(`/feed-tokens/${id}`, "PATCH", input);
      resource.reload();
    },
    async rotate(id: string) {
      await api(`/feed-tokens/${id}/rotate`, "POST");
      resource.reload();
    },
    async revoke(id: string) {
      await api(`/feed-tokens/${id}`, "DELETE");
      resource.reload();
    },
  };
}
