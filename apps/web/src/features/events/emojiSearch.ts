const maxPrefixLength = 16;
const maxSearchResults = 80;
/**
 * 选择器只收录 Emoji 12.0 及更早。
 * 12.1 及以后的字符在 Windows 10 上可能显示为方框。
 */
export const maxEmojiVersion = 12;
/** 单独的肤色修饰符，以及带肤色的变体，都不作为前缀候选。 */
const skinTone = /[\u{1F3FB}-\u{1F3FF}]/u;

interface CompactEmoji {
  hexcode: string;
  label: string;
  order?: number;
  tags?: string[];
  unicode: string;
}

interface VersionedEmoji {
  hexcode: string;
  version: number;
}

export interface EmojiEntry {
  emoji: string;
  labels: string[];
  /** 展示名称。中文数据先写入，因此优先是中文名。 */
  name: string;
  /** emojibase 序号。没有序号的区域字母用最大值，排到最后。 */
  order: number;
  tags: string[];
}

/** 前缀最多 16 个 UTF-16 码元，与契约里的 titlePrefix 上限一致。 */
export function isSelectableEmoji(emoji: string) {
  return emoji.length > 0 && emoji.length <= maxPrefixLength && !skinTone.test(emoji);
}

function normalize(text: string) {
  return text.trim().toLowerCase().replaceAll(/\s+/g, "");
}

function remember(catalog: Map<string, EmojiEntry>, entry: CompactEmoji, allowed: ReadonlySet<string>) {
  if (!allowed.has(entry.hexcode) || !isSelectableEmoji(entry.unicode)) {
    return;
  }

  const current = catalog.get(entry.unicode) ?? {
    emoji: entry.unicode,
    name: entry.label,
    labels: [],
    tags: [],
    order: entry.order ?? Number.MAX_SAFE_INTEGER,
  };
  if (typeof entry.order === "number") {
    current.order = Math.min(current.order, entry.order);
  }

  const label = normalize(entry.label);
  if (label) {
    current.labels.push(label);
  }

  for (const tag of entry.tags ?? []) {
    const normalized = normalize(tag);
    if (normalized) {
      current.tags.push(normalized);
    }
  }

  catalog.set(entry.unicode, current);
}

let catalogPromise: Promise<EmojiEntry[]> | undefined;
let paintablePromise: Promise<EmojiEntry[]> | undefined;

/** 供测试核对目录里的字符属于哪一版。键是表情字符。 */
export function loadEmojiVersions() {
  return import("emojibase-data/en/data.json").then(
    versions => new Map(versions.default.map(item => [item.emoji, item.version]))
  );
}

function allowedHexcodes(entries: readonly VersionedEmoji[]) {
  const allowed = new Set<string>();
  for (const entry of entries) {
    if (entry.version <= maxEmojiVersion) {
      allowed.add(entry.hexcode);
    }
  }

  return allowed;
}

/** 加载中英文名称和标签，搜索不访问网络。目录停在 Emoji 12.0。 */
export function loadEmojiCatalog() {
  catalogPromise ??= Promise.all([
    import("emojibase-data/zh/compact.json"),
    import("emojibase-data/en/compact.json"),
    import("emojibase-data/en/data.json"),
  ]).then(([zh, en, versions]) => {
    const allowed = allowedHexcodes(versions.default);
    const catalog = new Map<string, EmojiEntry>();
    for (const entry of [...zh.default, ...en.default]) {
      remember(catalog, entry, allowed);
    }

    // 按 Unicode 常用顺序排列，笑脸在前。没有序号的区域字母放到最后。
    return [...catalog.values()].sort((left, right) => left.order - right.order);
  });

  return catalogPromise;
}

/** 只有新表情、肤色以外的组合和区旗可能在当前字体里画不出来。 */
function needsGlyphCheck(emoji: string) {
  for (const char of emoji) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x200d || code >= 0x1fa00 || (code >= 0xe0020 && code <= 0xe007f)) {
      return true;
    }
  }

  return false;
}

/** 表单出现时就开始准备。第一次点表情时直接用这份结果，不再临场逐个画图。 */
export function loadPaintableEmojiCatalog() {
  paintablePromise ??= loadEmojiCatalog().then(async entries => {
    const suspects = entries.filter(entry => needsGlyphCheck(entry.emoji));
    // 组合表情要和它退回的基础表情画在一起，才能发现「断链」其实画成了「链条」。
    const bases = entries.filter(
      entry => !needsGlyphCheck(entry.emoji) && suspects.some(suspect => suspect.emoji.startsWith(entry.emoji))
    );
    const compared = [...suspects, ...bases];
    const signatures = await readGlyphSignatures(compared.map(entry => entry.emoji));
    const byEmoji = new Map(compared.map((entry, index) => [entry.emoji, signatures[index]]));
    return omitUnpaintedEmojis(entries, emoji => byEmoji.get(emoji) ?? { colorless: false, id: emoji, ink: 1 });
  });

  return paintablePromise;
}

export interface GlyphSignature {
  /** 没有彩色像素。空白方块是灰度的，正常彩色表情不是。 */
  colorless: boolean;
  id: string;
  ink: number;
}

/**
 * 当前字体画不出的表情会共用同一张图。
 * 整组都是空白方块时全部去掉；彩色组里只留下最短的那个，例如链条，去掉画成同一张图的断链。
 */
export function omitUnpaintedEmojis(entries: readonly EmojiEntry[], signatureOf: (emoji: string) => GlyphSignature) {
  const groups = new Map<string, { colorless: boolean; entries: EmojiEntry[] }>();
  const hidden = new Set<string>();
  for (const entry of entries) {
    const signature = signatureOf(entry.emoji);
    if (signature.ink === 0) {
      hidden.add(entry.emoji);
      continue;
    }

    const group = groups.get(signature.id);
    if (group) {
      group.entries.push(entry);
    } else {
      groups.set(signature.id, { colorless: signature.colorless, entries: [entry] });
    }
  }

  for (const group of groups.values()) {
    if (group.entries.length < 2) {
      continue;
    }

    if (group.colorless) {
      for (const entry of group.entries) {
        hidden.add(entry.emoji);
      }

      continue;
    }

    const keeper = group.entries.reduce((best, entry) => (entry.emoji.length < best.emoji.length ? entry : best));
    for (const entry of group.entries) {
      if (entry !== keeper) {
        hidden.add(entry.emoji);
      }
    }
  }

  return entries.filter(entry => !hidden.has(entry.emoji));
}

const glyphCell = 40;
const glyphColumns = 12;
const glyphChunk = 400;

/**
 * 把表情画进同一张图，只读一次像素。分批绘制，避免打开表单时主线程停住。
 * 没有画布时每个表情视为可显示。
 */
export function readGlyphSignatures(emojis: readonly string[]) {
  if (typeof document === "undefined" || emojis.length === 0) {
    return Promise.resolve(emojis.map(fallbackSignature));
  }

  const canvas = document.createElement("canvas");
  const rows = Math.ceil(emojis.length / glyphColumns);
  canvas.width = glyphColumns * glyphCell;
  canvas.height = rows * glyphCell;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return Promise.resolve(emojis.map(fallbackSignature));
  }

  context.font = '22px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  context.textBaseline = "middle";
  context.fillStyle = "#000";

  return new Promise<GlyphSignature[]>(resolve => {
    let index = 0;
    const drawChunk = () => {
      const end = Math.min(index + glyphChunk, emojis.length);
      for (; index < end; index += 1) {
        const column = index % glyphColumns;
        const row = Math.floor(index / glyphColumns);
        context.fillText(emojis[index] ?? "", column * glyphCell + 2, row * glyphCell + glyphCell / 2);
      }

      if (index < emojis.length) {
        setTimeout(drawChunk, 0);
        return;
      }

      const { data, width } = context.getImageData(0, 0, canvas.width, canvas.height);
      resolve(emojis.map((_, emojiIndex) => signatureAt(data, width, emojiIndex)));
    };

    drawChunk();
  });
}

function fallbackSignature(emoji: string): GlyphSignature {
  return { colorless: false, id: emoji, ink: 1 };
}

function signatureAt(data: Uint8ClampedArray, width: number, emojiIndex: number): GlyphSignature {
  const column = emojiIndex % glyphColumns;
  const row = Math.floor(emojiIndex / glyphColumns);
  const originX = column * glyphCell;
  const originY = row * glyphCell;
  let color = 0;
  let ink = 0;
  let hashA = 2166136261;
  let hashB = 2166136261;
  for (let y = 0; y < glyphCell; y += 1) {
    let offset = ((originY + y) * width + originX) * 4;
    for (let x = 0; x < glyphCell; x += 1) {
      const red = data[offset] ?? 0;
      const green = data[offset + 1] ?? 0;
      const blue = data[offset + 2] ?? 0;
      const alpha = data[offset + 3] ?? 0;
      offset += 4;
      if (alpha > 10) {
        ink += 1;
        if (Math.abs(red - green) > 18 || Math.abs(red - blue) > 18) {
          color += 1;
        }
      }

      hashA ^= red + (green << 8);
      hashA = Math.imul(hashA, 16777619);
      hashB ^= blue + (alpha << 8);
      hashB = Math.imul(hashB, 16777619);
    }
  }

  return { colorless: color === 0, id: `${hashA >>> 0}-${hashB >>> 0}`, ink };
}

/** 按固定行高算出当前该挂载的行。多留几行，滚动时不用每个像素都重绘。 */
export function visibleRowRange(
  itemCount: number,
  scrollTop: number,
  viewportHeight: number,
  columns: number,
  rowStride: number,
  overscan = 2
) {
  const rowCount = itemCount === 0 ? 0 : Math.ceil(itemCount / columns);
  const start = Math.max(0, Math.floor(scrollTop / rowStride) - overscan);
  const end = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / rowStride) + overscan);
  return { end, rowCount, start, totalHeight: rowCount * rowStride };
}

/** 名称命中排在标签命中前面。空关键词由界面直接展示全部可选表情。 */
export function searchEmojis(catalog: readonly EmojiEntry[], query: string) {
  const needle = normalize(query);
  if (!needle) {
    return [];
  }

  const byName: EmojiEntry[] = [];
  const byTag: EmojiEntry[] = [];
  for (const entry of catalog) {
    if (entry.labels.some(label => label.includes(needle))) {
      byName.push(entry);
    } else if (entry.tags.some(tag => tag.includes(needle))) {
      byTag.push(entry);
    }
  }

  return [...byName, ...byTag].slice(0, maxSearchResults);
}
