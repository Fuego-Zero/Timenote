import type { Config, OpenedRepository, RequestSignRegistry } from "@timenote/runtime";
import type { FastifyInstance } from "fastify";

export interface ApiContext {
  app: FastifyInstance;
  config: Config;
  /** 可注入的当前时间，测试用来验证跨年窗口；生产为 Date.now。 */
  now: () => number;
  repo: OpenedRepository;
  requestSign: RequestSignRegistry;
}
