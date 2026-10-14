import type { FastifyInstance } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    /** JSON 请求的原始字节，供 SIGN body hash 使用。 */
    rawBody?: Buffer;
  }
}

/** 保留 raw body 并解析 JSON，供后续 MAC 校验。 */
export function rawJsonBodyParser(app: FastifyInstance) {
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body);
    req.rawBody = buffer;
    if (buffer.length === 0) {
      done(null, null);
      return;
    }

    try {
      done(null, JSON.parse(buffer.toString("utf8")));
    } catch (error) {
      // 格式错误的 JSON 属于客户端输入问题：带上 400，由 toApiError 映射为 INVALID_INPUT。
      const invalid = new Error("Invalid JSON", { cause: error }) as Error & { statusCode: number };
      invalid.statusCode = 400;
      done(invalid, undefined);
    }
  });
}
