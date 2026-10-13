import { describe, expect, it } from "vitest";

import { normalizeClientSignQuery } from "../../apps/web/src/api/clientSignCrypto.js";
import { normalizeSignQuery } from "../../packages/runtime/src/requestSignPaths.js";

/** 固定现有行为：lint D 批改写排序比较器的嵌套三元前，锁住前端 query 规范化结果，并要求与后端一致。 */
describe("normalizeClientSignQuery 排序", () => {
  it.each([
    ["键名不同按键名升序", "/api/x?b=1&a=2", "a=2&b=1"],
    ["同名键值小的在前", "/api/x?k=b&k=a", "k=a&k=b"],
    ["同名键值大的在后", "/api/x?k=a&k=c&k=b", "k=a&k=b&k=c"],
    ["同名同值保留重复项", "/api/x?k=a&k=a&j=z", "j=z&k=a&k=a"],
    ["无 query 为空串", "/api/x", ""],
    ["只有问号为空串", "/api/x?", ""],
    ["值重新编码", "/api/x?q=a%20b&p=%E4%B8%AD", "p=%E4%B8%AD&q=a%20b"],
  ])("%s，且与后端 normalizeSignQuery 一致", (_label, url, expected) => {
    expect(normalizeClientSignQuery(url)).toBe(expected);
    expect(normalizeClientSignQuery(url)).toBe(normalizeSignQuery(url));
  });
});
