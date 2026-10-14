import type { CreateFeedTokenInput, FeedToken, PageQuery, PageResult, UpdateFeedTokenInput } from "@timenote/contracts";

import { apiPath } from "../../api/apiPath.js";
import { api } from "../../api/client.js";
import { useApiResource } from "../../api/useApiResource.js";

export function useFeedTokens(query: PageQuery) {
  const resource = useApiResource<PageResult<FeedToken>>(apiPath("/feed-tokens", query));
  return {
    page: resource.data,
    error: resource.error,
    reload: resource.reload,
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
    /** 只撤销，不刷新：由调用方决定刷新当前页还是退回上一页。 */
    async revoke(id: string) {
      await api(`/feed-tokens/${id}`, "DELETE");
    },
  };
}
