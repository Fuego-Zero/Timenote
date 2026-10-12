import { isAnonSignPath, isSignExemptPath, verifyRequestSignature } from "@timenote/runtime";
import type { FastifyRequest } from "fastify";

import type { ApiContext } from "./context.js";
import { rawJsonBodyParser } from "./rawJsonBodyParser.js";

/** 安装 raw body 解析与请求完整性 MAC 校验（在会话认证之后）。 */
export async function registerRequestSign(ctx: ApiContext) {
  const { app } = ctx;
  rawJsonBodyParser(app);

  app.addHook("preValidation", (req, _reply, done) => {
    try {
      enforceRequestSign(ctx, req);
      done();
    } catch (error) {
      done(error instanceof Error ? error : new Error("request sign", { cause: error }));
    }
  });
}

function enforceRequestSign(ctx: ApiContext, req: FastifyRequest) {
  const path = (req.url.split("?")[0] ?? "/");
  if (isSignExemptPath(req.method, path)) {
    return;
  }

  if (!path.startsWith("/api/")) {
    return;
  }

  const requireAnon = isAnonSignPath(req.method, path);
  const sessionKeyId = resolveSessionKeyId(ctx, req);

  if (!requireAnon && !sessionKeyId) {
    // 未登录访问需登录接口：交给后续 requireUser → AUTH_REQUIRED；不强制匿名签。
    return;
  }

  verifyRequestSignature(ctx.requestSign, ctx.config.signMasterKey, {
    method: req.method,
    url: req.url,
    headers: req.headers as Record<string, string | string[] | undefined>,
    rawBody: req.rawBody,
    nowMs: ctx.now(),
    sessionKeyId,
    requireAnon,
  });
}

function resolveSessionKeyId(ctx: ApiContext, req: FastifyRequest): string | undefined {
  if (req.sessionId) {
    return req.sessionId;
  }

  // development 旁路：无 cookie 会话时用稳定派生 id，便于前端仍走 SIGN。
  if (ctx.config.devAuthBypass && req.user) {
    return `dev:${req.user.id}`;
  }

  return undefined;
}
