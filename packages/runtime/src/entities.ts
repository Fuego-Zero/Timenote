import { feedTokenSchema, publicUserSchema } from "@timenote/contracts";
import { z } from "zod";

/** 数据库 payload 的运行时 Schema；读出时校验，防止脏数据进入业务逻辑。 */
export const storedUserSchema = publicUserSchema.extend({ passwordHash: z.string().startsWith("scrypt$") });
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

export const storedFeedTokenSchema = feedTokenSchema.extend({
  ownerId: z.string(),
  tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export type StoredFeedToken = z.infer<typeof storedFeedTokenSchema>;
