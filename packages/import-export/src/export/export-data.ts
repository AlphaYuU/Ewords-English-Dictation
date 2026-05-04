import type { DictationResult, VocabularyLibrary, VocabularyWord } from "@dictation/domain";

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
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
