import { describe, expect, it } from "vitest";

import {
  type EmojiEntry,
  isSelectableEmoji,
  loadEmojiCatalog,
  omitUnpaintedEmojis,
  searchEmojis,
  visibleRowRange,
} from "../../apps/web/src/features/events/emojiSearch.js";

function entry(name: string, emoji: string): EmojiEntry {
  return { emoji, labels: [], name, order: 0, tags: [] };
}

describe("表情搜索", () => {
  it("中文和英文关键词都能找到生日蛋糕，无结果时为空", async () => {
    const catalog = await loadEmojiCatalog();
    const cake = catalog.find(entry => entry.emoji === "🎂");
    expect(cake?.name).toContain("蛋糕");
    expect(searchEmojis(catalog, "蛋糕").some(entry => entry.emoji === "🎂")).toBe(true);
    expect(searchEmojis(catalog, "cake").some(entry => entry.emoji === "🎂")).toBe(true);
    expect(searchEmojis(catalog, "没有这种表情xyz")).toEqual([]);
    expect(catalog[0]?.emoji).toBe("😀");
    expect(catalog.length).toBeGreaterThan(1000);
    expect(catalog.some(entry => entry.emoji.includes("\u{1F3FB}"))).toBe(false);
  });

  it("去掉画不出来的表情，彩色回退只留最短的一个", () => {
    const box = { colorless: true, id: "box", ink: 20 };
    const chain = { colorless: false, id: "chain", ink: 40 };
    const face = { colorless: false, id: "face", ink: 50 };
    const blank = entry("裂开", "🯄");
    const pickle = entry("酸黄瓜", "🯅");
    const link = entry("链条", "⛓");
    const broken = entry("断链", "⛓‍💥");
    const smile = entry("嘿嘿", "😀");
    const kept = omitUnpaintedEmojis([blank, pickle, link, broken, smile], emoji => {
      if (emoji === blank.emoji || emoji === pickle.emoji) {
        return box;
      }

      if (emoji === link.emoji || emoji === broken.emoji) {
        return chain;
      }

      return face;
    });
    expect(kept.map(item => item.name)).toEqual(["链条", "嘿嘿"]);
  });

  it("只计算视口附近的行", () => {
    const top = visibleRowRange(1953, 0, 280, 8, 42);
    expect(top.start).toBe(0);
    expect(top.end).toBe(9);
    expect(top.rowCount).toBe(245);

    const bottom = visibleRowRange(1953, top.totalHeight - 280, 280, 8, 42);
    expect(bottom.end).toBe(245);
    expect(bottom.start).toBeGreaterThan(200);
    expect(visibleRowRange(0, 0, 280, 8, 42)).toEqual({ end: 0, rowCount: 0, start: 0, totalHeight: 0 });
  });

  it("肤色变体和超过 16 字的表情不能选", () => {
    expect(isSelectableEmoji("🎂")).toBe(true);
    expect(isSelectableEmoji("👋🏻")).toBe(false);
    expect(isSelectableEmoji("🏻")).toBe(false);
    expect(isSelectableEmoji("🎂".repeat(9))).toBe(false);
  });
});
