import type { ApiContext } from "./context.js";

export function issueSessionSignKey(
  ctx: ApiContext,
  sessionId: string | undefined,
  userId?: string
): string | undefined {
  if (sessionId) {
    return ctx.requestSign.sessionSignKey(sessionId);
  }

  if (ctx.config.devAuthBypass && userId) {
    return ctx.requestSign.devBypassSignKey(userId);
  }

  return undefined;
}
