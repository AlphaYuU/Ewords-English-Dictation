import type { HistoryItem } from "@dictation/domain";
import { IconButton } from "../primitives";

export function HistoryTable({ items, onOpen, onDelete }: { items: HistoryItem[]; onOpen?: (item: HistoryItem) => void; onDelete?: (item: HistoryItem) => void }) {
  return (
    <div className="history-table">
      <div className="history-table-header history-table-grid">
        <span>来源</span>
        <span>词数</span>
        <span>时长</span>
        <span>正确率</span>
        <span>删除</span>
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

function accuracyColor(accuracy: number): string {
  if (accuracy >= 80) return "var(--accent-success)";
  if (accuracy >= 60) return "var(--accent-warning)";
  return "var(--accent-error)";
}
