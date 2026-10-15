import { z } from "zod";

export const feedEventScopes = ["all", "selected"] as const;
export type FeedEventScope = (typeof feedEventScopes)[number];

/** 日历显示名输入：trim；空串视为未设置（null），与省略同效；最长 40。 */
const calendarNameInputSchema = z.preprocess(value => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  return value;
}, z.string().max(40).nullable().optional());

export const feedTokenSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** 日历中显示的名称（ICS NAME / X-WR-CALNAME）；未自定义为 null，渲染时回退默认拼装。 */
  calendarName: z.string().nullable(),
  /** 可由保存的 token 和当前 WEB_ORIGIN 拼出；升级前库中未存明文的地址没有明文，为 null。 */
  url: z.url().nullable(),
  webcalUrl: z.string().nullable(),
  createdAt: z.int(),
  rotatedAt: z.int(),
  /** 对外已规范化：缺字段/null 一律为 all。 */
  eventScope: z.enum(feedEventScopes),
  /** selected 时为所选事件 id（可为空）；all 时为空数组。 */
  eventIds: z.array(z.uuid()),
  /** 所选事件的 id 与名称，顺序同 eventIds；all 时为空数组。 */
  events: z.array(z.object({ id: z.uuid(), name: z.string() })),
  /** 最近被日历客户端拉取的时间；从未拉取为 null。 */
  lastFetchedAt: z.int().nullable(),
});
export type FeedToken = z.infer<typeof feedTokenSchema>;

export const createFeedTokenInputSchema = z.object({
  name: z.string().trim().min(1, "请填写名称").max(30),
  /** 可选；空串/省略均不写入，渲染走默认「显示名|用户名的纪念日」。 */
  calendarName: calendarNameInputSchema,
  eventScope: z.enum(feedEventScopes).default("all"),
  eventIds: z.array(z.uuid()).default([]),
});
export type CreateFeedTokenInput = z.infer<typeof createFeedTokenInputSchema>;

export const updateFeedTokenInputSchema = z.object({
  name: z.string().trim().min(1, "请填写名称").max(30).optional(),
  /**
   * 省略：保持原值；null（含空串经 preprocess）：清空自定义，恢复默认拼装；
   * 非空字符串：写入自定义日历显示名。
   */
  calendarName: calendarNameInputSchema,
  eventScope: z.enum(feedEventScopes).optional(),
  eventIds: z.array(z.uuid()).optional(),
});
export type UpdateFeedTokenInput = z.infer<typeof updateFeedTokenInputSchema>;
