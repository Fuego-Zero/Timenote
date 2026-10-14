import type { PublicUser } from "@timenote/contracts";
import type { StoredUser } from "@timenote/runtime";

export function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    disabled: user.disabled,
    timeZone: user.timeZone,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
