import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

export interface MediaInstance {
  origin: string;
  stop: () => void;
}

const startTimeoutMs = 60_000;

/**
 * 启动只供素材录制使用的实例：独立端口，SQLite 和日志都在 .tmp 下自己的目录里，每次启动前清空，
 * 不读写 .env 中配置的数据库和日志目录（显式传入的环境变量优先于 .env）。
 * 用 development 而不是 test：test 下前端组件的 id 全部相同，弹窗名称会指错元素；
 * 同时显式关闭开发免登录，素材走真实的首次设置和登录。
 */
export async function startMediaInstance(name: string, webPort: number, timeZone: string): Promise<MediaInstance> {
  const dir = join(process.cwd(), ".tmp", "guide-media", name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const origin = `http://127.0.0.1:${webPort}`;
  const child = spawn(process.execPath, ["--import", "tsx", "scripts/dev.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "development",
      DEV_AUTH_BYPASS: "0",
      SQLITE_PATH: join(dir, "media.sqlite"),
      LOG_DIR: join(dir, "logs"),
      DEFAULT_TIME_ZONE: timeZone,
      WEB_PORT: String(webPort),
      WEB_ORIGIN: origin,
      WEB_BIND_HOST: "127.0.0.1",
      API_PORT: String(webPort + 1),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForReady(child);
  return { origin, stop: () => child.kill() };
}

function waitForReady(child: ChildProcess) {
  return new Promise<void>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`素材实例 ${startTimeoutMs / 1000} 秒内未启动：\n${output}`));
    }, startTimeoutMs);
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("Web 已启动")) {
        clearTimeout(timer);
        resolve();
      }
    };

    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.once("exit", code => {
      clearTimeout(timer);
      reject(new Error(`素材实例提前退出（${code}）：\n${output}`));
    });
  });
}
