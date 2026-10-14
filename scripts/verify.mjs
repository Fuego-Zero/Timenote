import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Run via pnpm verify: use its CLI without shell interpolation or PATH guessing.
const root = fileURLToPath(new URL("..", import.meta.url));
const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) {
  throw new Error("请使用 pnpm verify 启动验证");
}

const resultDir = join(root, ".tmp", "verification-results", "latest");
await mkdir(resultDir, { recursive: true });
const log = createWriteStream(join(resultDir, "quality.log"), { flags: "w" });
const reportPath = join(resultDir, "report.json");
const git = (...args) => {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("读取Git状态失败");
  }

  return result.stdout;
};

async function snapshot() {
  const paths = [
    ...new Set(git("ls-files", "--cached", "--others", "--exclude-standard", "-z").split("\0").filter(Boolean)),
  ].sort();
  const files = await Promise.all(
    paths.map(async path => ({
      path,
      sha256: createHash("sha256")
        .update(await readFile(join(root, path)))
        .digest("hex"),
    }))
  );
  return {
    sha256: createHash("sha256").update(JSON.stringify(files)).digest("hex"),
    files,
  };
}

const report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  node: process.version,
  gitHead: git("rev-parse", "HEAD").trim(),
  gitStatus: git("status", "--porcelain"),
  sourceBefore: await snapshot(),
  commands: [],
  success: false,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const steps = [
  ["typecheck"],
  ["lint"],
  ["format:check"],
  ["exec", "vitest", "run", "--reporter=default", "--reporter=json", `--outputFile=${join(resultDir, "vitest.json")}`],
  ["build"],
  ["exec", "playwright", "test", "--reporter=line,json"],
];
try {
  for (const args of steps) {
    const command = {
      args: ["pnpm", ...args],
      startedAt: new Date().toISOString(),
    };
    const heading = `\n$ pnpm ${args.join(" ")}\n`;
    process.stdout.write(heading);
    log.write(heading);
    const child = spawn(process.execPath, [pnpmCli, ...args], {
      cwd: root,
      env: {
        ...process.env,
        PLAYWRIGHT_JSON_OUTPUT_FILE: join(resultDir, "playwright.json"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const [stream, target] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ]) {
      stream.on("data", chunk => {
        log.write(chunk);
        target.write(chunk);
      });
    }

    // eslint-disable-next-line no-await-in-loop -- 质量步骤必须顺序完成，前一步失败后停止后续步骤。
    const [code, signal] = await once(child, "close");
    command.finishedAt = new Date().toISOString();
    command.exitCode = code;
    command.signal = signal;
    report.commands.push(command);
    // eslint-disable-next-line no-await-in-loop -- 每一步的结果写入完成后才能继续，保证报告顺序与失败现场一致。
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    if (code !== 0) {
      throw new Error(`质量命令失败：${args.join(" ")}`);
    }
  }

  report.sourceAfter = await snapshot();
  report.sourceUnchanged = report.sourceBefore.sha256 === report.sourceAfter.sha256;
  report.success = report.sourceUnchanged;
  if (!report.sourceUnchanged) {
    throw new Error("验证期间源码发生变化，请检查后重新验证");
  }
} catch (error) {
  report.error = error instanceof Error ? error.message : "验证失败";
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  log.end();
  await once(log, "finish");
}

console.log(`验证结果：${reportPath}`);
