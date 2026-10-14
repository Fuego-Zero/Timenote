import type { CreateUserInput, PageQuery, PageResult, PublicUser, UpdateUserInput } from "@timenote/contracts";

import { apiPath } from "../../api/apiPath.js";
import { api } from "../../api/client.js";
import { useApiResource } from "../../api/useApiResource.js";

export function useUsers(query: PageQuery) {
  const resource = useApiResource<PageResult<PublicUser>>(apiPath("/admin/users", query));
  return {
    page: resource.data,
    error: resource.error,
    reload: resource.reload,
    async create(input: CreateUserInput) {
      await api("/admin/users", "POST", input);
      resource.reload();
    },
    /** 刷新当前页：操作后停留在原页码。 */
    async update(id: string, input: UpdateUserInput) {
      await api(`/admin/users/${id}`, "PATCH", input);
      resource.reload();
    },
    async resetPassword(id: string, password: string) {
      await api(`/admin/users/${id}/password`, "POST", { password });
    },
    /** 只删除，不刷新：由调用方决定刷新当前页还是退回上一页。 */
    async remove(id: string) {
      await api(`/admin/users/${id}`, "DELETE");
    },
  };
}
