import { randomUUID } from "node:crypto";

import type { CreateUserInput, UpdateUserInput } from "@timenote/contracts";
import { BusinessError, hashPassword, type OpenedRepository, type StoredUser } from "@timenote/runtime";

import { assertKeepsAdmin } from "./adminInvariant.js";

function existingUser(repo: OpenedRepository, id: string) {
  const user = repo.users.getUser(id);
  if (!user) {
    throw new BusinessError("NOT_FOUND");
  }

  return user;
}

export async function createUser(repo: OpenedRepository, input: CreateUserInput, defaultTimeZone: string, now: number) {
  const passwordHash = await hashPassword(input.password);
  const user: StoredUser = {
    id: randomUUID(),
    username: input.username,
    displayName: input.displayName,
    role: input.role,
    disabled: false,
    timeZone: input.timeZone ?? defaultTimeZone,
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
  return user;
}

export function updateUser(repo: OpenedRepository, actor: StoredUser, id: string, input: UpdateUserInput, now: number) {
  return repo.transaction(() => {
    const target = existingUser(repo, id);
    if (target.id === actor.id && (input.disabled === true || input.role === "user")) {
      throw new BusinessError("FORBIDDEN", { message: "不能停用自己或取消自己的管理员身份" });
    }

    const next: StoredUser = {
      ...target,
      displayName: input.displayName ?? target.displayName,
      role: input.role ?? target.role,
      disabled: input.disabled ?? target.disabled,
      updatedAt: now,
    };
    assertKeepsAdmin(repo, target, next);
    repo.users.putUser(next);
    if (next.disabled) {
      repo.sessions.removeUserSessions(next.id);
    }

    return next;
  });
}

export async function resetPassword(repo: OpenedRepository, id: string, password: string, now: number) {
  existingUser(repo, id);
  const passwordHash = await hashPassword(password);
  return repo.transaction(() => {
    const next = { ...existingUser(repo, id), passwordHash, updatedAt: now };
    repo.users.putUser(next);
    repo.sessions.removeUserSessions(id);
    return next;
  });
}

export function deleteUser(repo: OpenedRepository, actor: StoredUser, id: string) {
  repo.transaction(() => {
    const target = existingUser(repo, id);
    if (target.id === actor.id) {
      throw new BusinessError("FORBIDDEN", { message: "不能删除当前登录的账号" });
    }

    assertKeepsAdmin(repo, target, null);
    repo.users.removeUser(id);
  });
}
