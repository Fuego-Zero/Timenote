import { z } from "zod";

import { issueDetail } from "./error.js";
import { anonSignSchema } from "./requestSign.js";

export const roles = ["admin", "user"] as const;
export type Role = (typeof roles)[number];

export function isTimeZone(value: string) {
  try {
    const resolved = new Intl.DateTimeFormat("en-US", { timeZone: value }).resolvedOptions().timeZone;
    return Boolean(resolved) && (value.includes("/") || value === "UTC");
  } catch {
    return false;
  }
}

export const timeZoneSchema = z.string().refine(isTimeZone, issueDetail("timezone_invalid"));
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9_.-]{2,31}$/, issueDetail("username_pattern"));
export const passwordSchema = z.string().min(8, issueDetail("password_min")).max(128, issueDetail("password_max"));
const displayNameSchema = z.string().trim().max(40);

export const publicUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  role: z.enum(roles),
  disabled: z.boolean(),
  timeZone: z.string(),
  createdAt: z.int(),
  updatedAt: z.int(),
  /** 最近一次成功登录（建会话）时刻；从未成功登录为 null。存量缺字段读时按 null。 */
  lastLoginAt: z.int().nullable().default(null),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const loginInputSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(128) });
export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export const updateProfileInputSchema = z.object({ displayName: displayNameSchema, timeZone: timeZoneSchema });

export const createUserInputSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  role: z.enum(roles),
  timeZone: timeZoneSchema.optional(),
});
export const updateUserInputSchema = z.object({
  displayName: displayNameSchema.optional(),
  role: z.enum(roles).optional(),
  disabled: z.boolean().optional(),
});
export const resetPasswordInputSchema = z.object({ password: passwordSchema });

export const sessionResponseSchema = z.object({
  user: publicUserSchema.nullable(),
  /** 已登录时返回会话派生 signKey（base64url），供后续请求 HMAC。 */
  signKey: z.string().optional(),
  /** 未登录时下发的匿名短时签名材料，供 login/setup/register 使用。 */
  anonSign: anonSignSchema.optional(),
  /** 是否开放公开自助注册（部署开关；默认 false）。 */
  publicRegisterEnabled: z.boolean().optional(),
  /** 公开注册新账号是否默认停用（部署开关；默认 true）。 */
  registerDefaultDisabled: z.boolean().optional(),
});

export const registerInputSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: displayNameSchema.optional(),
  /** 浏览器算完的 ALTCHA 结果。开关关闭或尚未完成引导时可以不带。 */
  altcha: z.string().optional(),
});

export const setupAdminInputSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  displayName: displayNameSchema.optional(),
});
export const setupStatusSchema = z.object({
  needed: z.boolean(),
  /** 需要首次引导时可附带匿名签名材料。 */
  anonSign: anonSignSchema.optional(),
});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordInputSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileInputSchema>;
export type CreateUserInput = z.infer<typeof createUserInputSchema>;
export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordInputSchema>;
export type RegisterInput = z.infer<typeof registerInputSchema>;
export type SetupAdminInput = z.infer<typeof setupAdminInputSchema>;
