import { publicUserSchema } from "@timenote/contracts";
import { z } from "zod";

/** 数据库 payload 的运行时 Schema；读出时校验，防止脏数据进入业务逻辑。 */
export const storedUserSchema = publicUserSchema.extend({
  passwordHash: z.string().startsWith("scrypt$"),
});
export type StoredUser = z.infer<typeof storedUserSchema>;

export const sessionSchema = z.object({
  /** 会话 token 的 SHA-256 摘要；Cookie 中的明文不落库。 */
  id: z.string().regex(/^[a-f0-9]{64}$/),
  userId: z.string(),
  createdAt: z.int(),
  expiresAt: z.int(),
  lastActiveAt: z.int(),
});
export type Session = z.infer<typeof sessionSchema>;

/** 订阅 token 明文随记录保存，登录后可以再次拼出地址；访问订阅仍用 tokenHash 查找。 */
export const storedFeedTokenSchema = z.object({
  id: z.uuid(),
  ownerId: z.string(),
  name: z.string(),
  /** 自定义日历显示名；缺省时渲染回退「显示名|用户名的纪念日」。空串不应入库。 */
  calendarName: z.string().max(40).optional(),
  token: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.int(),
  rotatedAt: z.int(),
  /** 缺省或 null 读作 all；与 selected + []（空订阅）必须可区分，禁止把 [] 存成未配置。 */
  eventScope: z.enum(["all", "selected"]).optional(),
  eventIds: z.array(z.uuid()).optional(),
  /** 日历客户端最近一次成功拉取（含 304）的时间；为避免频繁写库，距上次记录超过 1 小时才更新。 */
  lastFetchedAt: z.int().optional(),
});
export type StoredFeedToken = z.infer<typeof storedFeedTokenSchema>;
