export type DatabaseQuery =
  | { resource: "bootstrap" }
  | { resource: "libraries" }
  | { resource: "library-detail"; libraryId: number }
  | { resource: "dictionary-search"; query: string; limit?: number }
  | { resource: "dictionary-entry"; entryId?: number; word?: string; limitExamples?: number }
  | { resource: "search-history"; limit?: number }
  | { resource: "record-search"; query: string; entryId?: number }
  | { resource: "settings" }
  | { resource: "create-library"; name: string; description?: string; tags?: string[]; coverColor?: string; coverIcon?: string }
  | { resource: "delete-library"; libraryId: number }
  | { resource: "update-library-order"; libraryIds: number[] }
  | { resource: "delete-word"; wordId: number }
  | { resource: "toggle-favorite"; wordId?: number; dictionaryEntryId?: number; wordKey?: string; word?: string; isFavorite: boolean }
  | { resource: "toggle-wrong-book"; wordId?: number; dictionaryEntryId?: number; wordKey?: string; word?: string; inWrongBook: boolean; userAnswer?: string }
  | { resource: "update-settings"; settings: Record<string, unknown> }
  | { resource: "import-words"; rows: Record<string, unknown>[]; targetLibraryId?: number }
  | { resource: "restore-data"; backup: Record<string, unknown> }
  | { resource: "clear-data" }
  | { resource: "save-practice-queue"; items: Record<string, unknown>[] }
  | { resource: "save-session"; session: Record<string, unknown>; results: Record<string, unknown>[]; words: Record<string, unknown>[] }
  | { resource: "delete-history"; sessionId: number };

export type DatabaseResponse = { ok: true; data: unknown } | { ok: false; error: string };

export type ApplicationDatabaseServiceOptions = {
  dbPath: string;
  developmentDbPath?: string | null;
  migrationPath?: string | null;
  findBundledResource?: (relativePath: string) => string | null;
};

export type ApplicationDatabaseService = {
  handleQuery: (request: DatabaseQuery) => DatabaseResponse;
};
