import { useCallback, useMemo, useRef, useState } from "react";
import type { VocabularyWord } from "@dictation/domain";
import { Button, IconButton } from "../primitives";

export function WordTable({
  words,
  activeId,
  initialScrollTop = 0,
  actionLabel = "移出",
  onWordClick,
  onFavorite,
  onAction,
  onScrollTopChange,
  variant = "library",
  visibleRows = 10,
}: {
  words: VocabularyWord[];
  activeId?: number;
  initialScrollTop?: number;
  actionLabel?: string;
  onWordClick?: (word: VocabularyWord) => void;
  onFavorite?: (word: VocabularyWord) => void;
  onAction?: (word: VocabularyWord) => void;
  onScrollTopChange?: (scrollTop: number) => void;
  variant?: "library" | "result";
  visibleRows?: number;
}) {
  const rowHeight = 46;
  const overscan = 5;
  const shouldVirtualize = words.length > visibleRows;
  const maxScrollTop = shouldVirtualize ? Math.max(0, words.length * rowHeight - visibleRows * rowHeight) : 0;
  const [scrollTop, setScrollTop] = useState(() => clampScrollTop(initialScrollTop, maxScrollTop));
  const restoredScrollRef = useRef(false);
  const bodyRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || restoredScrollRef.current) return;
      node.scrollTop = clampScrollTop(initialScrollTop, maxScrollTop);
      restoredScrollRef.current = true;
    },
    [initialScrollTop, maxScrollTop],
  );
  const clampedScrollTop = clampScrollTop(scrollTop, maxScrollTop);
  const range = useMemo(() => {
    if (!shouldVirtualize) return { start: 0, end: words.length };
    const maxStart = Math.max(0, words.length - visibleRows - overscan * 2 - 2);
    const start = Math.min(Math.max(0, Math.floor(clampedScrollTop / rowHeight) - overscan), maxStart);
    const end = Math.min(words.length, start + visibleRows + overscan * 2 + 2);
    return { start, end };
  }, [clampedScrollTop, shouldVirtualize, visibleRows, words.length]);
  const visibleWords = shouldVirtualize ? words.slice(range.start, range.end) : words;
  return (
    <div className={`word-table ${shouldVirtualize ? "has-scrollbar" : ""}`}>
      <div className="word-table-header">
        <span>★</span>
        <span>{variant === "result" ? "正确答案" : "单词"}</span>
        <span>音标 (US)</span>
        <span>{variant === "result" ? "用户答案" : "释义"}</span>
        <span>错次</span>
        <span>掌握度</span>
        <span>{actionLabel === "移出" ? "删除" : "操作"}</span>
      </div>
      <div
        ref={bodyRef}
        className={`word-table-body ${shouldVirtualize ? "is-virtualized" : ""}`}
        style={shouldVirtualize ? { height: rowHeight * visibleRows } : undefined}
        onScroll={(event) => {
          const nextScrollTop = event.currentTarget.scrollTop;
          setScrollTop(nextScrollTop);
          onScrollTopChange?.(nextScrollTop);
        }}
      >
        <div className="word-table-spacer" style={shouldVirtualize ? { height: words.length * rowHeight } : undefined}>
          {visibleWords.map((word, visibleIndex) => {
            const absoluteIndex = shouldVirtualize ? range.start + visibleIndex : visibleIndex;
            return (
              <div
                role="button"
                tabIndex={0}
                key={word.id}
                className={`word-row ${activeId === word.id ? "is-active" : ""}`}
                style={shouldVirtualize ? { height: rowHeight, transform: `translateY(${absoluteIndex * rowHeight}px)` } : undefined}
                onClick={() => onWordClick?.(word)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onWordClick?.(word);
                }}
              >
                <IconButton
                  icon="star"
                  size="sm"
                  label={word.isFavorite ? "取消收藏" : "收藏"}
                  active={word.isFavorite}
                  onClick={(event) => {
                    event.stopPropagation();
                    onFavorite?.(word);
                  }}
                />
                <div>
                  <span className="word-row-title">{word.word}</span>
                  <span className="word-row-sub">{word.partOfSpeech ?? "adj."}</span>
                </div>
                <span>{word.phonetic ?? "/-"}</span>
                <span>{word.meaning}</span>
                <span>{word.wrongCount}</span>
                <span>
                  <span className="progress-track" style={{ display: "block", width: 90 }}>
                    <span className="progress-fill" style={{ display: "block", width: `${Math.max(0, Math.min(100, word.masteryLevel * 10))}%` }} />
                  </span>
                </span>
                <span className="word-row-action">
                  <Button
                    variant={actionLabel === "移出" ? "danger" : "secondary"}
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAction?.(word);
                    }}
                  >
                    {actionLabel}
                  </Button>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function clampScrollTop(scrollTop: number, maxScrollTop: number): number {
  if (!Number.isFinite(scrollTop)) return 0;
  return Math.max(0, Math.min(maxScrollTop, scrollTop));
}
