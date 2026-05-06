import type { DictationSummary } from "@dictation/domain";

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

function summaryToneClass(accuracy: number): string {
  if (accuracy >= 80) return "result-summary-success";
  if (accuracy >= 60) return "result-summary-warning";
  return "result-summary-danger";
}
