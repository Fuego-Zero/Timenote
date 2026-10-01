import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const prettierBin = resolve(root, "node_modules/prettier/bin/prettier.cjs");

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const event = input.hook_event_name;
const isCodex = event === "PostToolUse" || event === "Stop";
const sessionId = typeof input.session_id === "string" ? input.session_id.replace(/[^a-zA-Z0-9_-]/g, "_") : "default";
const pendingPath = resolve(root, `.tmp/hooks/${isCodex ? `codex-${sessionId}` : "cursor"}-pending-edits.txt`);

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function insideRepo(file) {
  const rel = relative(root, resolve(file));
  return rel !== "" && !rel.startsWith("..") && !rel.includes("node_modules") && !rel.startsWith(".tmp");
}

function remember(file) {
  if (!file || !insideRepo(file) || !existsSync(file)) {
    return;
  }

  mkdirSync(dirname(pendingPath), { recursive: true });
  appendFileSync(pendingPath, `${resolve(file)}\n`);
}

function readPending() {
  if (!existsSync(pendingPath)) {
    return [];
  }

  const files = [
    ...new Set(
      readFileSync(pendingPath, "utf8")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
    ),
  ].filter(file => insideRepo(file) && existsSync(file));
  return files;
}

function tail(text, lines = 40) {
  return (text ?? "").split(/\r?\n/).filter(Boolean).slice(-lines).join("\n");
}

if (event === "afterFileEdit") {
  remember(input.file_path ?? input.path ?? input.filePath);
  emit({});
} else if (event === "PostToolUse" && input.tool_name === "apply_patch") {
  const patch = input.tool_input?.command;
  if (typeof patch !== "string") {
    throw new Error("Codex apply_patch hook requires tool_input.command");
  }

  for (const line of patch.split(/\r?\n/)) {
    const match = /^\*\*\* (?:Add File|Update File|Move to): (.+)$/.exec(line);
    if (match) {
      remember(resolve(input.cwd ?? root, match[1]));
    }
  }

  emit({});
} else if ((event === "Stop" || event === "stop") && input.status !== "aborted" && input.status !== "error") {
  const files = readPending();
  if (files.length === 0) {
    rmSync(pendingPath, { force: true });
    emit({});
  } else {
    const format = spawnSync(process.execPath, [prettierBin, "--write", "--ignore-unknown", ...files], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    if ((format.status ?? 1) === 0) {
      rmSync(pendingPath, { force: true });
      emit({});
    } else {
      const message = `这一轮改动的格式化未通过。请根据下面的输出修正，不要扩大无关改动。\n\nprettier 退出码 ${format.status}\n${tail(`${format.error ?? ""}\n${format.stderr ?? ""}\n${format.stdout ?? ""}`)}`;
      if (!isCodex) {
        emit({ followup_message: message });
      } else if (input.stop_hook_active) {
        emit({ systemMessage: message });
      } else {
        emit({ decision: "block", reason: message });
      }
    }
  }
} else {
  emit({});
}
