import type { DictationResult, PracticeSetup, VocabularyWord } from "@dictation/domain";

export function resolveSetupWords(setup: PracticeSetup, words: VocabularyWord[], results: DictationResult[] = []): VocabularyWord[] {
  const source = setup.source;
  const select = (items: VocabularyWord[]) => {
    if (setup.orderMode !== "sample") return items;
    if (setup.sampleWordIds?.length) {
      const byId = new Map(items.map((word) => [word.id, word]));
      return setup.sampleWordIds.map((wordId) => byId.get(wordId)).filter((word): word is VocabularyWord => Boolean(word));
    }
    return items.slice(0, setup.sampleCount ?? items.length);
  };
  switch (source.sourceType) {
    case "library":
      return select(words.filter((word) => word.libraryId === source.sourceId));
    case "unit":
      return select(words.filter((word) => word.unitIds?.includes(source.sourceId)));
    case "wrong_book":
      return select(dedupeWordsByIdentity(words.filter((word) => word.inWrongBook)));
    case "favorite":
      return select(dedupeWordsByIdentity(words.filter((word) => word.isFavorite)));
    case "history_session":
      {
        const sessionResults = results
          .filter((row) => row.sessionId === source.sourceId)
          .filter((row) => !source.filter || source.filter === "all" || row.result === "wrong" || row.result === "skipped" || row.result === "unmarked" || row.isAddedToWrongBook)
          .sort((left, right) => left.orderIndex - right.orderIndex);
        const byId = new Map(words.map((word) => [word.id, word]));
        return select(sessionResults.map((row) => byId.get(row.wordId) ?? createTransientDictionaryWordFromResult(row)).filter(Boolean) as VocabularyWord[]);
      }
    case "words":
      {
        const byId = new Map(words.map((word) => [word.id, word]));
        return select(source.wordIds.map((wordId) => byId.get(wordId)).filter(Boolean) as VocabularyWord[]);
      }
    case "none":
      return [];
  }
}

export function shuffleWords(words: VocabularyWord[]): VocabularyWord[] {
  const next = words.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function dedupeWordsByIdentity(words: VocabularyWord[]): VocabularyWord[] {
  const seen = new Set<string>();
  const unique: VocabularyWord[] = [];
  for (const word of words) {
    const key = normalizeWordKey(word.wordKey ?? word.word);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(word);
  }
  return unique;
}

function createTransientDictionaryWordFromResult(result: DictationResult): VocabularyWord {
  return {
    id: result.wordId,
    libraryId: 0,
    transientSource: "dictionary",
    wordKey: normalizeWordKey(result.correctAnswer || result.word),
    word: result.correctAnswer || result.word,
    meaning: result.meaning,
    isFavorite: result.isFavorited,
    inWrongBook: result.isAddedToWrongBook,
    masteryLevel: 0,
    wrongCount: result.result === "wrong" || result.result === "skipped" || result.result === "unmarked" ? 1 : 0,
    dictationCount: result.result === "unmarked" ? 0 : 1,
    addedAt: result.id,
  };
}

function normalizeWordKey(value: string): string {
  return value.trim().toLowerCase();
}
