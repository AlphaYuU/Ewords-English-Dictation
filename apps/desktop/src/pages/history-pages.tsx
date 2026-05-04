import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { DictationResult, HistoryItem } from "@dictation/domain";
import { Button, Chip, DictationResultSummary, EmptyState, HistoryTable, Icon, NoticeDialog, SearchBar } from "@dictation/ui";
import { summarizeResults } from "@dictation/domain";
import { exportHistoryCsv } from "@dictation/import-export";
import { useHistoryStore } from "../stores/history-store";
import { saveTextFile } from "../services/desktop-bridge";

export function HistoryPage() {
  const navigate = useNavigate();
  const history = useHistoryStore((state) => state.history);
  const results = useHistoryStore((state) => state.results);
  const deleteHistory = useHistoryStore((state) => state.deleteHistory);
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<HistoryItem | null>(null);
  const [trendMode, setTrendMode] = useState<"days" | "sessions">("days");
  const [trendDays, setTrendDays] = useState<7 | 14 | 30>(14);
  const [trendSessionCount, setTrendSessionCount] = useState<10 | 20 | 30>(10);
  const [openTrendMenu, setOpenTrendMenu] = useState<"days" | "sessions" | null>(null);
  const trendControlsRef = useRef<HTMLDivElement>(null);
  const [todayStart] = useState(() => startOfToday(Date.now()));
  const filteredHistory = useMemo(() => filterHistory(history, results, query), [history, query, results]);
  useEffect(() => {
    if (!openTrendMenu) return;
    const closeMenu = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && trendControlsRef.current?.contains(target)) return;
      setOpenTrendMenu(null);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [openTrendMenu]);
  if (!history.length) return <HistoryEmptyPage />;
  const totalWords = history.reduce((sum, item) => sum + item.total, 0);
  const totalCorrect = history.reduce((sum, item) => sum + item.correctCount, 0);
  const weeklyDuration = history
    .filter((item) => item.endedAt >= todayStart - 6 * 86400000)
    .reduce((sum, item) => sum + item.durationSec, 0);
  const averageAccuracy = totalWords ? Math.round((totalCorrect / totalWords) * 1000) / 10 : 0;
  const streakDays = calculateStreakDays(history);
  const trend = trendMode === "days" ? buildDailyAccuracyTrend(history, todayStart, trendDays) : buildSessionAccuracyTrend(history, trendSessionCount);
  const trendTitle = trendMode === "days" ? `正确率趋势 · 近 ${trendDays} 天` : `正确率趋势 · 近 ${trendSessionCount} 次`;
  return (
    <div className="history-page">
      <header className="page-topbar" style={{ marginBottom: 18 }}>
        <div><h1 className="page-title">听写历史</h1></div>
        <Button variant="ghost" size="sm" iconStart={<Icon name="download" />} onClick={() => void saveTextFile("dictation-history.csv", exportHistoryCsv(results))}>导出</Button>
      </header>
      <section className="history-stats-grid">
        <StatCard title="连续天数" value={`${streakDays}`} note="天 · 来自最近记录" accent />
          <StatCard title="总次数" value={history.length.toLocaleString()} note="次 · 已听写" />
        <StatCard title="平均正确率" value={`${averageAccuracy}%`} note="按已批改结果计算" />
        <StatCard title="本周练习时长" value={formatDuration(weeklyDuration)} note="累计听写时长" />
      </section>
      <section className="history-trend-card">
        <div className="history-trend-header">
          <div className="history-trend-title-row">
            <h3>{trendTitle}</h3>
            <div className="history-trend-controls" ref={trendControlsRef}>
              <TrendDropdown
                active={trendMode === "days"}
                label="天数"
                value={`${trendDays}天`}
                open={openTrendMenu === "days"}
                options={[
                  { label: "7天", value: 7 },
                  { label: "14天", value: 14 },
                  { label: "30天", value: 30 },
                ]}
                onActivate={() => {
                  setTrendMode("days");
                  setOpenTrendMenu(null);
                }}
                onMenuToggle={() => {
                  setOpenTrendMenu((menu) => (menu === "days" ? null : "days"));
                }}
                onSelect={(value) => {
                  setTrendDays(value as 7 | 14 | 30);
                  setTrendMode("days");
                  setOpenTrendMenu(null);
                }}
              />
              <TrendDropdown
                active={trendMode === "sessions"}
                label="次数"
                value={`${trendSessionCount}次`}
                open={openTrendMenu === "sessions"}
                options={[
                  { label: "10次", value: 10 },
                  { label: "20次", value: 20 },
                  { label: "30次", value: 30 },
                ]}
                onActivate={() => {
                  setTrendMode("sessions");
                  setOpenTrendMenu(null);
                }}
                onMenuToggle={() => {
                  setOpenTrendMenu((menu) => (menu === "sessions" ? null : "sessions"));
                }}
                onSelect={(value) => {
                  setTrendSessionCount(value as 10 | 20 | 30);
                  setTrendMode("sessions");
                  setOpenTrendMenu(null);
                }}
              />
            </div>
          </div>
          <span>从左往右代表时间由远到近</span>
        </div>
        <div className="history-trend-bars" style={{ gridTemplateColumns: `repeat(${trend.length}, minmax(0, 1fr))` }}>
          {trend.map((item) => (
            <div
              key={item.key}
              title={item.hasData ? `${item.label} ${item.accuracy}%` : `${item.label} 暂无批改数据`}
              style={{
                height: trendBarHeight(item),
                borderRadius: 6,
                background: item.hasData ? accuracyColor(item.accuracy) : "transparent",
              }}
            />
          ))}
        </div>
      </section>
      <section className="history-record-card">
        <div className="history-record-header">
          <h2>近期听写记录</h2>
          <div style={{ width: 220 }}>
            <SearchBar variant="dialog" value={query} onChange={setQuery} placeholder="搜索词库 / 单词" />
          </div>
        </div>
        {filteredHistory.length ? (
          <HistoryTable items={filteredHistory} onOpen={(item) => navigate(`/history/${item.sessionId}`)} onDelete={setPendingDelete} />
        ) : (
          <div className="history-empty-filter">没有找到匹配的听写记录。</div>
        )}
      </section>
      <NoticeDialog
        open={Boolean(pendingDelete)}
        title="删除听写历史？"
        description="删除后不可恢复，该记录和对应结果都会被移除。"
        danger
        confirmText="删除"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) deleteHistory(pendingDelete.sessionId);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

function TrendDropdown({
  active,
  label,
  value,
  open,
  options,
  onActivate,
  onMenuToggle,
  onSelect,
}: {
  active: boolean;
  label: string;
  value: string;
  open: boolean;
  options: { label: string; value: number }[];
  onActivate: () => void;
  onMenuToggle: () => void;
  onSelect: (value: number) => void;
}) {
  return (
    <div className="history-trend-select-wrap">
      <div className={`history-trend-select-button ${active ? "is-active" : ""}`}>
        <button type="button" className="history-trend-select-main" onClick={onActivate}>
          <span>{label}</span>
          <strong>{value}</strong>
        </button>
        <button type="button" className="history-trend-select-arrow" aria-label={`选择${label}`} onClick={onMenuToggle}>
          <Icon name="chevronDown" size={14} />
        </button>
      </div>
      {open ? (
        <div className="history-trend-menu">
          {options.map((option) => (
            <button type="button" key={option.value} onClick={() => onSelect(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function filterHistory(history: HistoryItem[], results: DictationResult[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return history;
  return history.filter((item) => {
    const haystack = [
      item.sourceName,
      item.mode === "typing" ? "打字" : "纸笔",
      item.accent === "uk" ? "英音" : "美音",
      String(item.sessionId),
      new Date(item.endedAt).toLocaleDateString("zh-CN"),
    ]
      .join(" ")
      .toLowerCase();
    if (haystack.includes(normalized)) return true;
    return results.some((result) => result.sessionId === item.sessionId && `${result.word} ${result.correctAnswer} ${result.meaning} ${result.userAnswer ?? ""}`.toLowerCase().includes(normalized));
  });
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function startOfToday(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function calculateStreakDays(history: HistoryItem[]): number {
  const days = new Set(history.map((item) => startOfToday(item.endedAt)));
  if (!days.size) return 0;
  let cursor = Math.max(...days);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 86400000;
  }
  return streak;
}

type TrendPoint = {
  key: string;
  label: string;
  accuracy: number;
  hasData: boolean;
};

function buildDailyAccuracyTrend(history: HistoryItem[], today: number, days: 7 | 14 | 30): TrendPoint[] {
  return Array.from({ length: days }, (_, index) => {
    const day = today - (days - 1 - index) * 86400000;
    const items = history.filter((item) => startOfToday(item.endedAt) === day);
    const total = items.reduce((sum, item) => sum + gradedResultCount(item), 0);
    const correct = items.reduce((sum, item) => sum + item.correctCount, 0);
    const accuracy = total ? Math.round((correct / total) * 1000) / 10 : 0;
    return {
      key: String(day),
      label: new Date(day).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }),
      accuracy,
      hasData: total > 0,
    };
  });
}

function buildSessionAccuracyTrend(history: HistoryItem[], count: 10 | 20 | 30): TrendPoint[] {
  const sessions = history
    .slice()
    .sort((left, right) => left.endedAt - right.endedAt)
    .slice(-count)
    .map((item) => {
      const total = gradedResultCount(item);
      return {
        key: String(item.sessionId),
        label: new Date(item.endedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
        accuracy: total ? Math.round((item.correctCount / total) * 1000) / 10 : 0,
        hasData: total > 0,
      };
    });
  const padding = Array.from({ length: Math.max(0, count - sessions.length) }, (_, index) => ({
    key: `empty-${count}-${index}`,
    label: "暂无记录",
    accuracy: 0,
    hasData: false,
  }));
  return [...padding, ...sessions];
}

function gradedResultCount(item: HistoryItem): number {
  return item.correctCount + item.wrongCount + item.skippedCount;
}

function trendBarHeight(item: TrendPoint): string {
  if (!item.hasData) return "0%";
  if (item.accuracy <= 0) return "4%";
  return `${Math.max(0, Math.min(100, item.accuracy))}%`;
}

function accuracyColor(accuracy: number): string {
  if (accuracy >= 80) return "var(--accent-success)";
  if (accuracy >= 60) return "var(--accent-warning)";
  return "var(--accent-error)";
}

function formatHistoryDetailDate(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "/");
}

function StatCard({ title, value, note, accent }: { title: string; value: string; note: string; accent?: boolean }) {
  return (
    <div style={{ height: 120, padding: "18px 20px 16px", border: "1px solid var(--border-subtle)", borderRadius: 12, background: accent ? "var(--accent-primary)" : "var(--surface-card)", color: accent ? "var(--foreground-inverse)" : "var(--foreground-primary)", overflow: "hidden" }}>
      <p style={{ margin: "0 0 18px", color: accent ? "var(--foreground-inverse)" : "var(--accent-primary)" }}>{title}</p>
      <strong style={{ fontSize: 38, lineHeight: 1 }}>{value}</strong>
      <span style={{ marginLeft: 8, color: accent ? "rgba(255,255,255,0.78)" : "var(--accent-success)", fontSize: 12 }}>{note}</span>
    </div>
  );
}

export function HistoryDetailPage() {
  const { sessionId = "5000" } = useParams();
  const navigate = useNavigate();
  const allResults = useHistoryStore((state) => state.results);
  const history = useHistoryStore((state) => state.history);
  const sessions = useHistoryStore((state) => state.sessions);
  const results = useMemo(() => allResults.filter((row) => row.sessionId === Number(sessionId)), [allResults, sessionId]);
  const historyItem = useMemo(() => history.find((item) => item.sessionId === Number(sessionId)), [history, sessionId]);
  const session = useMemo(() => sessions.find((item) => item.id === Number(sessionId)), [sessionId, sessions]);
  const deleteHistory = useHistoryStore((state) => state.deleteHistory);
  const setPracticeSource = useHistoryStore((state) => state.setPracticeSource);
  const [filter, setFilter] = useState<"all" | "correct" | "wrong">("all");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const summary = summarizeResults(results, historyItem?.durationSec ?? session?.durationSec ?? 0);
  const filteredResults = useMemo(() => {
    if (filter === "correct") return results.filter((result) => result.result === "correct");
    if (filter === "wrong") return results.filter((result) => result.result === "wrong" || result.result === "skipped" || result.result === "unmarked");
    return results;
  }, [filter, results]);
  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(-1)}>‹ 听写历史 / #{sessionId}</button>
      <DictationResultSummary
        summary={summary}
        meta={[
          `来源：${historyItem?.sourceName ?? session?.sourceName ?? "听写"}`,
          `模式：${(historyItem?.mode ?? session?.mode) === "paper" ? "纸笔" : "打字"} · 发音：${(historyItem?.accent ?? session?.accent) === "uk" ? "英音" : "美音"} · ${formatHistoryDetailDate(historyItem?.endedAt ?? session?.completedAt ?? session?.createdAt)}`,
        ]}
      />
      <div className="toolbar-row">
        <div className="page-actions">
          <Button variant="primary" size="sm" onClick={() => { setPracticeSource({ sourceType: "history_session", sourceId: Number(sessionId) }); navigate(`/practice/setup?source_type=history_session&source_id=${sessionId}`); }}>重听本组</Button>
          <Button variant="secondary" size="sm" onClick={() => { setPracticeSource({ sourceType: "history_session", sourceId: Number(sessionId), filter: "wrong" }); navigate(`/practice/setup?source_type=history_session&source_id=${sessionId}&filter=wrong`); }}>重听错词</Button>
          <Button variant="ghost" size="sm" iconStart={<Icon name="download" />} onClick={() => void saveTextFile(`dictation-history-${sessionId}.csv`, exportHistoryCsv(results))}>导出历史</Button>
        </div>
        <Button variant="danger" size="sm" iconStart={<Icon name="trash" />} onClick={() => setConfirmDeleteOpen(true)}>删除历史</Button>
      </div>
      <div className="toolbar-row" style={{ justifyContent: "flex-start" }}>
        <Chip selected={filter === "all"} onClick={() => setFilter("all")}>全部</Chip>
        <Chip selected={filter === "correct"} onClick={() => setFilter("correct")}>正确</Chip>
        <Chip selected={filter === "wrong"} onClick={() => setFilter("wrong")}>错误</Chip>
      </div>
      <HistoryResultTable results={filteredResults} />
      <NoticeDialog
        open={confirmDeleteOpen}
        title="删除听写历史？"
        description="删除后不可恢复，该记录和对应结果都会被移除。"
        danger
        confirmText="删除"
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          deleteHistory(Number(sessionId));
          setConfirmDeleteOpen(false);
          navigate("/history");
        }}
      />
    </>
  );
}

function HistoryResultTable({ results }: { results: DictationResult[] }) {
  return (
    <div className="history-result-table">
      <div className="history-result-row history-result-header">
        <span>正确答案</span>
        <span>用户答案</span>
        <span>释义</span>
      </div>
      {results.map((result) => {
        const status = result.result === "correct" ? "correct" : result.result === "wrong" || result.result === "skipped" || result.result === "unmarked" ? "wrong" : "empty";
        return (
          <div key={result.id} className="history-result-row">
            <span className={`result-answer ${status}`}>
              <i />
              <strong>{result.correctAnswer || result.word}</strong>
            </span>
            <span>{result.userAnswer ? `${result.userAnswer}${result.result === "correct" ? " ✓" : ""}` : "空白"}</span>
            <span>{result.meaning}</span>
          </div>
        );
      })}
    </div>
  );
}

export function HistoryEmptyPage() {
  const navigate = useNavigate();
  return <EmptyState title="还没有听写历史" description="完成一次听写后，结果和错词记录会出现在这里。" action={<Button onClick={() => navigate("/practice")}>开始听写</Button>} />;
}
