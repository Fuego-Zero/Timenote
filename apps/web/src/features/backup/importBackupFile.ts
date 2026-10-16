import { type BackupFile, backupFileSchema, type ImportResult } from "@timenote/contracts";

import { api } from "../../api/client.js";
import { i18n } from "../../i18n/index.js";

export class BackupImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupImportError";
  }
}

/** 本地解析并校验备份文件，不发请求。 */
export async function readBackupFile(file: File): Promise<BackupFile> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new BackupImportError(i18n.t("invalidJson", { ns: "backup" }));
  }

  const parsed = backupFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BackupImportError(i18n.t("invalidBackup", { ns: "backup" }));
  }

  return parsed.data;
}

/** 预览导入结果，不写库。 */
export function previewBackup(backup: BackupFile): Promise<ImportResult> {
  return api<ImportResult>("/backup/preview", "POST", backup);
}

/** 实际导入；服务端自行校验，不依赖预览结果。 */
export function importBackup(backup: BackupFile): Promise<ImportResult> {
  return api<ImportResult>("/backup", "POST", backup);
}
