import { randomUUID } from "node:crypto";

import type { SetupAdminInput } from "@timenote/contracts";
import {
  BusinessError,
  type Config,
  hashPassword,
  isStrongAdminPassword,
  type OpenedRepository,
  type StoredUser,
} from "@timenote/runtime";

import { recordLogin } from "./authService.js";

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
      fields: { password: "weak_admin_password" },
    });
  }

  const passwordHash = await hashPassword(input.password);
  // 显示名称缺省、空串或全空白时用“管理员”。
  const displayName = input.displayName?.trim();
  try {
    return repo.transaction(() => {
      if (repo.users.listUsers().length) {
        throw new BusinessError("FORBIDDEN", { detail: "setup_closed" });
      }

      const user: StoredUser = {
        id: randomUUID(),
        username: input.username,
        displayName: displayName === undefined || displayName === "" ? "管理员" : displayName,
        role: "admin",
        disabled: false,
        timeZone: config.defaultTimeZone,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: null,
        passwordHash,
      };
      repo.users.putUser(user);
      recordLogin(repo, user.id, now);
      return { ...user, lastLoginAt: now };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/UNIQUE|unique/i.test(message)) {
      throw new BusinessError("FORBIDDEN", { detail: "setup_closed" });
    }

    throw error;
  }
}
