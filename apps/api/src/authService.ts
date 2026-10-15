import { randomUUID } from "node:crypto";

import type { ChangePasswordInput, RegisterInput, UpdateProfileInput } from "@timenote/contracts";
import {
  BusinessError,
  type Config,
  dummyPasswordHash,
  hashPassword,
  type OpenedRepository,
  type StoredUser,
  verifyPassword,
} from "@timenote/runtime";

/** 校验凭证；账号不存在、停用或密码错误返回同一提示，不泄露账号状态。 */

/** 成功登录/建会话后写入 lastLoginAt；不在 startSession 内调用。 */
export function recordLogin(repo: OpenedRepository, userId: string, now: number) {
  repo.users.recordLastLoginAt(userId, now);
}

export async function authenticateCredentials(
  repo: OpenedRepository,
  username: string,
  password: string
): Promise<StoredUser> {
  const user = repo.users.getUserByUsername(username);
  const valid = await verifyPassword(password, user?.passwordHash ?? dummyPasswordHash);
  // 账号不存在、已停用与密码错误返回同一提示，不暴露账号状态。
  if (!user || user.disabled || !valid) {
    throw new BusinessError("INVALID_CREDENTIALS");
  }

  return user;
}

export function updateProfile(repo: OpenedRepository, user: StoredUser, input: UpdateProfileInput, now: number) {
  const next = { ...user, displayName: input.displayName, timeZone: input.timeZone, updatedAt: now };
  repo.users.putUser(next);
  return next;
}

export async function changeOwnPassword(
  repo: OpenedRepository,
  user: StoredUser,
  input: ChangePasswordInput,
  now: number,
  keepSessionId: string | undefined
) {
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new BusinessError("INVALID_INPUT", { fields: { currentPassword: "当前密码不正确" } });
  }

  const passwordHash = await hashPassword(input.newPassword);
  repo.transaction(() => {
    repo.users.putUser({ ...user, passwordHash, updatedAt: now });
    // 改密后其他设备上的登录全部失效，只保留当前会话。
    repo.sessions.removeUserSessions(user.id, keepSessionId);
  });
}

/** 公开自助注册：默认停用、不建会话；开关关闭或未完成 setup 时拒绝。 */
export async function registerPublicUser(
  repo: OpenedRepository,
  config: Config,
  input: RegisterInput,
  now: number
): Promise<void> {
  if (!config.publicRegisterEnabled) {
    throw new BusinessError("FORBIDDEN");
  }

  // 未完成首次引导（无启用管理员）时不允许自助注册，避免替代 setup/admin。
  const hasAdmin = repo.users.listUsers().some(user => user.role === "admin" && !user.disabled);
  if (!hasAdmin) {
    throw new BusinessError("FORBIDDEN");
  }

  const passwordHash = await hashPassword(input.password);
  const displayName = input.displayName?.trim() ?? "";
  const user: StoredUser = {
    id: randomUUID(),
    username: input.username,
    displayName,
    role: "user",
    disabled: true,
    timeZone: config.defaultTimeZone,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: null,
    passwordHash,
  };
  repo.transaction(() => {
    if (repo.users.getUserByUsername(user.username)) {
      throw new BusinessError("USERNAME_TAKEN", { fields: { username: "用户名已被使用" } });
    }

    repo.users.putUser(user);
  });
}
