import type { StoredUser } from "@timenote/runtime";

/**
 * development 免登录旁路选用的管理员：按 createdAt、id 升序取最早启用的 admin。
 * 不能用 listUsers（按 username）的「第一个」，否则新晋管理员用户名更靠前时会换人，
 * 进而切换 dev: 签名密钥，导致客户端仍持旧 key 时出现 SIGN_INVALID。
 */
export function pickDevBypassAdmin(users: readonly StoredUser[]): StoredUser | undefined {
  let best: StoredUser | undefined;
  for (const user of users) {
    if (user.role !== "admin" || user.disabled) {
      continue;
    }

    if (!best || user.createdAt < best.createdAt || (user.createdAt === best.createdAt && user.id < best.id)) {
      best = user;
    }
  }

  return best;
}
