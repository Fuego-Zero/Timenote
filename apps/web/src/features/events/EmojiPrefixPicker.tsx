import { Button, Input, Popover, Space, theme } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import "./emoji-prefix-picker.css";
import { type EmojiEntry, loadPaintableEmojiCatalog, searchEmojis, visibleRowRange } from "./emojiSearch.js";

const columns = 8;
const rowStride = 42;
const viewportHeight = 280;

function EmojiGrid({
  entries,
  onActive,
  onPick,
}: {
  entries: readonly EmojiEntry[];
  onActive: (entry: EmojiEntry) => void;
  onPick: (emoji: string) => void;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const { end, start, totalHeight } = visibleRowRange(entries.length, scrollTop, viewportHeight, columns, rowStride);

  const rows = Array.from({ length: end - start }, (_, index) => {
    const row = start + index;
    const from = row * columns;
    return (
      <div key={row} className="emoji-prefix-row" style={{ transform: `translateY(${row * rowStride}px)` }}>
        {entries.slice(from, from + columns).map(entry => (
          <button
            key={entry.emoji}
            className="emoji-prefix-cell"
            type="button"
            aria-label={entry.name}
            onClick={() => onPick(entry.emoji)}
            onFocus={() => onActive(entry)}
            onMouseEnter={() => onActive(entry)}
          >
            {entry.emoji}
          </button>
        ))}
      </div>
    );
  });

  return (
    <div
      className="emoji-prefix-grid"
      onScroll={event => {
        const next = event.currentTarget.scrollTop;
        setScrollTop(current => (Math.floor(current / rowStride) === Math.floor(next / rowStride) ? current : next));
      }}
    >
      <div className="emoji-prefix-canvas" style={{ height: totalHeight }}>
        {rows}
      </div>
    </div>
  );
}

/** 标题前缀的表情选择。不搜索时列出全部可选表情，点选替换整个前缀。 */
export function EmojiPrefixPicker({ onChange }: { onChange: (prefix: string) => void }) {
  const { t } = useTranslation("events");
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<EmojiEntry[]>();
  const glyphRef = useRef<HTMLSpanElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const hint = t("titleFields.emojiHover");

  useEffect(() => {
    let alive = true;
    void loadPaintableEmojiCatalog().then(entries => {
      if (alive) {
        setCatalog(entries);
      }
    });

    return () => {
      alive = false;
    };
  }, []);

  function paintPreview(entry?: EmojiEntry) {
    const glyph = glyphRef.current;
    const name = nameRef.current;
    if (!glyph || !name) {
      return;
    }

    glyph.textContent = entry?.emoji ?? "";
    name.textContent = entry?.name ?? hint;
    name.classList.toggle("is-hint", !entry);
  }

  useEffect(() => {
    const name = nameRef.current;
    const glyph = glyphRef.current;
    if (!name || !glyph || glyph.textContent) {
      return;
    }

    name.textContent = hint;
    name.classList.add("is-hint");
  }, [hint, open]);

  const filtering = query.trim().length > 0;
  let visible: EmojiEntry[] = [];
  if (catalog) {
    visible = filtering ? searchEmojis(catalog, query) : catalog;
  }

  function pick(prefix: string) {
    onChange(prefix);
    setOpen(false);
    setQuery("");
    paintPreview();
  }

  return (
    <Popover
      content={
        <Space orientation="vertical" style={{ width: 336 }}>
          <Input
            allowClear
            placeholder={t("titleFields.emojiSearch")}
            value={query}
            aria-label={t("titleFields.emojiSearch")}
            onChange={event => {
              setQuery(event.target.value);
              paintPreview();
            }}
          />
          <div className="emoji-prefix-preview" style={{ background: token.colorFillQuaternary }}>
            <span ref={glyphRef} className="emoji-prefix-preview-glyph" />
            <span ref={nameRef} className="emoji-prefix-preview-name is-hint" />
          </div>
          {!catalog ? <span className="emoji-prefix-preview-name is-hint">{t("titleFields.emojiLoading")}</span> : null}
          {catalog && visible.length === 0 ? (
            <span className="emoji-prefix-preview-name is-hint">{t("titleFields.emojiEmpty")}</span>
          ) : null}
          {visible.length > 0 ? (
            <EmojiGrid key={query} entries={visible} onActive={paintPreview} onPick={pick} />
          ) : null}
          <Button size="small" type="link" onClick={() => pick("")}>
            {t("titleFields.noPrefix")}
          </Button>
        </Space>
      }
      open={open}
      trigger="click"
      onOpenChange={setOpen}
    >
      <Button aria-label={t("titleFields.emojiAria")}>{t("titleFields.emoji")}</Button>
    </Popover>
  );
}
