import { randomUUID } from "node:crypto";

import type { Config } from "./config.js";
import type { Repository } from "./repository.js";
import { hashPassword } from "./security.js";

/**
 * 首次启动（库中没有任何账号）时按 `.env` 创建管理员；已有账号时不读取也不覆盖，
 * 之后的账号与密码只通过后台页面维护。
 */
export async function ensureInitialAdmin(repo: Repository, config: Config) {
  if (repo.listUsers().length) {
    return undefined;
  }

  if (!config.initialAdmin) {
    throw new Error("首次启动需要配置 INITIAL_ADMIN_USERNAME 和 INITIAL_ADMIN_PASSWORD");
  }

  const now = Date.now();
  const user = {
    id: randomUUID(),
    username: config.initialAdmin.username,
    displayName: "管理员",
    role: "admin" as const,
    disabled: false,
    timeZone: config.defaultTimeZone,
    createdAt: now,
    updatedAt: now,
    passwordHash: await hashPassword(config.initialAdmin.password),
  };
  repo.transaction(() => {
    if (!repo.listUsers().length) {
      repo.putUser(user);
    }
  });
  return user.id;
}
