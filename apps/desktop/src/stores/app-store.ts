import { create } from "zustand";
import type {
  AppSettings,
  DictionaryEntry,
  DictionaryExample,
  DictationMode,
  DictationResult,
  DictationResultStatus,
  DictationSession,
  Accent,
  GradingRules,
  HistoryItem,
  OrderMode,
  PlaybackSettings,
  PracticeSetup,
  SearchHistoryItem,
  VocabularyLibrary,
  VocabularyUnit,
  VocabularyWord,
} from "@dictation/domain";
import { defaultGradingRules, defaultPlaybackSettings } from "@dictation/domain";
import { gradeAnswer } from "@dictation/dictation-engine";
import { summarizeResults } from "@dictation/domain";
import type { ImportPreviewRow } from "@dictation/import-export";
import {
  seedDictionary,
  seedExamples,
  seedHistory,
  seedLibraries,
  seedResults,
  seedSessions,
  seedSettings,
  seedUnits,
  seedWords,
} from "../services/seed-data";
import type { AppBootstrap } from "../services/desktop-bridge";
import { loadDesktopBootstrap, runDesktopDatabaseMutation } from "../services/desktop-bridge";
import { normalizeLibrariesForDisplay } from "../services/library-display";

type DialogName =
  | "create-library"
  | "add-word-search"
  | "create-word"
  | "create-word-required"
  | "import-file"
  | "import-preview"
  | "add-word-select-library"
  | "delete-confirm"
  | "delete-word"
  | "clear-cache"
  | "clear-data"
  | "already-in-library"
  | "import-success"
  | "import-failed"
  | "export-failed"
  | "delete-history"
  | null;

type AppState = {
  libraries: VocabularyLibrary[];
  units: VocabularyUnit[];
  words: VocabularyWord[];
  dictionary: DictionaryEntry[];
  examples: DictionaryExample[];
  sessions: DictationSession[];
  results: DictationResult[];
  history: HistoryItem[];
  searchHistory: SearchHistoryItem[];
  settings: AppSettings;
  dataSource: "seed" | "database";
  hydrationStatus: "idle" | "loading" | "ready" | "error";
  hydrationError?: string;
  dialog: DialogName;
  selectedLibraryId: number | null;
  pendingAddWordId: number | null;
  pendingAddDictionaryEntry: DictionaryEntry | null;
  setup: PracticeSetup;
  sessionIndex: number;
  answerInput: string;
  sessionFeedback: "idle" | "correct" | "wrong";
  openDialog: (dialog: DialogName) => void;
  closeDialog: () => void;
  hydrateFromDatabase: () => Promise<void>;
  createLibrary: (input: string | CreateLibraryInput) => void;
  deleteCustomLibrary: (id: number) => void;
  reorderLibraries: (libraryIds: number[]) => void;
  deleteWord: (wordId: number) => void;
  setSelectedLibraryId: (libraryId: number | null) => void;
  setPendingAddWordId: (wordId: number | null) => void;
  setPendingAddDictionaryEntry: (entry: DictionaryEntry | null) => void;
  importWords: (rows: ImportPreviewRow[], targetLibraryId?: number, options?: { silent?: boolean }) => void;
  restoreBackup: (backup: AppBackup) => void;
  clearAllData: () => void;
  queueDictionaryEntryForDictation: (entry: DictionaryEntry) => number;
  toggleFavorite: (wordId: number) => void;
  toggleFavoriteForEntry: (entry: DictionaryEntry) => void;
  toggleWrongBook: (wordId: number) => void;
  toggleWrongBookForEntry: (entry: DictionaryEntry) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setPracticeSource: (source: PracticeSetup["source"]) => void;
  setPracticeMode: (mode: DictationMode) => void;
  setPracticeAccent: (accent: Accent) => void;
  setPracticeOrderMode: (orderMode: OrderMode) => void;
  setPracticeSampleCount: (sampleCount: number) => void;
  updatePlaybackSettings: (settings: Partial<PlaybackSettings>) => void;
  updateGradingRules: (rules: Partial<GradingRules>) => void;
  setShowChineseHint: (showChineseHint: boolean) => void;
  setAnswerInput: (answer: string) => void;
  recordDictionarySearch: (query: string, entry?: Pick<DictionaryEntry, "id" | "word" | "meaningCn"> | null) => void;
  createSession: () => number | null;
  revealCurrentHint: (sessionId: number) => void;
  submitCurrentAnswer: (sessionId: number, answerOverride?: string, options?: { allowEmpty?: boolean; forceWrong?: boolean }) => DictationResultStatus | null;
  skipCurrentWord: (sessionId: number) => void;
  finishTypingSession: (sessionId: number, answerOverride?: string) => void;
  markResult: (sessionId: number, resultId: number, result: DictationResultStatus) => void;
  markAllResults: (sessionId: number, result: DictationResultStatus) => void;
  previousWord: () => void;
  nextWord: (sessionId: number) => boolean;
  pauseSession: (sessionId: number) => void;
  resumeSession: (sessionId: number) => void;
  completeSession: (sessionId: number) => void;
  abandonSession: (sessionId: number) => void;
  deleteHistory: (sessionId: number) => void;
};

type SetAppState = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void;
type GetAppState = () => AppState;
type CreateLibraryInput = {
  name: string;
  tags?: string[];
  coverColor?: string;
};

type AppBackup = Partial<Pick<AppState, "libraries" | "units" | "words" | "sessions" | "results" | "history" | "searchHistory" | "settings">>;
type PersistedPracticeSetup = Omit<PracticeSetup, "source">;

const PRACTICE_SETTINGS_STORAGE_KEY = "dictation.practice-settings.v1";

function createDefaultPracticeSetup(): PracticeSetup {
  return {
    source: { sourceType: "none" },
    mode: "typing",
    accent: "uk",
    orderMode: "sequence",
    sampleCount: 1,
    showChineseHint: false,
    playbackSettings: defaultPlaybackSettings,
    gradingRules: defaultGradingRules,
  };
}

function loadPracticeSetup(): PracticeSetup {
  const defaults = createDefaultPracticeSetup();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(PRACTICE_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const persisted = JSON.parse(raw) as Partial<PersistedPracticeSetup>;
    return {
      ...defaults,
      mode: persisted.mode === "paper" ? "paper" : "typing",
      accent: persisted.accent === "us" ? "us" : "uk",
      orderMode: persisted.orderMode === "random" || persisted.orderMode === "sample" ? persisted.orderMode : "sequence",
      sampleCount: Number.isFinite(persisted.sampleCount) ? Math.max(1, Math.round(Number(persisted.sampleCount))) : defaults.sampleCount,
      showChineseHint: persisted.showChineseHint === true,
      playbackSettings: {
        playCount: persisted.playbackSettings?.playCount === 1 || persisted.playbackSettings?.playCount === 3 ? persisted.playbackSettings.playCount : 2,
        intervalSec:
          persisted.playbackSettings?.intervalSec === 10 || persisted.playbackSettings?.intervalSec === 15 ? persisted.playbackSettings.intervalSec : 5,
        speed: persisted.playbackSettings?.speed === 0.5 || persisted.playbackSettings?.speed === 1.5 ? persisted.playbackSettings.speed : 1,
        allowReplay: persisted.playbackSettings?.allowReplay !== false,
        autoPlayNext: persisted.playbackSettings?.autoPlayNext !== false,
      },
      gradingRules: {
        ...defaults.gradingRules,
        ignoreCase: persisted.gradingRules?.ignoreCase !== false,
        trimWhitespace: persisted.gradingRules?.trimWhitespace !== false,
        acceptUkUs: persisted.gradingRules?.acceptUkUs !== false,
        collapseSpaces: persisted.gradingRules?.collapseSpaces !== false,
        strictHyphen: persisted.gradingRules?.strictHyphen === true,
        strictApostrophe: persisted.gradingRules?.strictApostrophe === true,
        skippedAsWrong: persisted.gradingRules?.skippedAsWrong === true,
      },
    };
  } catch {
    return defaults;
  }
}

function persistPracticeSetupSettings(setup: PracticeSetup): void {
  if (typeof window === "undefined") return;
  const persisted: PersistedPracticeSetup = {
    mode: setup.mode,
    accent: setup.accent,
    orderMode: setup.orderMode,
    sampleCount: setup.sampleCount,
    showChineseHint: setup.showChineseHint,
    playbackSettings: setup.playbackSettings,
    gradingRules: setup.gradingRules,
  };
  try {
    window.localStorage.setItem(PRACTICE_SETTINGS_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Local persistence is best-effort; the running setup should still update.
  }
}

function resetPracticeSetupSettings(): PracticeSetup {
  const setup = createDefaultPracticeSetup();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(PRACTICE_SETTINGS_STORAGE_KEY);
    } catch {
      // Local persistence is best-effort; clearing app data should continue.
    }
  }
  return setup;
}

function seedDataState(): Partial<AppState> {
  return {
    libraries: normalizeLibrariesForDisplay(seedLibraries),
    units: seedUnits,
    words: seedWords,
    dictionary: seedDictionary,
    examples: seedExamples,
    sessions: seedSessions,
    results: seedResults,
    history: seedHistory,
    searchHistory: [],
    settings: seedSettings,
  };
}

function sourceWordCountForSetup(setup: PracticeSetup, words: VocabularyWord[], results: DictationResult[]): number {
  return resolveSetupWords({ ...setup, orderMode: "sequence" }, words, results).length;
}

function clampPracticeSampleCount(setup: PracticeSetup, words: VocabularyWord[], results: DictationResult[], sampleCount: number): number {
  const max = sourceWordCountForSetup(setup, words, results);
  const upper = max > 0 ? max : 9999;
  return Math.max(1, Math.min(upper, Math.round(sampleCount)));
}

function bootstrapState(bootstrap: AppBootstrap): Partial<AppState> {
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

function mergeTransientDictionaryWords(nextState: Partial<AppState>, currentWords: VocabularyWord[]): Partial<AppState> {
  const transientWords = currentWords.filter((word) => word.transientSource === "dictionary");
  if (!transientWords.length || !nextState.words) return nextState;
  const nextWordIds = new Set(nextState.words.map((word) => word.id));
  const retainedWords = transientWords.filter((word) => !nextWordIds.has(word.id));
  return retainedWords.length ? { ...nextState, words: [...nextState.words, ...retainedWords] } : nextState;
}

function persistDatabaseMutation(set: SetAppState, get: GetAppState, request: { resource: string; [key: string]: unknown }): void {
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

function persistDatabaseMutationSilently(set: SetAppState, request: { resource: string; [key: string]: unknown }): void {
  void runDesktopDatabaseMutation(request).catch((error) => {
    set({ hydrationStatus: "error", hydrationError: error instanceof Error ? error.message : String(error) });
  });
}

function persistSessionSnapshot(set: SetAppState, get: GetAppState, sessionId: number, changedWordIds: Iterable<number> = []): void {
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

function completedSessionWordIds(state: AppState, sessionId: number): number[] {
  return state.results
    .filter((row) => row.sessionId === sessionId && (row.result === "correct" || row.result === "wrong"))
    .map((row) => row.wordId);
}

function allSessionWordIds(state: AppState, sessionId: number): number[] {
  return state.results.filter((row) => row.sessionId === sessionId).map((row) => row.wordId);
}

function persistPracticeQueue(set: SetAppState, get: GetAppState, source: PracticeSetup["source"], words: VocabularyWord[]): void {
  if (get().dataSource !== "database") return;
  const items = serializePracticeQueue(source, words);
  persistDatabaseMutation(set, get, { resource: "save-practice-queue", items });
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

function setupWithPracticeQueue(setup: PracticeSetup, bootstrap: AppBootstrap): PracticeSetup {
  const wordIds = bootstrap.practiceQueueWordIds ?? [];
  return wordIds.length ? { ...setup, source: { sourceType: "words", wordIds } } : setup;
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

export const useAppStore = create<AppState>((set, get) => ({
  libraries: normalizeLibrariesForDisplay(seedLibraries),
  units: seedUnits,
  words: seedWords,
  dictionary: seedDictionary,
  examples: seedExamples,
  sessions: seedSessions,
  results: seedResults,
  history: seedHistory,
  searchHistory: [],
  settings: seedSettings,
  dataSource: "seed",
  hydrationStatus: "idle",
  dialog: null,
  selectedLibraryId: null,
  pendingAddWordId: null,
  pendingAddDictionaryEntry: null,
  setup: loadPracticeSetup(),
  sessionIndex: 0,
  answerInput: "",
  sessionFeedback: "idle",
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null, pendingAddWordId: null, pendingAddDictionaryEntry: null }),
  hydrateFromDatabase: async () => {
    if (get().hydrationStatus === "loading") return;
    set({ hydrationStatus: "loading", hydrationError: undefined });
    try {
      const bootstrap = await loadDesktopBootstrap();
      if (!bootstrap) {
        set({ hydrationStatus: "ready", dataSource: "seed" });
        return;
      }
      set({
        ...bootstrapState(bootstrap),
        setup: setupWithPracticeQueue(get().setup, bootstrap),
        dataSource: "database",
        hydrationStatus: "ready",
      });
    } catch (error) {
      set({ hydrationStatus: "error", hydrationError: error instanceof Error ? error.message : String(error) });
    }
  },
  createLibrary: (input) => {
    const payload = typeof input === "string" ? { name: input } : input;
    const trimmed = payload.name.trim();
    const tags = normalizeTags(payload.tags);
    const coverColor = payload.coverColor ?? "#D4916E";
    if (!trimmed) return;
    if (get().dataSource === "database") {
      set({ dialog: null });
      persistDatabaseMutation(set, get, { resource: "create-library", name: trimmed, tags, coverColor });
      return;
    }
    set((state) => {
      const id = Math.max(...state.libraries.map((library) => library.id)) + 1;
      return {
        dialog: null,
        libraries: [
          ...state.libraries,
          {
            id,
            name: trimmed,
            description: "自建词库",
            tags,
            type: "custom",
            coverColor,
            coverIcon: "book",
            wordCount: 0,
            unitCount: 1,
            progress: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        units: [...state.units, { id: id * 10, libraryId: id, name: "全部", sortOrder: 0, wordCount: 0 }],
      };
    });
  },
  deleteCustomLibrary: (id) => {
    set((state) => ({
      dialog: null,
      libraries: state.libraries.filter((library) => library.id !== id || library.type !== "custom"),
      words: state.words.filter((word) => word.libraryId !== id),
    }));
    if (get().dataSource === "database") persistDatabaseMutation(set, get, { resource: "delete-library", libraryId: id });
  },
  reorderLibraries: (libraryIds) => {
    set((state) => {
      const order = new Map(libraryIds.map((id, index) => [id, index]));
      return {
        libraries: state.libraries
          .map((library) => ({ ...library, updatedAt: order.has(library.id) ? Date.now() : library.updatedAt }))
          .sort((left, right) => (order.get(left.id) ?? 9999) - (order.get(right.id) ?? 9999)),
      };
    });
    if (get().dataSource === "database") persistDatabaseMutation(set, get, { resource: "update-library-order", libraryIds });
  },
  deleteWord: (wordId) => {
    set((state) => {
      const target = state.words.find((word) => word.id === wordId);
      const nextWords = state.words.filter((word) => word.id !== wordId);
      return {
        words: nextWords,
        results: state.results.filter((row) => row.wordId !== wordId),
        libraries: target
          ? state.libraries.map((library) =>
              library.id === target.libraryId ? { ...library, wordCount: Math.max(0, library.wordCount - 1), updatedAt: Date.now() } : library,
            )
          : state.libraries,
        units: target?.unitIds?.length
          ? state.units.map((unit) => (target.unitIds?.includes(unit.id) ? { ...unit, wordCount: Math.max(0, unit.wordCount - 1) } : unit))
          : state.units,
      };
    });
    if (get().dataSource === "database") persistDatabaseMutation(set, get, { resource: "delete-word", wordId });
  },
  setSelectedLibraryId: (selectedLibraryId) => set({ selectedLibraryId }),
  setPendingAddWordId: (pendingAddWordId) => set({ pendingAddWordId }),
  setPendingAddDictionaryEntry: (pendingAddDictionaryEntry) => set({ pendingAddDictionaryEntry }),
  importWords: (rows, targetLibraryId, options) => {
    const importableRows = rows.filter((row) => row.word && row.action === "add" && row.status !== "error");
    if (!importableRows.length) {
      set({ dialog: "import-failed" });
      return;
    }
    if (get().dataSource === "database") {
      if (!options?.silent) set({ dialog: "import-success" });
      persistDatabaseMutation(set, get, { resource: "import-words", rows: importableRows, targetLibraryId });
      return;
    }
    set((state) => {
      const existingLibrary = targetLibraryId ? state.libraries.find((library) => library.id === targetLibraryId) : state.libraries.find((library) => library.type === "custom");
      const libraryId = existingLibrary?.id ?? Math.max(...state.libraries.map((library) => library.id), 20) + 1;
      const unitId = state.units.find((unit) => unit.libraryId === libraryId)?.id ?? libraryId * 10;
      const nextDictionaryStart = Math.max(...state.dictionary.map((entry) => entry.id), 1000) + 1;
      const nextWordStart = Math.max(...state.words.map((word) => word.id), 1000) + 1;
      const importedDictionary = importableRows.map((row, index) => ({
        id: nextDictionaryStart + index,
        word: row.word,
        meaningCn: row.meaning || "暂无释义",
        partOfSpeech: row.partOfSpeech,
        source: "custom" as const,
      }));
      const importedWords = importableRows.map((row, index) => ({
        id: nextWordStart + index,
        libraryId,
        dictionaryEntryId: nextDictionaryStart + index,
        wordKey: normalizeWordKey(row.word),
        unitIds: [unitId],
        word: row.word,
        meaning: row.meaning || "暂无释义",
        partOfSpeech: row.partOfSpeech,
        isFavorite: false,
        inWrongBook: false,
        masteryLevel: 0,
        wrongCount: 0,
        dictationCount: 0,
        addedAt: Date.now() + index,
      }));
      const nextLibraries = existingLibrary
        ? state.libraries.map((library) => (library.id === libraryId ? { ...library, wordCount: library.wordCount + importedWords.length, updatedAt: Date.now() } : library))
        : [
            ...state.libraries,
            {
              id: libraryId,
              name: "导入词库",
              description: `${importedWords.length} 词`,
              type: "custom" as const,
              coverColor: "#F3EBE2",
              coverIcon: "book",
              wordCount: importedWords.length,
              unitCount: 1,
              progress: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ];
      return {
        dialog: options?.silent ? state.dialog : "import-success",
        libraries: nextLibraries,
        units: state.units.some((unit) => unit.id === unitId) ? state.units : [...state.units, { id: unitId, libraryId, name: "全部", sortOrder: 0, wordCount: importedWords.length }],
        dictionary: [...state.dictionary, ...importedDictionary],
        words: [...state.words, ...importedWords],
      };
    });
  },
  restoreBackup: (backup) => {
    set({
      libraries: backup.libraries ? normalizeLibrariesForDisplay(backup.libraries) : get().libraries,
      units: backup.units ?? get().units,
      words: backup.words ?? get().words,
      sessions: backup.sessions ?? get().sessions,
      results: backup.results ?? get().results,
      history: backup.history ?? get().history,
      searchHistory: backup.searchHistory ?? get().searchHistory,
      settings: backup.settings ? { ...get().settings, ...backup.settings } : get().settings,
      dialog: null,
    });
    if (get().dataSource === "database") persistDatabaseMutation(set, get, { resource: "restore-data", backup });
  },
  clearAllData: () => {
    const setup = resetPracticeSetupSettings();
    set({
      dialog: null,
      selectedLibraryId: null,
      pendingAddWordId: null,
      pendingAddDictionaryEntry: null,
      setup,
      sessionIndex: 0,
      answerInput: "",
      sessionFeedback: "idle",
    });
    if (get().dataSource === "database") {
      set({ hydrationStatus: "loading", hydrationError: undefined });
      persistDatabaseMutation(set, get, { resource: "clear-data" });
      return;
    }
    set({
      ...seedDataState(),
      dataSource: "seed",
      hydrationStatus: "ready",
      hydrationError: undefined,
    });
  },
  queueDictionaryEntryForDictation: (entry) => {
    const state = get();
    const existingWord = findPracticeWordForDictionaryEntry(state.words, entry);
    const word = existingWord ?? createTransientDictionaryWord(entry);
    const queuedWordIds = state.setup.source.sourceType === "words" ? state.setup.source.wordIds : [];
    const nextWords = existingWord ? state.words : [...state.words, word];
    const nextSource = { sourceType: "words" as const, wordIds: [...new Set([...queuedWordIds, word.id])] };
    set((current) => ({
      words: existingWord ? current.words : [...current.words, word],
      setup: {
        ...current.setup,
        source: nextSource,
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
  updateSettings: (settings) => {
    set((state) => ({ settings: { ...state.settings, ...settings } }));
    if (get().dataSource === "database") persistDatabaseMutation(set, get, { resource: "update-settings", settings });
  },
  setPracticeSource: (source) => {
    set((state) => {
      const sourceCount = sourceWordCountForSetup({ ...state.setup, source }, state.words, state.results);
      const setup = { ...state.setup, source, sampleCount: sourceCount > 0 ? sourceCount : state.setup.sampleCount };
      persistPracticeSetupSettings(setup);
      return { setup };
    });
    persistPracticeQueue(set, get, source, get().words);
  },
  setPracticeMode: (mode) =>
    set((state) => {
      const setup = { ...state.setup, mode };
      persistPracticeSetupSettings(setup);
      return { setup };
    }),
  setPracticeAccent: (accent) =>
    set((state) => {
      const setup = { ...state.setup, accent };
      persistPracticeSetupSettings(setup);
      return { setup };
    }),
  setPracticeOrderMode: (orderMode) =>
    set((state) => {
      const setup = { ...state.setup, orderMode };
      persistPracticeSetupSettings(setup);
      return { setup };
    }),
  setPracticeSampleCount: (sampleCount) =>
    set((state) => {
      const setup = { ...state.setup, sampleCount: clampPracticeSampleCount(state.setup, state.words, state.results, sampleCount) };
      persistPracticeSetupSettings(setup);
      return { setup };
    }),
  updatePlaybackSettings: (settings) =>
    set((state) => {
      const setup = { ...state.setup, playbackSettings: { ...state.setup.playbackSettings, ...settings } };
      persistPracticeSetupSettings(setup);
      return { setup };
    }),
  updateGradingRules: (rules) =>
    set((state) => {
      const setup = { ...state.setup, gradingRules: { ...state.setup.gradingRules, ...rules } };
      persistPracticeSetupSettings(setup);
      return { setup };
    }),
  setShowChineseHint: (showChineseHint) =>
    set((state) => {
      const setup = { ...state.setup, showChineseHint };
      persistPracticeSetupSettings(setup);
      return { setup };
    }),
  setAnswerInput: (answerInput) => set({ answerInput }),
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
  createSession: () => {
    const state = get();
    const sourceWords = resolveSetupWords(state.setup, state.words, state.results);
    if (!sourceWords.length || state.setup.source.sourceType === "none") return null;
    const resultSessionIds = state.results.map((result) => Math.floor(result.id / 100));
    const id = Math.max(...state.sessions.map((session) => session.id), ...resultSessionIds, 5000) + 1;
    const sourceName = resolveSourceName(state.setup, state.libraries, state.words);
    const session: DictationSession = {
      id,
      source: state.setup.source,
      sourceName,
      mode: state.setup.mode,
      accent: state.setup.accent,
      status: "active",
      wordCount: sourceWords.length,
      durationSec: 0,
      createdAt: Date.now(),
    };
    const orderedWords = state.setup.orderMode === "random" ? shuffleWords(sourceWords) : sourceWords;
    const results: DictationResult[] = orderedWords.map((word, index) => ({
      id: id * 100 + index,
      sessionId: id,
      wordId: word.id,
      orderIndex: index,
      word: word.word,
      meaning: word.meaning,
      correctAnswer: word.word,
      result: state.setup.mode === "paper" ? "unmarked" : "unmarked",
      hintUsed: false,
      isFavorited: word.isFavorite,
      isAddedToWrongBook: Boolean(word.inWrongBook),
    }));
    const clearedSetup = { ...state.setup, source: { sourceType: "none" } as const };
    set({ sessions: [...state.sessions, session], results: [...state.results, ...results], setup: clearedSetup, sessionIndex: 0, answerInput: "", sessionFeedback: "idle" });
    persistPracticeSetupSettings(clearedSetup);
    persistSessionSnapshot(set, get, id, []);
    persistPracticeQueue(set, get, clearedSetup.source, get().words);
    return id;
  },
  revealCurrentHint: (sessionId) => {
    const state = get();
    const current = state.results.filter((row) => row.sessionId === sessionId).sort((a, b) => a.orderIndex - b.orderIndex)[state.sessionIndex];
    if (!current) return;
    set({
      results: state.results.map((row) => (row.id === current.id ? { ...row, hintUsed: true } : row)),
    });
    persistSessionSnapshot(set, get, sessionId, []);
  },
  submitCurrentAnswer: (sessionId, answerOverride, options) => {
    const state = get();
    const sessionResults = state.results.filter((row) => row.sessionId === sessionId).sort((a, b) => a.orderIndex - b.orderIndex);
    const current = sessionResults[state.sessionIndex];
    if (!current) return null;
    const answer = answerOverride ?? state.answerInput;
    if (!answer.trim() && !options?.allowEmpty) return null;
    const grade = options?.forceWrong || !answer.trim() ? { result: "wrong" as const } : gradeAnswer(answer, current.correctAnswer, state.setup.gradingRules);
    const dictatedAt = Date.now();
    const transition = updateWordsForResultTransition(state.words, current.wordId, current.result, grade.result, dictatedAt);
    const updatedWord = transition.target;
    set({
      results: state.results.map((row) =>
        row.id === current.id
          ? {
              ...row,
              userAnswer: answer,
              result: grade.result,
              answerRevealed: options?.forceWrong ? true : row.answerRevealed,
              isAddedToWrongBook: updatedWord?.inWrongBook ?? (grade.result === "wrong" || row.isAddedToWrongBook),
            }
          : row,
      ),
      words: transition.words,
      sessionFeedback: grade.result,
    });
    persistSessionSnapshot(set, get, sessionId, [current.wordId]);
    return grade.result;
  },
  skipCurrentWord: (sessionId) => {
    const state = get();
    const current = state.results.filter((row) => row.sessionId === sessionId).sort((a, b) => a.orderIndex - b.orderIndex)[state.sessionIndex];
    if (!current) return;
    const dictatedAt = Date.now();
    const transition = updateWordsForResultTransition(state.words, current.wordId, current.result, "wrong", dictatedAt);
    const updatedWord = transition.target;
    set({
      results: state.results.map((row) => (row.id === current.id ? { ...row, result: "wrong", isAddedToWrongBook: updatedWord?.inWrongBook ?? true } : row)),
      words: transition.words,
      sessionFeedback: "wrong",
    });
    persistSessionSnapshot(set, get, sessionId, [current.wordId]);
  },
  finishTypingSession: (sessionId, answerOverride) => {
    set((state) => {
      const session = state.sessions.find((item) => item.id === sessionId);
      const completedAt = Date.now();
      const sessionResults = state.results.filter((row) => row.sessionId === sessionId).sort((a, b) => a.orderIndex - b.orderIndex);
      const current = sessionResults[state.sessionIndex];
      const transitions: { wordId: number; previous: DictationResultStatus; next: DictationResultStatus }[] = [];
      const finalizedResults = state.results.map((row) => {
        if (row.sessionId !== sessionId) return row;
        let nextResult = row.result;
        let nextUserAnswer = row.userAnswer;
        if (row.id === current?.id) {
          const answer = answerOverride ?? state.answerInput;
          nextUserAnswer = answer;
          nextResult = row.answerRevealed ? "wrong" : answer.trim() ? gradeAnswer(answer, row.correctAnswer, state.setup.gradingRules).result : "wrong";
        } else if (row.result !== "correct" && row.result !== "wrong") {
          nextResult = "wrong";
        }
        if (nextResult !== row.result) transitions.push({ wordId: row.wordId, previous: row.result, next: nextResult });
        return { ...row, userAnswer: nextUserAnswer, result: nextResult, isAddedToWrongBook: nextResult === "wrong" || row.isAddedToWrongBook };
      });
      let finalizedWords = state.words;
      for (const transition of transitions) {
        finalizedWords = updateWordsForResultTransition(finalizedWords, transition.wordId, transition.previous, transition.next, completedAt).words;
      }
      const wrongBookByWordId = new Map(finalizedWords.map((word) => [word.id, Boolean(word.inWrongBook)]));
      const resultRows = finalizedResults.map((row) =>
        row.sessionId === sessionId ? { ...row, isAddedToWrongBook: wrongBookByWordId.get(row.wordId) ?? row.isAddedToWrongBook } : row,
      );
      const durationSec = sessionDurationSec(session, completedAt);
      const summary = summarizeResults(resultRows.filter((row) => row.sessionId === sessionId), durationSec);
      const historyItem: HistoryItem = {
        sessionId,
        sourceName: session?.sourceName ?? "临时听写",
        sourceType: session?.source.sourceType ?? "words",
        mode: session?.mode ?? "typing",
        accent: session?.accent ?? "us",
        endedAt: completedAt,
        ...summary,
      };
      return {
        results: resultRows,
        words: finalizedWords,
        sessions: state.sessions.map((item) => (item.id === sessionId ? { ...item, status: "completed", durationSec, completedAt, pausedAt: undefined } : item)),
        history: [historyItem, ...state.history.filter((item) => item.sessionId !== sessionId)],
        answerInput: "",
        sessionFeedback: "idle",
      };
    });
    persistSessionSnapshot(set, get, sessionId, completedSessionWordIds(get(), sessionId));
  },
  markResult: (sessionId, resultId, result) => {
    set((state) => {
      const target = state.results.find((row) => row.id === resultId);
      const markedAt = Date.now();
      const targetWord = target ? state.words.find((word) => word.id === target.wordId) : undefined;
      const transition = target ? updateWordsForResultTransition(state.words, target.wordId, target.result, result, markedAt) : { words: state.words };
      const nextTargetWord = transition.target ?? (target && targetWord ? updateWordForManualMark(targetWord, target.result, result, markedAt) : undefined);
      return {
        results: state.results.map((row) =>
          row.id === resultId ? { ...row, result, isAddedToWrongBook: nextTargetWord?.inWrongBook ?? (result === "wrong" || row.isAddedToWrongBook) } : row,
        ),
        words: transition.words,
      };
    });
    persistSessionSnapshot(set, get, sessionId, [get().results.find((row) => row.id === resultId)?.wordId].filter((id): id is number => id != null));
  },
  markAllResults: (sessionId, result) => {
    set((state) => {
      const sessionRowsByWordId = new Map(state.results.filter((row) => row.sessionId === sessionId).map((row) => [row.wordId, row]));
      const markedAt = Date.now();
      let nextWords = state.words;
      for (const row of sessionRowsByWordId.values()) {
        nextWords = updateWordsForResultTransition(nextWords, row.wordId, row.result, result, markedAt).words;
      }
      const wrongBookByWordId = new Map(nextWords.map((word) => [word.id, Boolean(word.inWrongBook)]));
      return {
        results: state.results.map((row) =>
          row.sessionId === sessionId ? { ...row, result, isAddedToWrongBook: wrongBookByWordId.get(row.wordId) ?? (result === "wrong" || row.isAddedToWrongBook) } : row,
        ),
        words: nextWords,
      };
    });
    persistSessionSnapshot(set, get, sessionId, allSessionWordIds(get(), sessionId));
  },
  previousWord: () => {
    const state = get();
    if (state.sessionIndex <= 0) return;
    set({ sessionIndex: state.sessionIndex - 1, answerInput: "", sessionFeedback: "idle" });
  },
  nextWord: (sessionId) => {
    const state = get();
    const count = state.results.filter((row) => row.sessionId === sessionId).length;
    if (state.sessionIndex >= count - 1) {
      const session = state.sessions.find((item) => item.id === sessionId);
      if (session?.mode !== "paper") get().completeSession(sessionId);
      return true;
    }
    set({ sessionIndex: state.sessionIndex + 1, answerInput: "", sessionFeedback: "idle" });
    return false;
  },
  pauseSession: (sessionId) => {
    set((state) => ({
      sessions: state.sessions.map((session) => (session.id === sessionId ? { ...session, status: "paused", pausedAt: session.pausedAt ?? Date.now() } : session)),
    }));
    persistSessionSnapshot(set, get, sessionId, []);
  },
  resumeSession: (sessionId) => {
    const resumedAt = Date.now();
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              status: "active",
              pausedDurationSec: (session.pausedDurationSec ?? 0) + (session.pausedAt ? Math.max(0, Math.round((resumedAt - session.pausedAt) / 1000)) : 0),
              pausedAt: undefined,
            }
          : session,
      ),
    }));
    persistSessionSnapshot(set, get, sessionId, []);
  },
  completeSession: (sessionId) => {
    set((state) => {
      const session = state.sessions.find((item) => item.id === sessionId);
      const completedAt = Date.now();
      const transitions: { wordId: number; previous: DictationResultStatus; next: DictationResultStatus }[] = [];
      const provisionalResults = state.results.map((row) => {
        if (row.sessionId !== sessionId) return row;
        if (row.result === "correct" || row.result === "wrong") return row;
        transitions.push({ wordId: row.wordId, previous: row.result, next: "wrong" });
        return { ...row, result: "wrong" as const, isAddedToWrongBook: true };
      });
      let finalizedWords = state.words;
      for (const transition of transitions) {
        finalizedWords = updateWordsForResultTransition(finalizedWords, transition.wordId, transition.previous, transition.next, completedAt).words;
      }
      const wrongBookByWordId = new Map(finalizedWords.map((word) => [word.id, Boolean(word.inWrongBook)]));
      const finalizedResults = provisionalResults.map((row) =>
        row.sessionId === sessionId ? { ...row, isAddedToWrongBook: wrongBookByWordId.get(row.wordId) ?? row.isAddedToWrongBook } : row,
      );
      const sessionResults = finalizedResults.filter((row) => row.sessionId === sessionId);
      const durationSec = sessionDurationSec(session, completedAt);
      const summary = summarizeResults(sessionResults, durationSec);
      const historyItem: HistoryItem = {
        sessionId,
        sourceName: session?.sourceName ?? "临时听写",
        sourceType: session?.source.sourceType ?? "words",
        mode: session?.mode ?? "typing",
        accent: session?.accent ?? "us",
        endedAt: completedAt,
        ...summary,
      };
      return {
        results: finalizedResults,
        words: finalizedWords,
        sessions: state.sessions.map((item) => (item.id === sessionId ? { ...item, status: "completed", durationSec, completedAt, pausedAt: undefined } : item)),
        history: [historyItem, ...state.history.filter((item) => item.sessionId !== sessionId)],
      };
    });
    persistSessionSnapshot(set, get, sessionId, completedSessionWordIds(get(), sessionId));
  },
  abandonSession: (sessionId) => {
    set((state) => ({
      sessions: state.sessions.map((session) => (session.id === sessionId ? { ...session, status: "abandoned", completedAt: Date.now() } : session)),
      history: state.history.filter((item) => item.sessionId !== sessionId),
    }));
    persistSessionSnapshot(set, get, sessionId, []);
  },
  deleteHistory: (sessionId) => {
    set((state) => ({
      dialog: null,
      history: state.history.filter((item) => item.sessionId !== sessionId),
      sessions: state.sessions.filter((item) => item.id !== sessionId),
      results: state.results.filter((item) => item.sessionId !== sessionId),
    }));
    if (get().dataSource === "database") persistDatabaseMutation(set, get, { resource: "delete-history", sessionId });
  },
}));

export function resolveSetupWords(setup: PracticeSetup, words: VocabularyWord[], results: DictationResult[] = []): VocabularyWord[] {
  const source = setup.source;
  const select = (items: VocabularyWord[]) => (setup.orderMode === "sample" ? items.slice(0, setup.sampleCount ?? items.length) : items);
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

function shuffleWords(words: VocabularyWord[]): VocabularyWord[] {
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

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 8);
}

function normalizeWordKey(value: string): string {
  return value.trim().toLowerCase();
}

function findPracticeWordForDictionaryEntry(words: VocabularyWord[], entry: DictionaryEntry): VocabularyWord | undefined {
  const normalized = entry.word.trim().toLowerCase();
  return words.find((word) => word.dictionaryEntryId === entry.id || word.word.trim().toLowerCase() === normalized);
}

function resolveWordTarget(state: AppState, wordId: number): VocabularyWord | null {
  const existing = state.words.find((word) => word.id === wordId);
  if (existing) return existing;
  if (wordId < 0) {
    const entry = state.dictionary.find((item) => item.id === Math.abs(wordId));
    if (entry) return createTransientDictionaryWord(entry);
  }
  return null;
}

function ensureWordInCollection(words: VocabularyWord[], target: VocabularyWord): VocabularyWord[] {
  return words.some((word) => word.id === target.id) ? words : [...words, target];
}

function createTransientDictionaryWord(entry: DictionaryEntry): VocabularyWord {
  return {
    id: -Math.abs(entry.id),
    libraryId: 0,
    dictionaryEntryId: entry.id,
    wordKey: normalizeWordKey(entry.word),
    transientSource: "dictionary",
    word: entry.word,
    meaning: entry.meaningCn,
    phonetic: entry.usPhonetic ?? entry.ukPhonetic,
    partOfSpeech: entry.partOfSpeech,
    isFavorite: false,
    inWrongBook: false,
    masteryLevel: 0,
    wrongCount: 0,
    dictationCount: 0,
    addedAt: Date.now(),
  };
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

function wordIdentity(word: Pick<VocabularyWord, "dictionaryEntryId" | "word" | "wordKey">): { dictionaryEntryId?: number; wordKey: string } {
  return {
    dictionaryEntryId: word.dictionaryEntryId,
    wordKey: normalizeWordKey(word.wordKey ?? word.word),
  };
}

function sameWordIdentity(left: VocabularyWord, right: VocabularyWord): boolean {
  if (left.dictionaryEntryId != null && right.dictionaryEntryId != null && left.dictionaryEntryId === right.dictionaryEntryId) return true;
  return normalizeWordKey(left.wordKey ?? left.word) === normalizeWordKey(right.wordKey ?? right.word);
}

function sameResultIdentity(result: DictationResult, identity: { dictionaryEntryId?: number; wordKey: string }): boolean {
  if (!identity.wordKey) return false;
  return normalizeWordKey(result.correctAnswer || result.word) === identity.wordKey;
}

function updateWordsForResultTransition(
  words: VocabularyWord[],
  wordId: number,
  previousResult: DictationResultStatus,
  nextResult: DictationResultStatus,
  markedAt: number,
): { words: VocabularyWord[]; target?: VocabularyWord } {
  const target = words.find((word) => word.id === wordId);
  if (!target) return { words };
  let updatedTarget: VocabularyWord | undefined;
  const updatedWords = words.map((word) => {
    if (!sameWordIdentity(word, target)) return word;
    const updated = updateWordForResultTransition(word, previousResult, nextResult, markedAt);
    if (word.id === target.id) updatedTarget = updated;
    return updated;
  });
  return { words: updatedWords, target: updatedTarget };
}

function updateWordForManualMark(
  word: VocabularyWord,
  previousResult: DictationResultStatus,
  nextResult: DictationResultStatus,
  markedAt: number,
): VocabularyWord {
  return updateWordForResultTransition(word, previousResult, nextResult, markedAt);
}

function updateWordForResultTransition(
  word: VocabularyWord,
  previousResult: DictationResultStatus,
  nextResult: DictationResultStatus,
  markedAt: number,
): VocabularyWord {
  const previousAnswered = previousResult !== "unmarked";
  const nextAnswered = nextResult !== "unmarked";
  const dictationDelta = previousAnswered === nextAnswered ? 0 : nextAnswered ? 1 : -1;
  const wrongDelta = resultWrongCountScore(nextResult) - resultWrongCountScore(previousResult);
  const masteryDelta = resultMasteryScore(nextResult) - resultMasteryScore(previousResult);
  const masteryLevel = Math.max(0, Math.min(10, word.masteryLevel + masteryDelta));
  const wrongCount = Math.max(0, word.wrongCount + wrongDelta);
  const mastered = masteryLevel >= 10;
  return {
    ...word,
    dictationCount: Math.max(0, word.dictationCount + dictationDelta),
    wrongCount: mastered ? 0 : wrongCount,
    inWrongBook: mastered ? false : nextResult === "wrong" ? true : word.inWrongBook,
    masteryLevel,
    lastDictatedAt: markedAt,
  };
}

function sessionDurationSec(session: DictationSession | undefined, endedAt: number): number {
  if (!session) return 0;
  const activePauseSec = session.pausedAt ? Math.max(0, Math.round((endedAt - session.pausedAt) / 1000)) : 0;
  return Math.max(0, Math.round((endedAt - session.createdAt) / 1000) - (session.pausedDurationSec ?? 0) - activePauseSec);
}

function resultMasteryScore(result: DictationResultStatus): number {
  if (result === "correct") return 2;
  if (result === "wrong") return -1;
  return 0;
}

function resultWrongCountScore(result: DictationResultStatus): number {
  return result === "wrong" ? 1 : 0;
}

function resolveSourceName(setup: PracticeSetup, libraries: VocabularyLibrary[], words: VocabularyWord[]): string {
  const source = setup.source;
  if (source.sourceType === "library") return libraries.find((library) => library.id === source.sourceId)?.name ?? "词库";
  if (source.sourceType === "unit") return "Unit";
  if (source.sourceType === "wrong_book") return "错题本";
  if (source.sourceType === "favorite") return "收藏夹";
  if (source.sourceType === "history_session") return "历史记录";
  if (source.sourceType === "words") {
    const selected = resolveSetupWords(setup, words);
    const counts = new Map<number, number>();
    for (const word of selected) counts.set(word.libraryId, (counts.get(word.libraryId) ?? 0) + 1);
    const groups = [...counts.entries()].map(([libraryId, count]) => `${libraryId === 0 ? "词典" : libraries.find((library) => library.id === libraryId)?.name ?? "词库"} · ${count}词`);
    if (!groups.length) return "选中单词";
    if (groups.length <= 2) return groups.join(" + ");
    return `${groups[0]} 等 ${groups.length} 个来源`;
  }
  return "未选择来源";
}
