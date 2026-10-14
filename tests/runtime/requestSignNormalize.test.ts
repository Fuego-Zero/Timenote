import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { bodySha256Hex } from "../../packages/runtime/src/requestSignCrypto.js";
import { normalizeSignQuery } from "../../packages/runtime/src/requestSignPaths.js";

/** 固定现有行为：lint D 批改写嵌套三元前，锁住 bodySha256Hex 三个分支的结果。 */
describe("bodySha256Hex", () => {
  const emptyHex = createHash("sha256").update(Buffer.alloc(0)).digest("hex");

  it("undefined 按空 body 计算", () => {
    expect(bodySha256Hex(undefined)).toBe(emptyHex);
  });

  it("字符串按 UTF-8 编码计算", () => {
    expect(bodySha256Hex('{"name":"我的设备"}')).toBe(
      createHash("sha256").update(Buffer.from('{"name":"我的设备"}', "utf8")).digest("hex")
    );
    expect(bodySha256Hex("")).toBe(emptyHex);
  });

  it("Buffer 原样计算，与同内容字符串结果一致", () => {
    const text = '{"a":1}';
    expect(bodySha256Hex(Buffer.from(text, "utf8"))).toBe(bodySha256Hex(text));
  });
});

/** 固定现有行为：lint D 批改写排序比较器的嵌套三元前，锁住同名键按值排序的结果。 */
describe("normalizeSignQuery 排序", () => {
  it.each([
    ["键名不同按键名升序", "/api/x?b=1&a=2", "a=2&b=1"],
    ["同名键值小的在前", "/api/x?k=b&k=a", "k=a&k=b"],
    ["同名键值大的在后", "/api/x?k=a&k=c&k=b", "k=a&k=b&k=c"],
    ["同名同值保留重复项", "/api/x?k=a&k=a&j=z", "j=z&k=a&k=a"],
    ["无 query 为空串", "/api/x", ""],
    ["只有问号为空串", "/api/x?", ""],
    ["值重新编码", "/api/x?q=a%20b&p=%E4%B8%AD", "p=%E4%B8%AD&q=a%20b"],
  ])("%s", (_label, url, expected) => {
    expect(normalizeSignQuery(url)).toBe(expected);
  });
});
