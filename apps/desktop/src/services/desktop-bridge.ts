import type {
  AppSettings,
  DictionaryEntry,
  DictionaryExample,
  DictationResult,
  DictationSession,
  HistoryItem,
  SearchHistoryItem,
  VocabularyLibrary,
  VocabularyUnit,
  VocabularyWord,
} from "@dictation/domain";

export type AppBootstrap = {
  libraries: VocabularyLibrary[];
  units: VocabularyUnit[];
  words: VocabularyWord[];
  dictionary: DictionaryEntry[];
  examples: DictionaryExample[];
  sessions: DictationSession[];
  results: DictationResult[];
  history: HistoryItem[];
  searchHistory: SearchHistoryItem[];
  practiceQueueWordIds?: number[];
  settings: AppSettings;
};

type DatabaseResponse<T> = { ok: true; data: T } | { ok: false; error: string };

type DictationBridge = {
  app: {
    getAppVersion: () => Promise<string>;
    getPlatform: () => NodeJS.Platform;
    openExternal: (url: string) => Promise<boolean>;
  };
  database: {
    query: <T>(request: { resource: string; [key: string]: unknown }) => Promise<DatabaseResponse<T>>;
  };
  file: {
    selectImportFile: () => Promise<ImportFileResult | null>;
    selectDataBackupFile: () => Promise<{ filePath: string; fileName: string; text: string } | null>;
    saveTextFile: (request: { defaultPath: string; content: string; filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
    exportTatoebaAttributionCsv: () => Promise<string | null>;
    clearCache: () => Promise<{ removedFiles: number; removedBytes: number }>;
  };
  audio: {
    play: (request: unknown) => Promise<{ ok: boolean; fileUrl?: string; filePath?: string; dataUrl?: string; source?: string; reason?: string }>;
    prepare?: (request: unknown) => Promise<{ ok: boolean; fileUrl?: string; filePath?: string; source?: string; reason?: string }>;
    playFile?: (request: unknown) => Promise<{ ok: boolean; reason?: string }>;
    pause: () => Promise<boolean>;
    stop: () => Promise<boolean>;
  };
};

export type ImportFileResult =
  | { ok: true; filePath: string; fileName: string; text: string }
  | { ok: false; filePath?: string; fileName?: string; error: string };

declare global {
  interface Window {
    dictationBridge?: DictationBridge;
  }
}

export function hasDesktopBridge(): boolean {
  return typeof window !== "undefined" && Boolean(window.dictationBridge);
}

export async function loadDesktopBootstrap(): Promise<AppBootstrap | null> {
  if (!hasDesktopBridge()) return null;
  const response = await window.dictationBridge!.database.query<AppBootstrap>({ resource: "bootstrap" });
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

export async function runDesktopDatabaseMutation(request: { resource: string; [key: string]: unknown }): Promise<AppBootstrap | null> {
  if (!hasDesktopBridge()) return null;
  const response = await window.dictationBridge!.database.query<AppBootstrap>(request);
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

export async function queryDesktopDatabase<T>(request: { resource: string; [key: string]: unknown }): Promise<T | null> {
  if (!hasDesktopBridge()) return null;
  const response = await window.dictationBridge!.database.query<T>(request);
  if (!response.ok) throw new Error(response.error);
  return response.data;
}

export async function selectDesktopImportFile(): Promise<ImportFileResult | null> {
  if (!hasDesktopBridge()) return null;
  return window.dictationBridge!.file.selectImportFile();
}

export async function selectDesktopDataBackupFile(): Promise<{ filePath: string; fileName: string; text: string } | null> {
  if (!hasDesktopBridge()) return null;
  return window.dictationBridge!.file.selectDataBackupFile();
}

export async function clearDesktopCache(): Promise<{ removedFiles: number; removedBytes: number } | null> {
  if (!hasDesktopBridge()) return null;
  return window.dictationBridge!.file.clearCache();
}

export async function exportTatoebaAttributionCsv(): Promise<string | null> {
  if (!hasDesktopBridge()) return null;
  return window.dictationBridge!.file.exportTatoebaAttributionCsv();
}

export async function openExternalUrl(url: string): Promise<void> {
  if (hasDesktopBridge()) {
    await window.dictationBridge!.app.openExternal(url);
    return;
  }
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
}

export async function playDesktopAudio(request: unknown): Promise<{ ok: boolean; fileUrl?: string; filePath?: string; dataUrl?: string; source?: string; reason?: string } | null> {
  if (!hasDesktopBridge()) return null;
  return window.dictationBridge!.audio.play(request);
}

export async function saveTextFile(defaultPath: string, content: string, mime = "text/csv;charset=utf-8"): Promise<void> {
  if (hasDesktopBridge()) {
    await window.dictationBridge!.file.saveTextFile({ defaultPath, content });
    return;
  }
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = defaultPath;
  link.click();
  URL.revokeObjectURL(link.href);
}
