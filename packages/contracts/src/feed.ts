import { z } from "zod";

export const feedEventScopes = ["all", "selected"] as const;
export type FeedEventScope = (typeof feedEventScopes)[number];

export const feedTokenSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** 可由保存的 token 和当前 WEB_ORIGIN 拼出；升级前库中未存明文的地址没有明文，为 null。 */
  url: z.url().nullable(),
  webcalUrl: z.string().nullable(),
  createdAt: z.int(),
  rotatedAt: z.int(),
  /** 对外已规范化：缺字段/null 一律为 all。 */
  eventScope: z.enum(feedEventScopes),
  /** selected 时为所选事件 id（可为空）；all 时为空数组。 */
  eventIds: z.array(z.uuid()),
  /** 最近被日历客户端拉取的时间；从未拉取为 null。 */
  lastFetchedAt: z.int().nullable(),
});
export type FeedToken = z.infer<typeof feedTokenSchema>;

export const createFeedTokenInputSchema = z.object({
  name: z.string().trim().min(1, "请填写名称").max(30),
  eventScope: z.enum(feedEventScopes).default("all"),
  eventIds: z.array(z.uuid()).default([]),
});
export type CreateFeedTokenInput = z.infer<typeof createFeedTokenInputSchema>;

export const updateFeedTokenInputSchema = z.object({
  name: z.string().trim().min(1, "请填写名称").max(30).optional(),
  eventScope: z.enum(feedEventScopes).optional(),
  eventIds: z.array(z.uuid()).optional(),
});
export type UpdateFeedTokenInput = z.infer<typeof updateFeedTokenInputSchema>;
