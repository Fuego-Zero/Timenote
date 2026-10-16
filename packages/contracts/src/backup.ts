import { z } from "zod";

import { issueDetail } from "./error.js";
import { eventInputSchema } from "./event.js";

export const backupEventSchema = z.object({ id: z.uuid(), event: eventInputSchema });

export const backupFileSchema = z.object({
  format: z.literal("timenote-backup"),
  version: z.literal(2, { error: issueDetail("backup_v1") }),
  exportedAt: z.iso.datetime(),
  events: z.array(backupEventSchema).max(5000),
});
export type BackupFile = z.infer<typeof backupFileSchema>;

export const importResultSchema = z.object({ created: z.int(), updated: z.int() });
export type ImportResult = z.infer<typeof importResultSchema>;
