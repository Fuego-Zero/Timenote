import { randomUUID } from "node:crypto";

import type { SetupAdminInput } from "@timenote/contracts";
import {
  BusinessError,
  hashPassword,
  isStrongAdminPassword,
  strongAdminPasswordMessage,
  type Config,
  type OpenedRepository,
  type StoredUser,
} from "@timenote/runtime";

export function hasEnabledAdmin(repo: OpenedRepository) {
  return repo.users.listUsers().some(user => user.role === "admin" && !user.disabled);
}

/** 空库首次创建管理员；已有任意用户时拒绝。 */
export async function createInitialAdmin(
  repo: OpenedRepository,
  config: Config,
  input: SetupAdminInput,
  now: number
): Promise<StoredUser> {
  if (config.env === "production" && !isStrongAdminPassword(input.password)) {
    throw new BusinessError("INVALID_INPUT", {
      fields: { password: strongAdminPasswordMessage() },
    });
  }

  const passwordHash = await hashPassword(input.password);
  try {
    return repo.transaction(() => {
      if (repo.users.listUsers().length) {
        throw new BusinessError("FORBIDDEN", { message: "已有用户，无法再次引导创建管理员" });
      }

      const user: StoredUser = {
        id: randomUUID(),
        username: input.username,
        displayName: input.displayName?.trim() || "管理员",
        role: "admin",
        disabled: false,
        timeZone: config.defaultTimeZone,
        mustChangePassword: false,
        createdAt: now,
        updatedAt: now,
        passwordHash,
      };
      repo.users.putUser(user);
      return user;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/UNIQUE|unique/i.test(message)) {
      throw new BusinessError("FORBIDDEN", { message: "已有用户，无法再次引导创建管理员" });
    }

    throw error;
  }
}
