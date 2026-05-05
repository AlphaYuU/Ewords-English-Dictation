import type { Accent, DictationResult } from "@dictation/domain";

export type ResultFilter = "all" | "correct" | "wrong" | "wrong_book" | "favorite";

export function filterDictationResults(results: DictationResult[], filter: ResultFilter) {
  if (filter === "correct") return results.filter((row) => row.result === "correct");
  if (filter === "wrong") return results.filter((row) => row.result === "wrong" || row.result === "skipped" || row.result === "unmarked");
  if (filter === "wrong_book") return results.filter((row) => row.isAddedToWrongBook);
  if (filter === "favorite") return results.filter((row) => row.isFavorited);
  return results;
}

export function resultSummaryMeta(sourceName: string, modeLabel: "打字" | "纸笔", accent: Accent, timestamp?: number): string[] {
  const date = formatResultDate(timestamp);
  return [
    `来源：${sourceName}`,
    `模式：${modeLabel} · 发音：${accent === "uk" ? "英音" : "美音"}${date ? ` · ${date}` : ""}`,
  ];
}

function formatResultDate(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "/");
}
