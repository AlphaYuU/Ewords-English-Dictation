import type { DictationResult, DictationSummary } from "../models/types";

export function summarizeResults(results: DictationResult[], durationSec = 0): DictationSummary {
  const correctCount = results.filter((row) => row.result === "correct").length;
  const wrongCount = results.filter((row) => row.result === "wrong" || row.result === "skipped" || row.result === "unmarked").length;
  const skippedCount = results.filter((row) => row.result === "skipped").length;
  const unmarkedCount = results.filter((row) => row.result === "unmarked").length;
  const total = results.length;
  const accuracy = total === 0 ? 0 : Math.round((correctCount / total) * 1000) / 10;
  return { total, correctCount, wrongCount, skippedCount, unmarkedCount, accuracy, durationSec };
}
