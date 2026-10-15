import { describe, expect, it } from "vitest";

import { pickDevBypassAdmin } from "../../apps/api/src/pickDevBypassAdmin.js";
import type { StoredUser } from "../../packages/runtime/src/index.js";

function user(partial: Partial<StoredUser> & Pick<StoredUser, "id" | "username" | "role" | "createdAt">): StoredUser {
  return {
    displayName: partial.displayName ?? partial.username,
    disabled: partial.disabled ?? false,
    timeZone: "Asia/Shanghai",
    updatedAt: partial.updatedAt ?? partial.createdAt,
    lastLoginAt: partial.lastLoginAt ?? null,
    passwordHash: partial.passwordHash ?? "x",
    ...partial,
  };
}

describe("pickDevBypassAdmin", () => {
  it("选最早创建的启用 admin，忽略 username 排序与较新的 admin", () => {
    const older = user({ id: "b", username: "zebra", role: "admin", createdAt: 100 });
    const newerEarlierName = user({ id: "a", username: "aaa", role: "admin", createdAt: 200 });
    const disabledOld = user({ id: "c", username: "0old", role: "admin", createdAt: 50, disabled: true });
    const normal = user({ id: "d", username: "user", role: "user", createdAt: 10 });
    expect(pickDevBypassAdmin([newerEarlierName, disabledOld, normal, older])?.id).toBe("b");
  });

  it("无启用 admin 时返回 undefined", () => {
    expect(pickDevBypassAdmin([user({ id: "u", username: "u", role: "user", createdAt: 1 })])).toBeUndefined();
  });
});
