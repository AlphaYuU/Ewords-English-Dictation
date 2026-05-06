import type { SearchHistoryItem, VocabularyWord } from "@dictation/domain";
import type { AppState, GetAppState, SetAppState } from "../store-types";
import { persistDatabaseMutationSilently, persistPracticeQueue } from "../store-persistence";
import {
  createTransientDictionaryWord,
  ensureWordInCollection,
  findPracticeWordForDictionaryEntry,
  resolveWordTarget,
  sameResultIdentity,
  sameWordIdentity,
  wordIdentity,
} from "../word-state-transitions";

export function createWordStateSlice(set: SetAppState, get: GetAppState): Pick<
  AppState,
  "queueDictionaryEntryForDictation" | "toggleFavorite" | "toggleFavoriteForEntry" | "toggleWrongBook" | "toggleWrongBookForEntry" | "recordDictionarySearch"
> {
  return {
    queueDictionaryEntryForDictation: (entry) => {
      const state = get();
      const existingWord = state.words.find((word) => word.transientSource === "dictionary" && (word.dictionaryEntryId === entry.id || word.id === -Math.abs(entry.id)));
      const word = existingWord ?? createTransientDictionaryWord(entry);
      const queuedWordIds = state.setup.source.sourceType === "words" ? state.setup.source.wordIds : [];
      const nextWords = existingWord ? state.words : [...state.words, word];
      const nextSource = { sourceType: "words" as const, wordIds: [...new Set([...queuedWordIds, word.id])] };
      set((current) => ({
        words: existingWord ? current.words : [...current.words, word],
        setup: {
          ...current.setup,
          source: nextSource,
          sampleWordIds: undefined,
        },
      }));
      persistPracticeQueue(set, get, nextSource, nextWords);
      return word.id;
    },
    toggleFavorite: (wordId) => {
      const target = resolveWordTarget(get(), wordId);
      if (!target) return;
      toggleFavoriteForTarget(set, get, target);
    },
    toggleFavoriteForEntry: (entry) => {
      const target = findPracticeWordForDictionaryEntry(get().words, entry) ?? createTransientDictionaryWord(entry);
      toggleFavoriteForTarget(set, get, target);
    },
    toggleWrongBook: (wordId) => {
      const target = resolveWordTarget(get(), wordId);
      if (!target) return;
      toggleWrongBookForTarget(set, get, target);
    },
    toggleWrongBookForEntry: (entry) => {
      const target = findPracticeWordForDictionaryEntry(get().words, entry) ?? createTransientDictionaryWord(entry);
      toggleWrongBookForTarget(set, get, target);
    },
    recordDictionarySearch: (query, entry) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      const entryId = entry?.id;
      set((state) => {
        const normalized = trimmed.toLowerCase();
        const nextItem: SearchHistoryItem = {
          id: Date.now(),
          query: trimmed,
          entryId,
          word: entry?.word,
          meaningCn: entry?.meaningCn,
          searchedAt: Date.now(),
        };
        return {
          searchHistory: [
            nextItem,
            ...state.searchHistory.filter((item) => {
              const sameQuery = item.query.trim().toLowerCase() === normalized;
              const sameEntry = entryId != null && item.entryId === entryId;
              return !sameQuery && !sameEntry;
            }),
          ].slice(0, 12),
        };
      });
      if (get().dataSource === "database") {
        persistDatabaseMutationSilently(set, { resource: "record-search", query: trimmed, entryId });
      }
    },
  };
}

function toggleFavoriteForTarget(set: SetAppState, get: GetAppState, target: VocabularyWord): void {
  const nextFavorite = !target.isFavorite;
  const identity = wordIdentity(target);
  set((state) => {
    const words = ensureWordInCollection(state.words, target).map((word) => (sameWordIdentity(word, target) ? { ...word, isFavorite: nextFavorite } : word));
    return {
      words,
      results: state.results.map((row) => (sameResultIdentity(row, identity) ? { ...row, isFavorited: nextFavorite } : row)),
    };
  });
  if (get().dataSource === "database") {
    persistDatabaseMutationSilently(set, {
      resource: "toggle-favorite",
      wordId: target.id,
      dictionaryEntryId: target.dictionaryEntryId,
      wordKey: identity.wordKey,
      word: target.word,
      isFavorite: nextFavorite,
    });
  }
}

function toggleWrongBookForTarget(set: SetAppState, get: GetAppState, target: VocabularyWord): void {
  const nextInWrongBook = !target.inWrongBook;
  const identity = wordIdentity(target);
  set((state) => {
    const words = ensureWordInCollection(state.words, target).map((word) =>
      sameWordIdentity(word, target) ? { ...word, inWrongBook: nextInWrongBook, wrongCount: nextInWrongBook ? Math.max(1, word.wrongCount) : 0 } : word,
    );
    return {
      words,
      results: state.results.map((row) => (sameResultIdentity(row, identity) ? { ...row, isAddedToWrongBook: nextInWrongBook } : row)),
    };
  });
  if (get().dataSource === "database") {
    persistDatabaseMutationSilently(set, {
      resource: "toggle-wrong-book",
      wordId: target.id,
      dictionaryEntryId: target.dictionaryEntryId,
      wordKey: identity.wordKey,
      word: target.word,
      inWrongBook: nextInWrongBook,
    });
  }
}
