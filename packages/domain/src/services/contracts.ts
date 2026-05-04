import type {
  AppSettings,
  DictionaryEntry,
  DictionaryExample,
  DictationResult,
  DictationSession,
  DictationSummary,
  HistoryItem,
  PracticeSetup,
  VocabularyLibrary,
  VocabularyUnit,
  VocabularyWord,
} from "../models/types";

export interface DictionaryService {
  search(query: string): Promise<DictionaryEntry[]>;
  getEntry(entryId: number): Promise<{ entry: DictionaryEntry; examples: DictionaryExample[] }>;
}

export interface LibraryService {
  getShelf(): Promise<{ system: VocabularyLibrary[]; official: VocabularyLibrary[]; custom: VocabularyLibrary[] }>;
  createLibrary(input: { name: string; description?: string; tags?: string[]; coverColor?: string }): Promise<VocabularyLibrary>;
  deleteLibrary(libraryId: number): Promise<void>;
  getLibraryDetail(libraryId: number): Promise<{ library: VocabularyLibrary; units: VocabularyUnit[]; words: VocabularyWord[] }>;
}

export interface WordService {
  toggleFavorite(wordId: number): Promise<void>;
  toggleWrongBook(wordId: number): Promise<void>;
  deleteWord(wordId: number): Promise<void>;
}

export interface PracticeService {
  resolveSource(setup: PracticeSetup): Promise<VocabularyWord[]>;
  createSession(setup: PracticeSetup): Promise<DictationSession>;
  submitAnswer(sessionId: number, wordId: number, answer: string): Promise<DictationResult>;
  completeSession(sessionId: number): Promise<DictationSummary>;
}

export interface HistoryService {
  getHistory(): Promise<HistoryItem[]>;
  getHistoryDetail(sessionId: number): Promise<{ session: DictationSession; results: DictationResult[] }>;
  deleteHistory(sessionId: number): Promise<void>;
}

export interface SettingsService {
  getSettings(): Promise<AppSettings>;
  updateSettings(input: Partial<AppSettings>): Promise<AppSettings>;
}

export interface ImportExportService {
  parseImportFile(path: string): Promise<unknown>;
  exportLibrary(libraryId: number): Promise<{ filePath: string }>;
  exportHistory(sessionId: number): Promise<{ filePath: string }>;
}
