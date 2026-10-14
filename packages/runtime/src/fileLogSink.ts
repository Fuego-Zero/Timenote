import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import type { LogSink } from "./configTypes.js";
import type { Hop } from "./traceTypes.js";

export const defaultLogRoot = ".tmp/logs";

export function resolveLogRoot(env: NodeJS.Dict<string> = process.env): string {
  const dir = env.LOG_DIR?.trim();
  if (!dir) {
    return defaultLogRoot;
  }

  return dir;
}

function dayStamp(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** 按 hop 分目录、按天分文件写 JSONL；测试环境不落盘。 */
export function createFileLogSink(root = defaultLogRoot, env = process.env.NODE_ENV ?? "development"): LogSink {
  const persist = env !== "test";
  return {
    write(message: string) {
      if (!persist) {
        return;
      }

      let hop: Hop = "api";
      try {
        const parsed = JSON.parse(message) as { hop?: unknown };
        if (parsed.hop === "web") {
          hop = "web";
        }
      } catch {
        hop = "api";
      }

      const dir = join(root, hop);
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, `${dayStamp()}.jsonl`), `${message}\n`);
    },
  };
}
