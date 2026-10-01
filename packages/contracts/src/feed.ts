import { z } from "zod";

export const feedTokenSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** 仅用于界面区分，不足以访问订阅。 */
  tokenHint: z.string(),
  createdAt: z.int(),
  rotatedAt: z.int(),
});
export type FeedToken = z.infer<typeof feedTokenSchema>;

export const createFeedTokenInputSchema = z.object({
  name: z.string().trim().min(1, "请填写名称").max(30),
});
export type CreateFeedTokenInput = z.infer<typeof createFeedTokenInputSchema>;

/** 完整订阅地址只在创建或轮换时返回一次，服务端只保存 token 摘要。 */
export const issuedFeedSchema = z.object({
  feed: feedTokenSchema,
  url: z.url(),
  webcalUrl: z.string(),
});
export type IssuedFeed = z.infer<typeof issuedFeedSchema>;

export const feedTokenListSchema = z.object({ feeds: z.array(feedTokenSchema) });
