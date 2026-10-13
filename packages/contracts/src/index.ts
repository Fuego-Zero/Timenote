import { z } from "zod";

// 契约的默认校验提示统一为中文，前端表单与服务端错误字段使用同一套文案。
z.config(z.locales.zhCN());

export * from "./backup.js";
export * from "./error.js";
export * from "./event.js";
export * from "./feed.js";
export * from "./pagination.js";
export * from "./user.js";
export * from "./requestSign.js";
