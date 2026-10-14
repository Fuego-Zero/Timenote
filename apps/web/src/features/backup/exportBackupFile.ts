import { api } from "../../api/client.js";

export async function exportBackupFile() {
  const backup = await api<unknown>("/backup");
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `timenote-backup-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
