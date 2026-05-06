import { defaultSettings } from "@dictation/domain";
import type { AppBootstrap } from "../services/desktop-bridge";
import { loadDesktopBootstrap, runDesktopDatabaseMutation } from "../services/desktop-bridge";
import { normalizeLibrariesForDisplay } from "../services/library-display";
import type { AppState, GetAppState, SetAppState } from "./store-types";
import type { PracticeSetup, VocabularyWord } from "@dictation/domain";

export function emptyDataState(): Partial<AppState> {
  return {
    libraries: [],
    units: [],
    words: [],
    dictionary: [],
    examples: [],
    sessions: [],
    results: [],
    history: [],
    searchHistory: [],
    settings: defaultSettings,
    libraryListUiState: {},
  };
}

export function bootstrapState(bootstrap: AppBootstrap): Partial<AppState> {
  return {
    libraries: normalizeLibrariesForDisplay(bootstrap.libraries),
    units: bootstrap.units,
    words: bootstrap.words,
    dictionary: bootstrap.dictionary,
    examples: bootstrap.examples,
    sessions: bootstrap.sessions,
    results: bootstrap.results,
    history: bootstrap.history,
    searchHistory: bootstrap.searchHistory ?? [],
    settings: bootstrap.settings,
  };
}

export function initialSessionIndex(bootstrap: AppBootstrap): number {
  const resumable = bootstrap.sessions
    .filter((session) => session.status === "active" || session.status === "paused")
    .sort((left, right) => (right.pausedAt ?? right.createdAt) - (left.pausedAt ?? left.createdAt))[0];
  return Math.max(0, resumable?.currentIndex ?? 0);
}

export function mergeTransientDictionaryWords(nextState: Partial<AppState>, currentWords: VocabularyWord[]): Partial<AppState> {
  const transientWords = currentWords.filter((word) => word.transientSource === "dictionary");
  if (!transientWords.length || !nextState.words) return nextState;
  const nextWordIds = new Set(nextState.words.map((word) => word.id));
  const retainedWords = transientWords.filter((word) => !nextWordIds.has(word.id));
  return retainedWords.length ? { ...nextState, words: [...nextState.words, ...retainedWords] } : nextState;
}

export async function hydrateFromDesktopDatabase(set: SetAppState, get: GetAppState): Promise<void> {
  if (get().hydrationStatus === "loading") return;
  set({ hydrationStatus: "loading", hydrationError: undefined });
  try {
    const bootstrap = await loadDesktopBootstrap();
    if (!bootstrap) {
      set({ ...emptyDataState(), hydrationStatus: "ready", dataSource: "empty" });
      return;
    }
    set({
      ...bootstrapState(bootstrap),
      setup: setupWithPracticeQueue(get().setup, bootstrap),
      sessionIndex: initialSessionIndex(bootstrap),
      dataSource: "database",
      hydrationStatus: "ready",
    });
  } catch (error) {
    set({ hydrationStatus: "error", hydrationError: error instanceof Error ? error.message : String(error) });
  }
}

export function persistDatabaseMutation(set: SetAppState, get: GetAppState, request: { resource: string; [key: string]: unknown }): void {
  void runDesktopDatabaseMutation(request)
    .then((bootstrap) => {
      if (bootstrap) {
        const nextState = request.resource === "clear-data" ? bootstrapState(bootstrap) : mergeTransientDictionaryWords(bootstrapState(bootstrap), get().words);
        set({ ...nextState, dataSource: "database", hydrationStatus: "ready", hydrationError: undefined });
      }
    })
    .catch((error) => {
      set({ hydrationStatus: "error", hydrationError: error instanceof Error ? error.message : String(error) });
    });
}

export async function persistDatabaseMutationAsync(set: SetAppState, get: GetAppState, request: { resource: string; [key: string]: unknown }): Promise<boolean> {
  try {
    const bootstrap = await runDesktopDatabaseMutation(request);
    if (bootstrap) {
      const nextState = request.resource === "clear-data" ? bootstrapState(bootstrap) : mergeTransientDictionaryWords(bootstrapState(bootstrap), get().words);
      set({ ...nextState, dataSource: "database", hydrationStatus: "ready", hydrationError: undefined });
    }
    return true;
  } catch (error) {
    set({ hydrationStatus: "error", hydrationError: error instanceof Error ? error.message : String(error), dialog: "import-failed" });
    return false;
  }
}

export function persistDatabaseMutationSilently(set: SetAppState, request: { resource: string; [key: string]: unknown }): void {
  void runDesktopDatabaseMutation(request).catch((error) => {
    set({ hydrationStatus: "error", hydrationError: error instanceof Error ? error.message : String(error) });
  });
}

export function persistSessionSnapshot(set: SetAppState, get: GetAppState, sessionId: number, changedWordIds: Iterable<number> = []): void {
  const state = get();
  if (state.dataSource !== "database") return;
  const session = state.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const changedWordIdSet = new Set(changedWordIds);
  persistDatabaseMutation(set, get, {
    resource: "save-session",
    session,
    results: state.results.filter((row) => row.sessionId === sessionId),
    words: changedWordIdSet.size ? state.words.filter((word) => changedWordIdSet.has(word.id)) : [],
  });
}

export function persistPracticeQueue(set: SetAppState, get: GetAppState, source: PracticeSetup["source"], words: VocabularyWord[]): void {
  if (get().dataSource !== "database") return;
  const items = serializePracticeQueue(source, words);
  persistDatabaseMutation(set, get, { resource: "save-practice-queue", items });
}

export function setupWithPracticeQueue(setup: PracticeSetup, bootstrap: AppBootstrap): PracticeSetup {
  const wordIds = bootstrap.practiceQueueWordIds ?? [];
  return wordIds.length ? { ...setup, source: { sourceType: "words", wordIds }, sampleWordIds: undefined } : setup;
}

function serializePracticeQueue(source: PracticeSetup["source"], words: VocabularyWord[]): { itemType: "word" | "dictionary_entry"; itemId: number }[] {
  if (source.sourceType !== "words") return [];
  const byId = new Map(words.map((word) => [word.id, word]));
  const items: { itemType: "word" | "dictionary_entry"; itemId: number }[] = [];
  for (const wordId of source.wordIds) {
    const word = byId.get(wordId);
    if (!word) continue;
    if (word.transientSource === "dictionary" || word.id <= 0) {
      const entryId = word.dictionaryEntryId ?? Math.abs(word.id);
      items.push({ itemType: "dictionary_entry", itemId: entryId });
      continue;
    }
    items.push({ itemType: "word", itemId: word.id });
  }
  return items;
}
