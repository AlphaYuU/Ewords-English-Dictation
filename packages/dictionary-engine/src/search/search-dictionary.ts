import type { DictionaryEntry } from "@dictation/domain";

export type DictionarySearchMode = "word" | "meaning" | "fuzzy" | "all";

export function searchDictionary(
  entries: DictionaryEntry[],
  query: string,
  mode: DictionarySearchMode = "all",
  limit = 20,
): DictionaryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.slice(0, limit);
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, q, mode) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.word.localeCompare(b.entry.word))
    .slice(0, limit)
    .map((row) => row.entry);
}

function scoreEntry(entry: DictionaryEntry, query: string, mode: DictionarySearchMode): number {
  const word = entry.word.toLowerCase();
  const meaning = entry.meaningCn.toLowerCase();
  let score = 0;
  if (mode === "word" || mode === "all" || mode === "fuzzy") {
    if (word === query) score += 100;
    if (word.startsWith(query)) score += 70;
    if (word.includes(query)) score += 40;
    if (mode === "fuzzy" && fuzzyContains(word, query)) score += 20;
  }
  if ((mode === "meaning" || mode === "all") && meaning.includes(query)) score += 45;
  return score;
}

function fuzzyContains(value: string, query: string): boolean {
  let cursor = 0;
  for (const char of value) {
    if (char === query[cursor]) cursor += 1;
    if (cursor === query.length) return true;
  }
  return false;
}
