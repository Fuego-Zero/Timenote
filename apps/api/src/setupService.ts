import { randomUUID } from "node:crypto";

import type { SetupAdminInput } from "@timenote/contracts";
import {
  BusinessError,
  type Config,
  hashPassword,
  isStrongAdminPassword,
  type OpenedRepository,
  type StoredUser,
  strongAdminPasswordMessage,
} from "@timenote/runtime";

export function hasEnabledAdmin(repo: OpenedRepository) {
  return repo.users.listUsers().some(user => user.role === "admin" && !user.disabled);
}

/** 空库首次创建管理员；已有任意用户时拒绝。不含 INITIAL_ADMIN_* 环境种子。 */
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
  // 显示名称缺省、空串或全空白时用“管理员”。
  const displayName = input.displayName?.trim();
  try {
    return repo.transaction(() => {
      if (repo.users.listUsers().length) {
        throw new BusinessError("FORBIDDEN", { message: "已有用户，无法再次引导创建管理员" });
      }

      const user: StoredUser = {
        id: randomUUID(),
        username: input.username,
        displayName: displayName === undefined || displayName === "" ? "管理员" : displayName,
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
