import type { Config } from "./config.js";
import type { Repository } from "./repository.js";

/**
 * 历史入口：曾支持 INITIAL_ADMIN_* 环境变量种子。
 * 现已禁用；首个管理员只经 POST /api/setup/admin（首次引导）创建。
 * 保留调用点兼容，始终 no-op。
 */
export async function ensureInitialAdmin(_repo: Repository, _config: Config) {
  return undefined;
}
