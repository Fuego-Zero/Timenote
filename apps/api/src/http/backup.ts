import { backupFileSchema } from "@timenote/contracts";

import type { ApiContext } from "../context.js";
import { exportBackup, importBackup } from "../events.js";
import { requireUser } from "../session.js";

export function registerBackup(ctx: ApiContext) {
  const { app, repo } = ctx;
  app.get("/api/backup", (req, reply) => {
    const user = requireUser(req);
    const backup = exportBackup(repo, user.id, ctx.now());
    const day = backup.exportedAt.slice(0, 10).replaceAll("-", "");
    return reply
      .header("Cache-Control", "no-store")
      .header("Content-Disposition", `attachment; filename="timenote-backup-${day}.json"`)
      .send(backup);
  });

  app.post("/api/backup", req => {
    const user = requireUser(req);
    return importBackup(repo, user.id, backupFileSchema.parse(req.body), ctx.now());
  });
}
