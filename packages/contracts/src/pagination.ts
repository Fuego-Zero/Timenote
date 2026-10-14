import { z } from "zod";

export const maxPageSize = 100;
export const maxQueryLength = 50;

/** 列表分页与关键字搜索的公共查询参数；查询串里的数字统一 coerce，空白关键字视为未搜索。 */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(maxPageSize).default(20),
  q: z.preprocess(
    value => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(maxQueryLength).optional()
  ),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export function pageResultSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.int().min(0),
    page: z.int().min(1),
    pageSize: z.int().min(1).max(maxPageSize),
  });
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
