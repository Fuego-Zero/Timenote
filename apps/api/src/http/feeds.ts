import { BusinessError } from "@timenote/runtime";
import { z } from "zod";

import type { ApiContext } from "../context.js";
import { feedTokenPattern, renderFeedForToken } from "../feeds.js";

const fileParams = z.object({ file: z.string() });

/** 日历客户端拉取的私密订阅；只凭 URL 中的 token 鉴权，不返回 HTML 登录页。 */
export function registerFeeds(ctx: ApiContext) {
  const { app, config, repo } = ctx;
  app.get("/api/feeds/:file", (req, reply) => {
    const { file } = fileParams.parse(req.params);
    const token = feedTokenPattern.exec(file)?.[1];
    const feed = token ? renderFeedForToken(repo, config, token, ctx.now()) : undefined;
    if (!feed) {
      throw new BusinessError("NOT_FOUND");
    }

    // private + no-cache：共享缓存不得存储，客户端每次用 ETag 条件请求重新校验。
    void reply.header("Cache-Control", "private, no-cache").header("ETag", feed.etag);
    if (req.headers["if-none-match"] === feed.etag) {
      return reply.code(304).send();
    }

    return reply.type("text/calendar; charset=utf-8").send(feed.body);
  });
}
