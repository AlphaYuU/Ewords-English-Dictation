import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { DictationSummary, HistoryItem, LibraryType, VocabularyWord } from "@dictation/domain";
import { Button } from "./primitives";
import { Icon, IconButton } from "./primitives";

export type LibraryCardViewModel = {
  id: number;
  title: string;
  subtitle?: string;
  label?: string;
  type: LibraryType | "empty";
  wordCount: number;
  progress?: number;
  accuracy?: number;
  coverColor?: string;
};

export function LibraryCard({
  library,
  onClick,
  action,
}: {
  library: LibraryCardViewModel;
  onClick?: () => void;
  action?: ReactNode;
}) {
  const variant = library.type === "wrong_book" || library.type === "favorite" ? "system" : library.type;
  if (variant === "system") {
    return (
      <article
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter") onClick?.();
        }}
        className={`library-card ${variant}`}
        style={{ "--card-color": library.coverColor } as CSSProperties}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
          <span className="icon-button icon-button-lg" style={{ boxShadow: "none" }}>
            <Icon name={library.type === "favorite" ? "star" : "alert"} />
          </span>
          <span>
            <strong style={{ display: "block", fontSize: 18 }}>{library.title}</strong>
            <span style={{ fontSize: 13, opacity: 0.85 }}>{library.subtitle}</span>
          </span>
        </span>
        {action}
      </article>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`library-card ${variant}`}
      style={{ "--card-color": library.coverColor } as CSSProperties}
    >
      <span className="library-label">{library.label}</span>
      <h3 className="library-title">{library.title}</h3>
      {library.progress ? (
        <div style={{ width: "84%", marginTop: 58 }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${library.progress}%`, background: "rgba(255,255,255,0.9)" }} />
          </div>
        </div>
      ) : null}
      <span className="library-meta">{library.subtitle ?? `${library.wordCount} 词`}</span>
    </button>
  );
}

export function EmptyLibraryCard({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className="library-card empty" onClick={onClick}>
      <Icon name="plus" size={30} />
      <strong style={{ marginTop: 18 }}>新建词库</strong>
      <span className="library-meta" style={{ marginTop: 8 }}>
        或导入 Excel / CSV
      </span>
    </button>
  );
}

export function WordTable({
  words,
  activeId,
  actionLabel = "移出",
  onWordClick,
  onFavorite,
  onAction,
  variant = "library",
  visibleRows = 10,
}: {
  words: VocabularyWord[];
  activeId?: number;
  actionLabel?: string;
  onWordClick?: (word: VocabularyWord) => void;
  onFavorite?: (word: VocabularyWord) => void;
  onAction?: (word: VocabularyWord) => void;
  variant?: "library" | "result";
  visibleRows?: number;
}) {
  const rowHeight = 46;
  const overscan = 5;
  const [scrollTop, setScrollTop] = useState(0);
  const shouldVirtualize = words.length > visibleRows;
  const range = useMemo(() => {
    if (!shouldVirtualize) return { start: 0, end: words.length };
    const maxStart = Math.max(0, words.length - visibleRows - overscan * 2 - 2);
    const start = Math.min(Math.max(0, Math.floor(scrollTop / rowHeight) - overscan), maxStart);
    const end = Math.min(words.length, start + visibleRows + overscan * 2 + 2);
    return { start, end };
  }, [scrollTop, shouldVirtualize, visibleRows, words.length]);
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
        className={`word-table-body ${shouldVirtualize ? "is-virtualized" : ""}`}
        style={shouldVirtualize ? { height: rowHeight * visibleRows } : undefined}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
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

export function HistoryTable({ items, onOpen, onDelete }: { items: HistoryItem[]; onOpen?: (item: HistoryItem) => void; onDelete?: (item: HistoryItem) => void }) {
  return (
    <div className="history-table">
      <div className="history-table-header history-table-grid">
        <span>来源</span>
        <span>词数</span>
        <span>时长</span>
        <span>正确率</span>
        <span>操作</span>
      </div>
      <div className="history-table-body">
        {items.map((item) => (
          <div
            role="button"
            tabIndex={0}
            key={item.sessionId}
            onClick={() => onOpen?.(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onOpen?.(item);
            }}
            className="history-table-row history-table-grid"
          >
            <span className="history-source-cell">
              <strong>{item.sourceName}</strong>
              <small>{item.mode === "typing" ? "打字模式" : "纸笔模式"} · {item.accent.toUpperCase()} · {formatHistoryDate(item.endedAt)}</small>
            </span>
            <span>{item.total}</span>
            <span>{Math.floor(item.durationSec / 60)}:{String(item.durationSec % 60).padStart(2, "0")}</span>
            <span>
              <span style={{ color: accuracyColor(item.accuracy) }}>{item.accuracy}%</span>
              <span className="progress-track" style={{ display: "inline-block", width: 46, height: 6, marginLeft: 8, verticalAlign: "middle" }}>
                <span className="progress-fill" style={{ display: "block", width: `${item.accuracy}%`, background: accuracyColor(item.accuracy) }} />
              </span>
            </span>
            <span>
              <IconButton
                icon="trash"
                size="sm"
                label="删除历史"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete?.(item);
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatHistoryDate(timestamp: number): string {
  const date = new Date(timestamp);
  const reference = new Date(Date.now());
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const referenceDay = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
  const dayDiff = Math.round((referenceDay - dateDay) / 86400000);
  const monthDay = date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  const time = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (dayDiff === 0) return `今天 ${time}`;
  if (dayDiff === 1) return `昨天 ${time}`;
  return `${monthDay.replace("/", "-")} ${time}`;
}

export function SettingItem({
  title,
  description,
  value,
  control,
  onClick,
}: {
  title: string;
  description?: string;
  value?: ReactNode;
  control?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="setting-item" onClick={onClick} style={{ width: "100%", background: "transparent", borderLeft: 0, borderRight: 0, borderTop: 0, textAlign: "left" }}>
      <span>
        <strong>{title}</strong>
        {description ? <span className="word-row-sub" style={{ display: "block" }}>{description}</span> : null}
      </span>
      <span>{control ?? value}</span>
    </button>
  );
}

export function DictationResultSummary({ summary, meta }: { summary: DictationSummary; meta: string | string[] }) {
  const metaLines = Array.isArray(meta) ? meta : meta.split(/\n|<br\s*\/?>/i);
  return (
    <div className={`result-summary ${summaryToneClass(summary.accuracy)}`}>
      <div>
        <strong>{Math.round(summary.accuracy)}%</strong>
        <span>正确率</span>
      </div>
      <div><h2>{summary.correctCount}</h2><span>正确</span></div>
      <div><h2>{summary.wrongCount}</h2><span>错误</span></div>
      <div><h2>{summary.total}</h2><span>词数</span></div>
      <div><h2>{Math.floor(summary.durationSec / 60)}:{String(summary.durationSec % 60).padStart(2, "0")}</h2><span>用时</span></div>
      <div className="result-summary-meta">
        {metaLines.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}
      </div>
    </div>
  );
}

function accuracyColor(accuracy: number): string {
  if (accuracy >= 80) return "var(--accent-success)";
  if (accuracy >= 60) return "var(--accent-warning)";
  return "var(--accent-error)";
}

function summaryToneClass(accuracy: number): string {
  if (accuracy >= 80) return "result-summary-success";
  if (accuracy >= 60) return "result-summary-warning";
  return "result-summary-danger";
}
