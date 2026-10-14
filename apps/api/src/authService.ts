import type { ChangePasswordInput, UpdateProfileInput } from "@timenote/contracts";
import {
  BusinessError,
  dummyPasswordHash,
  hashPassword,
  type OpenedRepository,
  type StoredUser,
  verifyPassword,
} from "@timenote/runtime";

/** 校验凭证；账号不存在、停用或密码错误返回同一提示，不泄露账号状态。 */
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
