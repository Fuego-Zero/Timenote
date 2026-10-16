import { z } from "zod";

// 校验失败的 message 使用稳定 detail，不携带自然语言；网页按当前语言生成提示。
z.config(z.locales.zhCN());

export * from "./backup.js";
export * from "./error.js";
export * from "./event.js";
export * from "./feed.js";
export * from "./pagination.js";
export * from "./user.js";
export * from "./requestSign.js";
