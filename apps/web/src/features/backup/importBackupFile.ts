import { backupFileSchema, type ImportResult } from "@timenote/contracts";

import { api } from "../../api/client.js";

export class BackupImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupImportError";
  }
}

export async function importBackupFile(file: File): Promise<ImportResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new BackupImportError("文件不是有效的 JSON");
  }

  const parsed = backupFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BackupImportError("文件不是有效的 timenote 备份");
  }

  return api<ImportResult>("/backup", "POST", parsed.data);
}
