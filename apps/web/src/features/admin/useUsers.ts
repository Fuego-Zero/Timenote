import type { CreateUserInput, PublicUser, UpdateUserInput } from "@timenote/contracts";

import { api } from "../../api/client.js";
import { useApiResource } from "../../api/useApiResource.js";

export function useUsers() {
  const resource = useApiResource<{ users: PublicUser[] }>("/admin/users");
  return {
    users: resource.data?.users,
    error: resource.error,
    async create(input: CreateUserInput) {
      await api("/admin/users", "POST", input);
      resource.reload();
    },
    async update(id: string, input: UpdateUserInput) {
      await api(`/admin/users/${id}`, "PATCH", input);
      resource.reload();
    },
    async resetPassword(id: string, password: string) {
      await api(`/admin/users/${id}/password`, "POST", { password });
    },
    async remove(id: string) {
      await api(`/admin/users/${id}`, "DELETE");
      resource.reload();
    },
  };
}
