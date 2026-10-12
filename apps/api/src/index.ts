import { baseServer, RequestSignRegistry, type Config, type OpenedRepository } from "@timenote/runtime";

import type { ApiContext } from "./context.js";
import { registerAuth } from "./http/auth.js";
import { registerSetup } from "./http/setup.js";
import { registerBackup } from "./http/backup.js";
import { registerEvents } from "./http/events.js";
import { registerFeeds } from "./http/feeds.js";
import { registerFeedTokens } from "./http/feedTokens.js";
import { registerUsers } from "./http/users.js";
import { registerRequestSign } from "./requestSign.js";
import { registerSession } from "./session.js";

export async function createApiServer(config: Config, repo: OpenedRepository, options: { now?: () => number } = {}) {
  const app = await baseServer(config);
  const ctx: ApiContext = {
    app,
    config,
    repo,
    now: options.now ?? Date.now,
    requestSign: new RequestSignRegistry(config.signMasterKey),
  };
  await registerSession(ctx);
  await registerRequestSign(ctx);
  registerSetup(ctx);
  registerAuth(ctx);
  registerUsers(ctx);
  registerEvents(ctx);
  registerFeedTokens(ctx);
  registerFeeds(ctx);
  registerBackup(ctx);
  return app;
}
