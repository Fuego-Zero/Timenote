import cookie from "@fastify/cookie";

import { authenticate } from "./authenticate.js";
import type { ApiContext } from "./context.js";

export async function registerSession(ctx: ApiContext) {
  const { app, config } = ctx;
  await app.register(cookie);
  const allowPrivateLan = config.env !== "production";
  app.addHook("onRequest", (req, _reply, done) => {
    try {
      authenticate(ctx, req, allowPrivateLan);
      done();
    } catch (error) {
      done(error instanceof Error ? error : new Error("authenticate", { cause: error }));
    }
  });
}
