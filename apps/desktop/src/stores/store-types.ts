import type {
  Accent,
  AppSettings,
  DictionaryEntry,
  DictionaryExample,
  DictationMode,
  DictationResult,
  DictationResultStatus,
  DictationSession,
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
import type { ImportPreviewRow } from "@dictation/import-export";

export type DialogName =
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

export type LibraryListUiState = {
  scrollTop?: number;
  activeWordId?: number;
  wordFilter?: "all" | "mastered" | "wrong";
  sortField?: "word" | "added" | "mastery" | "wrong";
  sortOrder?: "asc" | "desc";
  appliedSearch?: string;
};

export type CreateLibraryInput = {
  name: string;
  tags?: string[];
  coverColor?: string;
};

export type AppBackup = Partial<Pick<AppState, "libraries" | "units" | "words" | "sessions" | "results" | "history" | "searchHistory" | "settings">>;

export type AppState = {
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
  dataSource: "empty" | "database";
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
  libraryListUiState: Record<string, LibraryListUiState>;
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
  setLibraryListUiState: (key: string, patch: Partial<LibraryListUiState>) => void;
  importWords: (rows: ImportPreviewRow[], targetLibraryId?: number, options?: { silent?: boolean }) => Promise<boolean>;
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
  materializePracticeSample: () => VocabularyWord[];
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
  previousWord: (sessionId?: number) => void;
  nextWord: (sessionId: number) => boolean;
  pauseSession: (sessionId: number) => void;
  resumeSession: (sessionId: number) => void;
  completeSession: (sessionId: number) => void;
  abandonSession: (sessionId: number) => void;
  deleteHistory: (sessionId: number) => void;
};

export type SetAppState = (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void;
export type GetAppState = () => AppState;
