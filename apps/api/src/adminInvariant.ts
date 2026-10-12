import { BusinessError, type OpenedRepository, type StoredUser } from "@timenote/runtime";

function isActiveAdmin(user: Pick<StoredUser, "role" | "disabled">) {
  return user.role === "admin" && !user.disabled;
}

/** 变更后系统里必须仍有至少一个启用的管理员；next 为 null 表示删除。 */
export function assertKeepsAdmin(repo: OpenedRepository, target: StoredUser, next: StoredUser | null) {
  if (!isActiveAdmin(target) || (next && isActiveAdmin(next))) {
    return;
  }

  const others = repo.users.listUsers().filter(user => user.id !== target.id && isActiveAdmin(user));
  if (!others.length) {
    throw new BusinessError("LAST_ADMIN");
  }
}
