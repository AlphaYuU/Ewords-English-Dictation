import type { DictationResult, HistoryItem, VocabularyLibrary, VocabularyWord } from "@dictation/domain";

export function exportLibraryCsv(library: VocabularyLibrary, words: VocabularyWord[]): string {
  const rows = [["library", library.name], [], ["word", "phonetic", "partOfSpeech", "meaning", "favorite", "wrongCount"]];
  for (const word of words) {
    rows.push([
      word.word,
      word.phonetic ?? "",
      word.partOfSpeech ?? "",
      word.meaning,
      word.isFavorite ? "yes" : "no",
      String(word.wrongCount),
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function exportHistoryCsv(results: DictationResult[]): string {
  const rows = [["word", "userAnswer", "correctAnswer", "meaning", "result"]];
  for (const row of results) rows.push([row.word, row.userAnswer ?? "", row.correctAnswer, row.meaning, row.result]);
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
}

export function exportHistoryListCsv(history: HistoryItem[]): string {
  const rows = [["来源", "模式", "发音", "词数", "正确", "错误", "正确率", "用时", "完成时间"]];
  for (const item of history) {
    rows.push([
      item.sourceName,
      item.mode === "paper" ? "纸笔模式" : "打字模式",
      item.accent === "uk" ? "英音" : "美音",
      String(item.total),
      String(item.correctCount),
      String(item.wrongCount),
      `${item.accuracy}%`,
      formatDuration(item.durationSec),
      formatDateTime(item.endedAt),
    ]);
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatDuration(durationSec: number): string {
  const minutes = Math.floor(durationSec / 60);
  const seconds = Math.max(0, Math.round(durationSec % 60));
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hour}:${minute}`;
}
