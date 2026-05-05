import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";
import { DatabaseSync } from "node:sqlite";

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

const electronDir = path.dirname(fileURLToPath(import.meta.url));
const builtInLibraryColor = "#D4916E";
let db: DatabaseSync | null = null;

type DatabaseResponse = { ok: true; data: unknown } | { ok: false; error: string };
type DatabaseHandler<T extends DatabaseQuery = DatabaseQuery> = (database: DatabaseSync, request: T) => DatabaseResponse;
type DatabaseHandlerMap = {
  [Resource in DatabaseQuery["resource"]]: DatabaseHandler<Extract<DatabaseQuery, { resource: Resource }>>;
};

const databaseHandlers = {
  bootstrap: ((database) => ({ ok: true, data: readBootstrap(database) })) as DatabaseHandler<Extract<DatabaseQuery, { resource: "bootstrap" }>>,
  libraries: ((database) => ({ ok: true, data: findLibraries(database) })) as DatabaseHandler<Extract<DatabaseQuery, { resource: "libraries" }>>,
  "library-detail": ((database, request) => ({
    ok: true,
    data: {
      library: findLibraries(database).find((library) => library.id === request.libraryId) ?? null,
      units: findUnits(database).filter((unit) => unit.libraryId === request.libraryId),
      words: findWords(database, request.libraryId),
    },
  })) as DatabaseHandler<Extract<DatabaseQuery, { resource: "library-detail" }>>,
  "dictionary-search": ((database, request) => ({ ok: true, data: searchDictionary(database, request.query, request.limit ?? 24) })) as DatabaseHandler<Extract<DatabaseQuery, { resource: "dictionary-search" }>>,
  "dictionary-entry": ((database, request) => ({ ok: true, data: findDictionaryEntryWithExamples(database, request) })) as DatabaseHandler<Extract<DatabaseQuery, { resource: "dictionary-entry" }>>,
  "search-history": ((database, request) => ({ ok: true, data: findSearchHistory(database, request.limit ?? 12) })) as DatabaseHandler<Extract<DatabaseQuery, { resource: "search-history" }>>,
  "record-search": ((database, request) => {
    recordSearch(database, request.query, request.entryId);
    return { ok: true, data: null };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "record-search" }>>,
  settings: ((database) => ({ ok: true, data: getSettings(database) })) as DatabaseHandler<Extract<DatabaseQuery, { resource: "settings" }>>,
  "create-library": ((database, request) => {
    createLibrary(database, request);
    return { ok: true, data: readBootstrap(database) };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "create-library" }>>,
  "delete-library": ((database, request) => {
    database.prepare("DELETE FROM vocabulary_libraries WHERE id = ? AND type = 'custom'").run(request.libraryId);
    return { ok: true, data: readBootstrap(database) };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "delete-library" }>>,
  "update-library-order": ((database, request) => {
    updateLibraryOrder(database, request.libraryIds);
    return { ok: true, data: readBootstrap(database) };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "update-library-order" }>>,
  "delete-word": ((database, request) => {
    deleteWord(database, request.wordId);
    return { ok: true, data: readBootstrap(database) };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "delete-word" }>>,
  "toggle-favorite": ((database, request) => {
    setFavorite(database, request);
    return { ok: true, data: null };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "toggle-favorite" }>>,
  "toggle-wrong-book": ((database, request) => {
    setWrongBook(database, request);
    return { ok: true, data: null };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "toggle-wrong-book" }>>,
  "update-settings": ((database, request) => {
    updateSettings(database, request.settings);
    return { ok: true, data: readBootstrap(database) };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "update-settings" }>>,
  "import-words": ((database, request) => {
    importWords(database, request.rows, request.targetLibraryId);
    return { ok: true, data: readBootstrap(database) };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "import-words" }>>,
  "restore-data": ((database, request) => {
    restoreData(database, request.backup);
    return { ok: true, data: readBootstrap(database) };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "restore-data" }>>,
  "clear-data": ((database) => {
    clearUserData(database);
    return { ok: true, data: readBootstrap(database) };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "clear-data" }>>,
  "save-practice-queue": ((database, request) => {
    savePracticeQueue(database, request.items);
    return { ok: true, data: null };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "save-practice-queue" }>>,
  "save-session": ((database, request) => {
    saveSession(database, request.session, request.results, request.words);
    return { ok: true, data: null };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "save-session" }>>,
  "delete-history": ((database, request) => {
    database.prepare("DELETE FROM dictation_sessions WHERE id = ?").run(request.sessionId);
    return { ok: true, data: readBootstrap(database) };
  }) as DatabaseHandler<Extract<DatabaseQuery, { resource: "delete-history" }>>,
} satisfies DatabaseHandlerMap;

export function handleDatabaseQuery(request: DatabaseQuery) {
  const handler = request?.resource ? databaseHandlers[request.resource] : undefined;
  if (!handler) return { ok: false, error: "UNKNOWN_DATABASE_RESOURCE" };
  return (handler as DatabaseHandler)(getDatabase(), request);
}

function readBootstrap(database: DatabaseSync) {
  return {
    libraries: findLibraries(database),
    units: findUnits(database),
    words: [...findWords(database), ...findQueuedDictionaryWords(database), ...findStateOnlyDictionaryWords(database)],
    dictionary: [],
    examples: [],
    sessions: findSessions(database),
    results: findResults(database),
    history: buildHistory(database),
    searchHistory: findSearchHistory(database, 12),
    practiceQueueWordIds: findPracticeQueueWordIds(database),
    settings: getSettings(database),
  };
}

function getDatabase(): DatabaseSync {
  if (db) return db;
  const dbPath = resolveDatabasePath();
  mkdirSync(path.dirname(dbPath), { recursive: true });
  ensureDatabaseFile(dbPath);
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  applyMigration(db);
  ensureLibraryTagsColumn(db);
  ensureSessionTimingColumns(db);
  ensurePracticeQueueTable(db);
  ensureUserWordStateTables(db);
  ensureVocabularyWordUniqueIndex(db);
  ensureDictionarySearchIndexes(db);
  migrateLegacyWordState(db);
  ensureMinimumSeed(db);
  return db;
}

function resolveDatabasePath(): string {
  if (process.env.DICTATION_DB_PATH) return path.resolve(process.env.DICTATION_DB_PATH);
  const projectRoot = findProjectRoot();
  const developmentDb = projectRoot ? path.join(projectRoot, "data", "processed", "dictation.sqlite") : null;
  if (!app.isPackaged && developmentDb) return developmentDb;
  return path.join(app.getPath("userData"), "dictation.sqlite");
}

function ensureDatabaseFile(targetPath: string): void {
  if (existsSync(targetPath)) return;
  const bundledDb = findBundledResource("data/processed/dictation.sqlite");
  if (bundledDb) {
    copyFileSync(bundledDb, targetPath);
    return;
  }
  const projectRoot = findProjectRoot();
  const developmentDb = projectRoot ? path.join(projectRoot, "data", "processed", "dictation.sqlite") : null;
  if (developmentDb && developmentDb !== targetPath && existsSync(developmentDb)) {
    copyFileSync(developmentDb, targetPath);
  }
}

function applyMigration(database: DatabaseSync): void {
  const bundledMigration = findBundledResource("data/migrations/0001_init.sql");
  if (bundledMigration) {
    database.exec(readFileSync(bundledMigration, "utf8"));
    return;
  }
  const projectRoot = findProjectRoot();
  const migrationPath = projectRoot ? path.join(projectRoot, "data", "migrations", "0001_init.sql") : null;
  if (migrationPath && existsSync(migrationPath)) database.exec(readFileSync(migrationPath, "utf8"));
}

function ensureLibraryTagsColumn(database: DatabaseSync): void {
  const columns = database.prepare("PRAGMA table_info(vocabulary_libraries)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "tags_json")) {
    database.exec("ALTER TABLE vocabulary_libraries ADD COLUMN tags_json TEXT");
  }
}

function ensureSessionTimingColumns(database: DatabaseSync): void {
  const columns = database.prepare("PRAGMA table_info(dictation_sessions)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "paused_duration_sec")) {
    database.exec("ALTER TABLE dictation_sessions ADD COLUMN paused_duration_sec INTEGER NOT NULL DEFAULT 0");
  }
  if (!columns.some((column) => column.name === "paused_at")) {
    database.exec("ALTER TABLE dictation_sessions ADD COLUMN paused_at INTEGER");
  }
}

function ensurePracticeQueueTable(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS practice_queue_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}

function ensureUserWordStateTables(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS user_word_state (
      word_key TEXT PRIMARY KEY,
      dictionary_entry_id INTEGER,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      mastery_level INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      dictation_count INTEGER NOT NULL DEFAULT 0,
      last_dictated_at INTEGER,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (dictionary_entry_id) REFERENCES dictionary_entries(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS favorite_entries (
      word_key TEXT PRIMARY KEY,
      dictionary_entry_id INTEGER,
      favorited_at INTEGER NOT NULL,
      FOREIGN KEY (dictionary_entry_id) REFERENCES dictionary_entries(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS wrong_book_entries (
      word_key TEXT PRIMARY KEY,
      dictionary_entry_id INTEGER,
      wrong_count INTEGER NOT NULL DEFAULT 1,
      last_wrong_at INTEGER NOT NULL,
      last_user_answer TEXT,
      FOREIGN KEY (dictionary_entry_id) REFERENCES dictionary_entries(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_user_word_state_entry ON user_word_state(dictionary_entry_id);
    CREATE INDEX IF NOT EXISTS idx_favorite_entries_entry ON favorite_entries(dictionary_entry_id);
    CREATE INDEX IF NOT EXISTS idx_wrong_book_entries_entry ON wrong_book_entries(dictionary_entry_id);
  `);
}

function migrateLegacyWordState(database: DatabaseSync): void {
  const now = Date.now();
  database.exec("BEGIN");
  try {
    database
      .prepare(
        `INSERT INTO user_word_state (word_key, dictionary_entry_id, is_favorite, mastery_level, wrong_count, dictation_count, last_dictated_at, updated_at)
         SELECT lower(trim(word)), min(dictionary_entry_id), max(is_favorite), max(mastery_level), max(wrong_count), max(dictation_count), max(last_dictated_at), ?
         FROM vocabulary_words
         WHERE lower(trim(word)) != ''
         GROUP BY lower(trim(word))
         ON CONFLICT(word_key) DO UPDATE SET
           dictionary_entry_id = coalesce(user_word_state.dictionary_entry_id, excluded.dictionary_entry_id),
           is_favorite = max(user_word_state.is_favorite, excluded.is_favorite),
           mastery_level = max(user_word_state.mastery_level, excluded.mastery_level),
           wrong_count = max(user_word_state.wrong_count, excluded.wrong_count),
           dictation_count = max(user_word_state.dictation_count, excluded.dictation_count),
           last_dictated_at = coalesce(max(user_word_state.last_dictated_at, excluded.last_dictated_at), user_word_state.last_dictated_at, excluded.last_dictated_at),
           updated_at = excluded.updated_at`,
      )
      .run(now);
    database
      .prepare(
        `INSERT OR IGNORE INTO favorite_entries (word_key, dictionary_entry_id, favorited_at)
         SELECT s.word_key, s.dictionary_entry_id, ?
         FROM user_word_state s
         WHERE s.is_favorite = 1`,
      )
      .run(now);
    database
      .prepare(
        `INSERT OR IGNORE INTO wrong_book_entries (word_key, dictionary_entry_id, wrong_count, last_wrong_at, last_user_answer)
         SELECT s.word_key, s.dictionary_entry_id, max(1, s.wrong_count), ?, NULL
         FROM user_word_state s
         WHERE s.wrong_count > 0`,
      )
      .run(now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function ensureVocabularyWordUniqueIndex(database: DatabaseSync): void {
  database.exec(`
    DELETE FROM vocabulary_words
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM vocabulary_words
      GROUP BY library_id, lower(word)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vocabulary_words_library_word_unique ON vocabulary_words(library_id, lower(word));
  `);
}

function ensureDictionarySearchIndexes(database: DatabaseSync): void {
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_dictionary_entries_word_nocase ON dictionary_entries(word COLLATE NOCASE);
  `);
}

function ensureMinimumSeed(database: DatabaseSync): void {
  const row = database.prepare("SELECT count(*) as count FROM vocabulary_libraries").get() as { count: number };
  if (Number(row.count) > 0) return;
  const now = Date.now();
  database
    .prepare(
      "INSERT INTO vocabulary_libraries (id, name, description, type, cover_color, cover_icon, word_count, unit_count, progress, accuracy, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(1, "错题本", "自动收集听写错误和跳过的单词", "wrong_book", "#D4916E", "triangle-alert", 0, 0, 0, null, 1, now, now);
  database
    .prepare(
      "INSERT INTO vocabulary_libraries (id, name, description, type, cover_color, cover_icon, word_count, unit_count, progress, accuracy, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(2, "收藏夹", "收藏的重要单词", "favorite", builtInLibraryColor, "star", 0, 0, 0, null, 2, now, now);
}

function createLibrary(
  database: DatabaseSync,
  input: { name: string; description?: string; tags?: string[]; coverColor?: string; coverIcon?: string },
): void {
  const now = Date.now();
  const result = database
    .prepare(
      "INSERT INTO vocabulary_libraries (name, description, tags_json, type, cover_color, cover_icon, word_count, unit_count, progress, sort_order, created_at, updated_at) VALUES (?, ?, ?, 'custom', ?, ?, 0, 1, 0, 1000, ?, ?)",
    )
    .run(input.name.trim(), input.description ?? "自建词库", JSON.stringify(normalizeTags(input.tags)), input.coverColor ?? "#D4916E", input.coverIcon ?? "book", now, now);
  database
    .prepare("INSERT INTO vocabulary_units (library_id, name, sort_order, word_count) VALUES (?, '全部', 0, 0)")
    .run(Number(result.lastInsertRowid));
}

function updateLibraryOrder(database: DatabaseSync, libraryIds: number[]): void {
  const now = Date.now();
  const update = database.prepare("UPDATE vocabulary_libraries SET sort_order = ?, updated_at = ? WHERE id = ?");
  database.exec("BEGIN");
  try {
    libraryIds.forEach((id, index) => update.run(index + 10, now, Number(id)));
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

type WordIdentity = {
  wordKey: string;
  dictionaryEntryId: number | null;
  word?: string;
};

function setFavorite(
  database: DatabaseSync,
  input: { wordId?: number; dictionaryEntryId?: number; wordKey?: string; word?: string; isFavorite: boolean },
): void {
  const identity = resolveWordIdentity(database, input);
  if (!identity) return;
  upsertUserWordState(database, { ...identity, isFavorite: input.isFavorite });
  database.prepare("UPDATE vocabulary_words SET is_favorite = ? WHERE lower(trim(word)) = ?").run(input.isFavorite ? 1 : 0, identity.wordKey);
  if (input.isFavorite) {
    database.prepare("INSERT OR REPLACE INTO favorite_entries (word_key, dictionary_entry_id, favorited_at) VALUES (?, ?, ?)").run(identity.wordKey, identity.dictionaryEntryId, Date.now());
    database
      .prepare(
        `INSERT OR REPLACE INTO favorite_words (word_id, favorited_at)
         SELECT id, ?
         FROM vocabulary_words
         WHERE lower(trim(word)) = ?`,
      )
      .run(Date.now(), identity.wordKey);
  } else {
    database.prepare("DELETE FROM favorite_entries WHERE word_key = ?").run(identity.wordKey);
    database.prepare("DELETE FROM favorite_words WHERE word_id IN (SELECT id FROM vocabulary_words WHERE lower(trim(word)) = ?)").run(identity.wordKey);
  }
}

function deleteWord(database: DatabaseSync, wordId: number): void {
  database.prepare("DELETE FROM vocabulary_words WHERE id = ?").run(wordId);
  refreshLibraryCounts(database);
}

function setWrongBook(
  database: DatabaseSync,
  input: { wordId?: number; dictionaryEntryId?: number; wordKey?: string; word?: string; inWrongBook: boolean; userAnswer?: string },
): void {
  const identity = resolveWordIdentity(database, input);
  if (!identity) return;
  if (input.inWrongBook) {
    const row = database.prepare("SELECT wrong_count FROM user_word_state WHERE word_key = ?").get(identity.wordKey) as { wrong_count?: number } | undefined;
    const wrongCount = Math.max(1, Number(row?.wrong_count ?? 0));
    upsertUserWordState(database, { ...identity, wrongCount });
    database.prepare("UPDATE vocabulary_words SET wrong_count = ? WHERE lower(trim(word)) = ?").run(wrongCount, identity.wordKey);
    database
      .prepare(
        "INSERT INTO wrong_book_entries (word_key, dictionary_entry_id, wrong_count, last_wrong_at, last_user_answer) VALUES (?, ?, ?, ?, ?) ON CONFLICT(word_key) DO UPDATE SET wrong_count = excluded.wrong_count, last_wrong_at = excluded.last_wrong_at, last_user_answer = excluded.last_user_answer",
      )
      .run(identity.wordKey, identity.dictionaryEntryId, wrongCount, Date.now(), input.userAnswer ?? null);
    database
      .prepare(
        `INSERT OR REPLACE INTO wrong_book_words (word_id, wrong_count, last_wrong_at, last_user_answer)
         SELECT id, ?, ?, ?
         FROM vocabulary_words
         WHERE lower(trim(word)) = ?`,
      )
      .run(wrongCount, Date.now(), input.userAnswer ?? null, identity.wordKey);
  } else {
    upsertUserWordState(database, { ...identity, wrongCount: 0 });
    database.prepare("UPDATE vocabulary_words SET wrong_count = 0 WHERE lower(trim(word)) = ?").run(identity.wordKey);
    database.prepare("DELETE FROM wrong_book_entries WHERE word_key = ?").run(identity.wordKey);
    database.prepare("DELETE FROM wrong_book_words WHERE word_id IN (SELECT id FROM vocabulary_words WHERE lower(trim(word)) = ?)").run(identity.wordKey);
  }
}

function resolveWordIdentity(
  database: DatabaseSync,
  input: { wordId?: number; dictionaryEntryId?: number; wordKey?: string; word?: string },
): WordIdentity | null {
  const directKey = normalizeWordKey(input.wordKey ?? input.word);
  if (directKey) return enrichWordIdentity(database, { wordKey: directKey, dictionaryEntryId: input.dictionaryEntryId ?? null, word: input.word });
  const wordId = Number(input.wordId);
  if (Number.isFinite(wordId) && wordId < 0) {
    const entry = database.prepare("SELECT id, word FROM dictionary_entries WHERE id = ?").get(Math.abs(wordId)) as { id: number; word: string } | undefined;
    if (entry) return { wordKey: normalizeWordKey(entry.word), dictionaryEntryId: Number(entry.id), word: String(entry.word) };
  }
  if (Number.isFinite(wordId) && wordId > 0) {
    const row = database.prepare("SELECT word, dictionary_entry_id FROM vocabulary_words WHERE id = ?").get(wordId) as { word: string; dictionary_entry_id?: number } | undefined;
    if (row) return enrichWordIdentity(database, { wordKey: normalizeWordKey(row.word), dictionaryEntryId: row.dictionary_entry_id == null ? null : Number(row.dictionary_entry_id), word: String(row.word) });
  }
  if (input.dictionaryEntryId != null) {
    const entry = database.prepare("SELECT id, word FROM dictionary_entries WHERE id = ?").get(Number(input.dictionaryEntryId)) as { id: number; word: string } | undefined;
    if (entry) return { wordKey: normalizeWordKey(entry.word), dictionaryEntryId: Number(entry.id), word: String(entry.word) };
  }
  return null;
}

function enrichWordIdentity(database: DatabaseSync, identity: WordIdentity): WordIdentity | null {
  if (!identity.wordKey) return null;
  if (identity.dictionaryEntryId != null) return identity;
  const entry = database.prepare("SELECT id, word FROM dictionary_entries WHERE lower(word) = ? ORDER BY source = 'custom' DESC, id LIMIT 1").get(identity.wordKey) as
    | { id: number; word: string }
    | undefined;
  return { ...identity, dictionaryEntryId: entry?.id == null ? null : Number(entry.id), word: identity.word ?? entry?.word };
}

function upsertUserWordState(
  database: DatabaseSync,
  input: WordIdentity & {
    isFavorite?: boolean;
    masteryLevel?: number;
    wrongCount?: number;
    dictationCount?: number;
    lastDictatedAt?: number | null;
  },
): void {
  const existing = database.prepare("SELECT * FROM user_word_state WHERE word_key = ?").get(input.wordKey) as Record<string, unknown> | undefined;
  const isFavorite = input.isFavorite == null ? Number(existing?.is_favorite ?? 0) : input.isFavorite ? 1 : 0;
  const masteryLevel = input.masteryLevel == null ? Number(existing?.mastery_level ?? 0) : Math.max(0, Math.min(10, Math.round(input.masteryLevel)));
  const wrongCount = input.wrongCount == null ? Number(existing?.wrong_count ?? 0) : Math.max(0, Math.round(input.wrongCount));
  const dictationCount = input.dictationCount == null ? Number(existing?.dictation_count ?? 0) : Math.max(0, Math.round(input.dictationCount));
  const lastDictatedAt = input.lastDictatedAt === undefined ? (existing?.last_dictated_at == null ? null : Number(existing.last_dictated_at)) : input.lastDictatedAt;
  database
    .prepare(
      `INSERT INTO user_word_state (word_key, dictionary_entry_id, is_favorite, mastery_level, wrong_count, dictation_count, last_dictated_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(word_key) DO UPDATE SET
         dictionary_entry_id = coalesce(excluded.dictionary_entry_id, user_word_state.dictionary_entry_id),
         is_favorite = excluded.is_favorite,
         mastery_level = excluded.mastery_level,
         wrong_count = excluded.wrong_count,
         dictation_count = excluded.dictation_count,
         last_dictated_at = excluded.last_dictated_at,
         updated_at = excluded.updated_at`,
    )
    .run(input.wordKey, input.dictionaryEntryId, isFavorite, masteryLevel, wrongCount, dictationCount, lastDictatedAt, Date.now());
}

function updateSettings(database: DatabaseSync, settings: Record<string, unknown>): void {
  const now = Date.now();
  const statement = database.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)");
  for (const [key, value] of Object.entries(settings)) statement.run(key, JSON.stringify(value), now);
}

function importWords(database: DatabaseSync, rows: Record<string, unknown>[], targetLibraryId?: number): void {
  const importableRows = rows.filter((row) => row.word);
  if (!importableRows.length) return;
  const now = Date.now();
  const libraryId = targetLibraryId ?? ensureImportLibrary(database, importableRows.length, now);
  const unitId = ensureDefaultUnit(database, libraryId);
  const insertEntry = database.prepare(
    "INSERT OR IGNORE INTO dictionary_entries (word, part_of_speech, meaning_cn, source, created_at, updated_at) VALUES (?, ?, ?, 'custom', ?, ?)",
  );
  const findEntry = database.prepare("SELECT id FROM dictionary_entries WHERE lower(word) = lower(?) ORDER BY source = 'custom' DESC, id LIMIT 1");
  const insertWord = database.prepare(
    "INSERT OR IGNORE INTO vocabulary_words (library_id, dictionary_entry_id, word, meaning, phonetic, part_of_speech, is_favorite, mastery_level, wrong_count, dictation_count, added_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)",
  );
  const insertWordUnit = database.prepare("INSERT OR IGNORE INTO vocabulary_word_units (word_id, unit_id) VALUES (?, ?)");
  database.exec("BEGIN");
  try {
    for (const [index, row] of importableRows.entries()) {
      const word = String(row.word).trim();
      if (!word) continue;
      const meaning = String(row.meaning || "暂无释义");
      insertEntry.run(word, row.partOfSpeech == null ? null : String(row.partOfSpeech), meaning, now, now);
      const entry = findEntry.get(word) as { id: number } | undefined;
      if (!entry) continue;
      const phonetic = row.phonetic == null ? findDictionaryPhonetic(database, Number(entry.id)) : String(row.phonetic);
      const result = insertWord.run(libraryId, Number(entry.id), word, meaning, phonetic, row.partOfSpeech == null ? null : String(row.partOfSpeech), now + index);
      const wordId = Number(result.lastInsertRowid) || findWordId(database, libraryId, word);
      if (wordId) insertWordUnit.run(wordId, unitId);
    }
    refreshLibraryCounts(database);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function findDictionaryPhonetic(database: DatabaseSync, entryId: number): string | null {
  const row = database.prepare("SELECT us_phonetic, uk_phonetic FROM dictionary_entries WHERE id = ?").get(entryId) as { us_phonetic?: string; uk_phonetic?: string } | undefined;
  return row?.us_phonetic ?? row?.uk_phonetic ?? null;
}

function findWordId(database: DatabaseSync, libraryId: number, word: string): number {
  const row = database.prepare("SELECT id FROM vocabulary_words WHERE library_id = ? AND lower(word) = lower(?)").get(libraryId, word) as { id: number } | undefined;
  return Number(row?.id ?? 0);
}

function savePracticeQueue(database: DatabaseSync, items: Record<string, unknown>[]): void {
  const now = Date.now();
  const insert = database.prepare("INSERT INTO practice_queue_items (item_type, item_id, sort_order, created_at) VALUES (?, ?, ?, ?)");
  database.exec("BEGIN");
  try {
    database.prepare("DELETE FROM practice_queue_items").run();
    for (const [index, item] of items.entries()) {
      const itemType = String(item.itemType ?? "");
      const itemId = Number(item.itemId);
      if (!["word", "dictionary_entry"].includes(itemType) || !Number.isFinite(itemId)) continue;
      insert.run(itemType, itemId, index, now + index);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function restoreData(database: DatabaseSync, backup: Record<string, unknown>): void {
  const libraries = Array.isArray(backup.libraries) ? backup.libraries : [];
  const units = Array.isArray(backup.units) ? backup.units : [];
  const words = Array.isArray(backup.words) ? backup.words : [];
  const sessions = Array.isArray(backup.sessions) ? backup.sessions : [];
  const results = Array.isArray(backup.results) ? backup.results : [];
  const settings = toRecord(backup.settings);
  database.exec("BEGIN");
  try {
    database.prepare("DELETE FROM dictation_results").run();
    database.prepare("DELETE FROM dictation_sessions").run();
    database.prepare("DELETE FROM vocabulary_word_units").run();
    database.prepare("DELETE FROM wrong_book_words").run();
    database.prepare("DELETE FROM favorite_words").run();
    database.prepare("DELETE FROM wrong_book_entries").run();
    database.prepare("DELETE FROM favorite_entries").run();
    database.prepare("DELETE FROM user_word_state").run();
    database.prepare("DELETE FROM vocabulary_words").run();
    database.prepare("DELETE FROM vocabulary_units").run();
    database.prepare("DELETE FROM vocabulary_libraries WHERE type != 'wrong_book' AND type != 'favorite'").run();
    const now = Date.now();
    const insertLibrary = database.prepare(
      "INSERT OR REPLACE INTO vocabulary_libraries (id, name, description, tags_json, type, cover_color, cover_icon, word_count, unit_count, progress, accuracy, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const raw of libraries) {
      const library = toRecord(raw);
      insertLibrary.run(
        Number(library.id),
        String(library.name ?? "词库"),
        optionalString(library.description) ?? "",
        JSON.stringify(Array.isArray(library.tags) ? library.tags : []),
        String(library.type ?? "custom"),
        optionalString(library.coverColor) ?? null,
        optionalString(library.coverIcon) ?? null,
        Number(library.wordCount ?? 0),
        Number(library.unitCount ?? 0),
        Number(library.progress ?? 0),
        library.accuracy == null ? null : Number(library.accuracy),
        Number(library.sortOrder ?? library.id ?? 1000),
        Number(library.createdAt ?? now),
        Number(library.updatedAt ?? now),
      );
    }
    const insertUnit = database.prepare("INSERT OR REPLACE INTO vocabulary_units (id, library_id, name, sort_order, word_count) VALUES (?, ?, ?, ?, ?)");
    for (const raw of units) {
      const unit = toRecord(raw);
      insertUnit.run(Number(unit.id), Number(unit.libraryId), String(unit.name ?? "全部"), Number(unit.sortOrder ?? 0), Number(unit.wordCount ?? 0));
    }
    const insertEntry = database.prepare("INSERT OR IGNORE INTO dictionary_entries (id, word, part_of_speech, meaning_cn, source, created_at, updated_at) VALUES (?, ?, ?, ?, 'custom', ?, ?)");
    const insertWord = database.prepare(
      "INSERT OR IGNORE INTO vocabulary_words (id, library_id, dictionary_entry_id, word, meaning, phonetic, part_of_speech, is_favorite, mastery_level, wrong_count, dictation_count, last_dictated_at, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    const insertWordUnit = database.prepare("INSERT OR IGNORE INTO vocabulary_word_units (word_id, unit_id) VALUES (?, ?)");
    for (const raw of words) {
      const word = toRecord(raw);
      const wordText = String(word.word ?? "").trim();
      if (!wordText) continue;
      const dictionaryEntryId = word.dictionaryEntryId == null ? null : Number(word.dictionaryEntryId);
      if (dictionaryEntryId) insertEntry.run(dictionaryEntryId, wordText, optionalString(word.partOfSpeech) ?? null, String(word.meaning ?? "暂无释义"), now, now);
      const identity = resolveWordIdentity(database, { dictionaryEntryId: dictionaryEntryId ?? undefined, word: wordText });
      if (identity) {
        upsertUserWordState(database, {
          ...identity,
          isFavorite: Boolean(word.isFavorite),
          masteryLevel: Number(word.masteryLevel ?? 0),
          wrongCount: Number(word.wrongCount ?? 0),
          dictationCount: Number(word.dictationCount ?? 0),
          lastDictatedAt: word.lastDictatedAt == null ? null : Number(word.lastDictatedAt),
        });
      }
      if (Number(word.libraryId) > 0 && Number(word.id) > 0) {
        insertWord.run(
          Number(word.id),
          Number(word.libraryId),
          dictionaryEntryId,
          wordText,
          String(word.meaning ?? "暂无释义"),
          optionalString(word.phonetic) ?? null,
          optionalString(word.partOfSpeech) ?? null,
          word.isFavorite ? 1 : 0,
          Number(word.masteryLevel ?? 0),
          Number(word.wrongCount ?? 0),
          Number(word.dictationCount ?? 0),
          word.lastDictatedAt == null ? null : Number(word.lastDictatedAt),
          Number(word.addedAt ?? now),
        );
        for (const unitId of Array.isArray(word.unitIds) ? word.unitIds : []) insertWordUnit.run(Number(word.id), Number(unitId));
      }
      if (word.isFavorite) setFavorite(database, { dictionaryEntryId: dictionaryEntryId ?? undefined, word: wordText, isFavorite: true });
      if (word.inWrongBook || Number(word.wrongCount ?? 0) > 0) setWrongBook(database, { dictionaryEntryId: dictionaryEntryId ?? undefined, word: wordText, inWrongBook: true });
    }
    const insertSession = database.prepare(
      "INSERT OR REPLACE INTO dictation_sessions (id, source_type, source_id, source_name, mode, accent, status, word_count, duration_sec, paused_duration_sec, paused_at, settings_json, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const raw of sessions) {
      const session = toRecord(raw);
      const source = toRecord(session.source);
      insertSession.run(
        Number(session.id),
        String(source.sourceType ?? "words"),
        source.sourceId == null ? null : Number(source.sourceId),
        String(session.sourceName ?? "听写"),
        String(session.mode ?? "typing"),
        String(session.accent ?? "us"),
        String(session.status ?? "completed"),
        Number(session.wordCount ?? 0),
        Number(session.durationSec ?? 0),
        Number(session.pausedDurationSec ?? 0),
        session.pausedAt == null ? null : Number(session.pausedAt),
        JSON.stringify({
          source,
          currentIndex: Number(session.currentIndex ?? 0),
          settings: toRecord(session.settings),
        }),
        Number(session.createdAt ?? now),
        session.completedAt == null ? null : Number(session.completedAt),
      );
    }
    const insertResult = database.prepare(
      "INSERT OR REPLACE INTO dictation_results (id, session_id, word_id, order_index, word, meaning, user_answer, correct_answer, result, hint_used, is_favorited, is_added_to_wrong_book, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const raw of results) {
      const result = toRecord(raw);
      insertResult.run(
        Number(result.id),
        Number(result.sessionId),
        Number(result.wordId),
        Number(result.orderIndex ?? 0),
        String(result.word ?? result.correctAnswer ?? ""),
        String(result.meaning ?? ""),
        result.userAnswer == null ? null : String(result.userAnswer),
        String(result.correctAnswer ?? result.word ?? ""),
        String(result.result ?? "wrong"),
        result.hintUsed ? 1 : 0,
        result.isFavorited ? 1 : 0,
        result.isAddedToWrongBook ? 1 : 0,
        now,
      );
    }
    updateSettings(database, settings);
    refreshLibraryCounts(database);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function clearUserData(database: DatabaseSync): void {
  const now = Date.now();
  database.exec("BEGIN");
  try {
    database.prepare("DELETE FROM dictation_results").run();
    database.prepare("DELETE FROM dictation_sessions").run();
    database.prepare("DELETE FROM practice_queue_items").run();
    database.prepare("DELETE FROM search_history").run();
    database.prepare("DELETE FROM import_preview_rows").run();
    database.prepare("DELETE FROM import_tasks").run();
    database.prepare("DELETE FROM wrong_book_words").run();
    database.prepare("DELETE FROM favorite_words").run();
    database.prepare("DELETE FROM wrong_book_entries").run();
    database.prepare("DELETE FROM favorite_entries").run();
    database.prepare("DELETE FROM user_word_state").run();
    database
      .prepare(
        `DELETE FROM vocabulary_word_units
         WHERE word_id IN (
           SELECT id FROM vocabulary_words
           WHERE library_id IN (SELECT id FROM vocabulary_libraries WHERE type = 'custom')
         )`,
      )
      .run();
    database.prepare("DELETE FROM vocabulary_words WHERE library_id IN (SELECT id FROM vocabulary_libraries WHERE type = 'custom')").run();
    database.prepare("DELETE FROM vocabulary_units WHERE library_id IN (SELECT id FROM vocabulary_libraries WHERE type = 'custom')").run();
    database.prepare("DELETE FROM vocabulary_libraries WHERE type = 'custom'").run();
    database
      .prepare(
        `DELETE FROM vocabulary_word_units
         WHERE word_id IN (
           SELECT w.id
           FROM vocabulary_words w
           JOIN dictionary_entries e ON e.id = w.dictionary_entry_id
           WHERE e.source = 'custom'
         )`,
      )
      .run();
    database
      .prepare(
        `DELETE FROM vocabulary_words
         WHERE dictionary_entry_id IN (SELECT id FROM dictionary_entries WHERE source = 'custom')`,
      )
      .run();
    database
      .prepare(
        `UPDATE vocabulary_words
         SET is_favorite = 0,
             mastery_level = 0,
             wrong_count = 0,
             dictation_count = 0,
             last_dictated_at = NULL
         WHERE library_id IN (SELECT id FROM vocabulary_libraries WHERE type = 'official')`,
      )
      .run();
    database.prepare("DELETE FROM dictionary_examples WHERE entry_id IN (SELECT id FROM dictionary_entries WHERE source = 'custom')").run();
    database.prepare("DELETE FROM dictionary_entries WHERE source = 'custom'").run();
    database.prepare("DELETE FROM app_settings").run();
    database
      .prepare("UPDATE vocabulary_libraries SET progress = 0, accuracy = NULL, updated_at = ? WHERE type IN ('wrong_book', 'favorite', 'official')")
      .run(now);
    resetLibrarySortOrder(database, now);
    refreshLibraryCounts(database);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function resetLibrarySortOrder(database: DatabaseSync, now: number): void {
  database
    .prepare(
      `UPDATE vocabulary_libraries
       SET sort_order = CASE
           WHEN type = 'wrong_book' THEN 1
           WHEN type = 'favorite' THEN 2
           WHEN type = 'official' AND (lower(name) LIKE '%ielts%' OR name LIKE '%雅思%') THEN 10
           WHEN type = 'official' AND (lower(name) LIKE '%toefl%' OR name LIKE '%托福%') THEN 11
           WHEN type = 'official' AND lower(name) LIKE '%gre%' THEN 12
           WHEN type = 'official' AND (lower(name) LIKE '%cet4%' OR name LIKE '%四级%') THEN 13
           WHEN type = 'official' AND (lower(name) LIKE '%cet6%' OR name LIKE '%六级%') THEN 14
           WHEN type = 'official' AND name LIKE '%考研%' THEN 15
           WHEN type = 'official' AND name LIKE '%高考%' THEN 16
           WHEN type = 'official' AND name LIKE '%中考%' THEN 17
           ELSE sort_order
         END,
         updated_at = ?
       WHERE type IN ('wrong_book', 'favorite', 'official')`,
    )
    .run(now);
}

function ensureImportLibrary(database: DatabaseSync, wordCount: number, now: number): number {
  const existing = database.prepare("SELECT id FROM vocabulary_libraries WHERE type = 'custom' ORDER BY created_at LIMIT 1").get() as { id: number } | undefined;
  if (existing) return Number(existing.id);
  const result = database
    .prepare(
      "INSERT INTO vocabulary_libraries (name, description, type, cover_color, cover_icon, word_count, unit_count, progress, sort_order, created_at, updated_at) VALUES (?, ?, 'custom', '#F3EBE2', 'book', ?, 1, 0, 1000, ?, ?)",
    )
    .run("导入词库", `${wordCount} 词`, wordCount, now, now);
  return Number(result.lastInsertRowid);
}

function ensureDefaultUnit(database: DatabaseSync, libraryId: number): number {
  const existing = database.prepare("SELECT id FROM vocabulary_units WHERE library_id = ? AND name = '全部'").get(libraryId) as { id: number } | undefined;
  if (existing) return Number(existing.id);
  const result = database.prepare("INSERT INTO vocabulary_units (library_id, name, sort_order, word_count) VALUES (?, '全部', 0, 0)").run(libraryId);
  return Number(result.lastInsertRowid);
}

function refreshLibraryCounts(database: DatabaseSync): void {
  database.exec(`
    UPDATE vocabulary_libraries
    SET word_count = (SELECT count(*) FROM vocabulary_words WHERE vocabulary_words.library_id = vocabulary_libraries.id),
        unit_count = (SELECT count(*) FROM vocabulary_units WHERE vocabulary_units.library_id = vocabulary_libraries.id),
        updated_at = ${Date.now()};
    UPDATE vocabulary_units
    SET word_count = (SELECT count(*) FROM vocabulary_word_units WHERE vocabulary_word_units.unit_id = vocabulary_units.id);
  `);
}

function saveSession(
  database: DatabaseSync,
  session: Record<string, unknown>,
  results: Record<string, unknown>[],
  words: Record<string, unknown>[],
): void {
  const source = toRecord(session.source);
  database.exec("BEGIN");
  try {
    database
      .prepare(
        "INSERT OR REPLACE INTO dictation_sessions (id, source_type, source_id, source_name, mode, accent, status, word_count, duration_sec, paused_duration_sec, paused_at, settings_json, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        Number(session.id),
        String(source.sourceType ?? "none"),
        source.sourceId == null ? null : Number(source.sourceId),
        String(session.sourceName ?? "临时听写"),
        String(session.mode ?? "typing"),
        String(session.accent ?? "us"),
        String(session.status ?? "completed"),
        Number(session.wordCount ?? results.length),
        Number(session.durationSec ?? 0),
        Number(session.pausedDurationSec ?? 0),
        session.pausedAt == null ? null : Number(session.pausedAt),
        JSON.stringify({
          source,
          currentIndex: Number(session.currentIndex ?? 0),
          settings: toRecord(session.settings),
        }),
        Number(session.createdAt ?? Date.now()),
        session.completedAt == null ? null : Number(session.completedAt),
      );
    database.prepare("DELETE FROM dictation_results WHERE session_id = ?").run(Number(session.id));
    const insertResult = database.prepare(
      "INSERT INTO dictation_results (id, session_id, word_id, order_index, word, meaning, user_answer, correct_answer, result, hint_used, is_favorited, is_added_to_wrong_book, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );
    for (const row of results) {
      insertResult.run(
        Number(row.id),
        Number(row.sessionId),
        Number(row.wordId),
        Number(row.orderIndex),
        String(row.word),
        String(row.meaning),
        row.userAnswer == null ? null : String(row.userAnswer),
        String(row.correctAnswer),
        String(row.result),
        row.hintUsed ? 1 : 0,
        row.isFavorited ? 1 : 0,
        row.isAddedToWrongBook ? 1 : 0,
        Date.now(),
      );
    }
    const updateWord = database.prepare(
      "UPDATE vocabulary_words SET is_favorite = ?, mastery_level = ?, wrong_count = ?, dictation_count = ?, last_dictated_at = ? WHERE id = ?",
    );
    for (const word of words) {
      const identity = resolveWordIdentity(database, {
        wordId: Number(word.id),
        dictionaryEntryId: word.dictionaryEntryId == null ? undefined : Number(word.dictionaryEntryId),
        wordKey: optionalString(word.wordKey),
        word: optionalString(word.word),
      });
      if (!identity) continue;
      const wrongCount = Number(word.wrongCount ?? 0);
      upsertUserWordState(database, {
        ...identity,
        isFavorite: Boolean(word.isFavorite),
        masteryLevel: Number(word.masteryLevel ?? 0),
        wrongCount,
        dictationCount: Number(word.dictationCount ?? 0),
        lastDictatedAt: word.lastDictatedAt == null ? null : Number(word.lastDictatedAt),
      });
      if (Number(word.id) > 0 && word.transientSource !== "dictionary") {
        updateWord.run(
          word.isFavorite ? 1 : 0,
          Number(word.masteryLevel ?? 0),
          wrongCount,
          Number(word.dictationCount ?? 0),
          word.lastDictatedAt == null ? null : Number(word.lastDictatedAt),
          Number(word.id),
        );
      }
      setFavorite(database, { ...identity, dictionaryEntryId: identity.dictionaryEntryId ?? undefined, isFavorite: Boolean(word.isFavorite) });
      setWrongBook(database, { ...identity, dictionaryEntryId: identity.dictionaryEntryId ?? undefined, inWrongBook: Boolean(word.inWrongBook) || wrongCount > 0 });
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function findProjectRoot(): string | null {
  const candidates = [process.cwd(), app.getAppPath(), electronDir];
  for (const start of candidates) {
    let current = path.resolve(start);
    for (let depth = 0; depth < 8; depth += 1) {
      if (existsSync(path.join(current, "pnpm-workspace.yaml")) && existsSync(path.join(current, "data", "migrations", "0001_init.sql"))) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

function findBundledResource(relativePath: string): string | null {
  const candidates = [process.resourcesPath, app.getAppPath(), path.dirname(app.getPath("exe"))];
  for (const base of candidates) {
    const candidate = path.join(base, relativePath);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function findLibraries(database: DatabaseSync) {
  const rows = database.prepare("SELECT * FROM vocabulary_libraries ORDER BY sort_order, updated_at DESC").all() as Record<string, unknown>[];
  const favoriteCount = Number((database.prepare("SELECT count(*) as count FROM favorite_entries").get() as { count: number }).count);
  const wrongBookCount = Number((database.prepare("SELECT count(*) as count FROM wrong_book_entries").get() as { count: number }).count);
  return rows.map((row) => {
    const type = String(row.type);
    const wordCount = type === "favorite" ? favoriteCount : type === "wrong_book" ? wrongBookCount : Number(row.word_count ?? 0);
    return {
      id: Number(row.id),
      name: type === "official" ? normalizeOfficialLibraryName(String(row.name)) : String(row.name),
      description: type === "official" ? `${wordCount.toLocaleString()} 词` : optionalString(row.description),
      tags: parseTags(row.tags_json),
      type,
      coverColor: type === "official" || type === "favorite" || type === "wrong_book" ? builtInLibraryColor : optionalString(row.cover_color),
      coverIcon: optionalString(row.cover_icon),
      wordCount,
      unitCount: Number(row.unit_count ?? 0),
      progress: Number(row.progress ?? 0),
      accuracy: row.accuracy == null ? undefined : Number(row.accuracy),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  });
}

function normalizeOfficialLibraryName(name: string): string {
  const compact = name.toLowerCase().replace(/[\s_-]/g, "");
  if (compact.includes("ielts") || name.includes("雅思")) return "IELTS";
  if (compact.includes("toefl") || name.includes("托福")) return "TOEFL";
  if (compact.includes("gre")) return "GRE";
  if (compact.includes("cet4") || name.includes("四级")) return "CET4";
  if (compact.includes("cet6") || name.includes("六级")) return "CET6";
  if (name.includes("考研")) return "考研英语";
  if (name.includes("高考")) return "高考英语";
  if (name.includes("中考")) return "中考英语";
  return name;
}

function findUnits(database: DatabaseSync) {
  const rows = database.prepare("SELECT * FROM vocabulary_units ORDER BY library_id, sort_order").all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    libraryId: Number(row.library_id),
    name: String(row.name),
    sortOrder: Number(row.sort_order),
    wordCount: Number(row.word_count ?? 0),
  }));
}

function findWords(database: DatabaseSync, libraryId?: number) {
  const rows = (
    libraryId == null
      ? database
          .prepare(
            `SELECT w.*, group_concat(wu.unit_id) as unit_ids,
              coalesce(s.is_favorite, w.is_favorite, 0) as state_is_favorite,
              coalesce(s.mastery_level, w.mastery_level, 0) as state_mastery_level,
              coalesce(s.wrong_count, w.wrong_count, 0) as state_wrong_count,
              coalesce(s.dictation_count, w.dictation_count, 0) as state_dictation_count,
              coalesce(s.last_dictated_at, w.last_dictated_at) as state_last_dictated_at
             FROM vocabulary_words w
             LEFT JOIN vocabulary_word_units wu ON wu.word_id = w.id
             LEFT JOIN user_word_state s ON s.word_key = lower(trim(w.word))
             GROUP BY w.id
             ORDER BY w.added_at`,
          )
          .all()
      : database
          .prepare(
            `SELECT w.*, group_concat(wu.unit_id) as unit_ids,
              coalesce(s.is_favorite, w.is_favorite, 0) as state_is_favorite,
              coalesce(s.mastery_level, w.mastery_level, 0) as state_mastery_level,
              coalesce(s.wrong_count, w.wrong_count, 0) as state_wrong_count,
              coalesce(s.dictation_count, w.dictation_count, 0) as state_dictation_count,
              coalesce(s.last_dictated_at, w.last_dictated_at) as state_last_dictated_at
             FROM vocabulary_words w
             LEFT JOIN vocabulary_word_units wu ON wu.word_id = w.id
             LEFT JOIN user_word_state s ON s.word_key = lower(trim(w.word))
             WHERE w.library_id = ?
             GROUP BY w.id
             ORDER BY w.added_at`,
          )
          .all(libraryId)
  ) as Record<string, unknown>[];
  return rows.map(mapVocabularyWordRow);
}

function mapVocabularyWordRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    libraryId: Number(row.library_id),
    dictionaryEntryId: row.dictionary_entry_id == null ? undefined : Number(row.dictionary_entry_id),
    wordKey: normalizeWordKey(row.word),
    unitIds: parseIdList(row.unit_ids),
    word: String(row.word),
    meaning: String(row.meaning),
    phonetic: optionalString(row.phonetic),
    partOfSpeech: optionalString(row.part_of_speech),
    isFavorite: Boolean(row.state_is_favorite ?? row.is_favorite),
    inWrongBook: Number(row.state_wrong_count ?? row.wrong_count ?? 0) > 0,
    masteryLevel: Number(row.state_mastery_level ?? row.mastery_level ?? 0),
    wrongCount: Number(row.state_wrong_count ?? row.wrong_count ?? 0),
    dictationCount: Number(row.state_dictation_count ?? row.dictation_count ?? 0),
    lastDictatedAt: row.state_last_dictated_at == null ? undefined : Number(row.state_last_dictated_at),
    addedAt: Number(row.added_at),
  };
}

function findQueuedDictionaryWords(database: DatabaseSync) {
  const rows = database
    .prepare(
      `SELECT e.*,
        coalesce(s.is_favorite, 0) as state_is_favorite,
        coalesce(s.mastery_level, 0) as state_mastery_level,
        coalesce(s.wrong_count, 0) as state_wrong_count,
        coalesce(s.dictation_count, 0) as state_dictation_count,
        s.last_dictated_at as state_last_dictated_at
       FROM practice_queue_items q
       JOIN dictionary_entries e ON e.id = q.item_id
       LEFT JOIN user_word_state s ON s.word_key = lower(trim(e.word))
       WHERE q.item_type = 'dictionary_entry'
       ORDER BY q.sort_order`,
    )
    .all() as Record<string, unknown>[];
  return rows.map(mapDictionaryStateWordRow);
}

function findStateOnlyDictionaryWords(database: DatabaseSync) {
  const rows = database
    .prepare(
      `SELECT e.*,
        s.is_favorite as state_is_favorite,
        s.mastery_level as state_mastery_level,
        s.wrong_count as state_wrong_count,
        s.dictation_count as state_dictation_count,
        s.last_dictated_at as state_last_dictated_at,
        s.updated_at as updated_at
       FROM user_word_state s
       JOIN dictionary_entries e ON e.id = s.dictionary_entry_id OR lower(trim(e.word)) = s.word_key
       WHERE (s.is_favorite = 1 OR s.wrong_count > 0 OR s.dictation_count > 0)
         AND NOT EXISTS (SELECT 1 FROM vocabulary_words w WHERE lower(trim(w.word)) = s.word_key)
         AND NOT EXISTS (SELECT 1 FROM practice_queue_items q WHERE q.item_type = 'dictionary_entry' AND q.item_id = e.id)
       GROUP BY s.word_key
       ORDER BY s.updated_at DESC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map(mapDictionaryStateWordRow);
}

function mapDictionaryStateWordRow(row: Record<string, unknown>) {
  return {
    id: -Math.abs(Number(row.id)),
    libraryId: 0,
    dictionaryEntryId: Number(row.id),
    transientSource: "dictionary",
    wordKey: normalizeWordKey(row.word),
    word: String(row.word),
    meaning: String(row.meaning_cn),
    phonetic: optionalString(row.us_phonetic) ?? optionalString(row.uk_phonetic),
    partOfSpeech: optionalString(row.part_of_speech),
    isFavorite: Boolean(row.state_is_favorite),
    inWrongBook: Number(row.state_wrong_count ?? 0) > 0,
    masteryLevel: Number(row.state_mastery_level ?? 0),
    wrongCount: Number(row.state_wrong_count ?? 0),
    dictationCount: Number(row.state_dictation_count ?? 0),
    lastDictatedAt: row.state_last_dictated_at == null ? undefined : Number(row.state_last_dictated_at),
    addedAt: Number(row.updated_at ?? Date.now()),
  };
}

function findPracticeQueueWordIds(database: DatabaseSync): number[] {
  const rows = database.prepare("SELECT item_type, item_id FROM practice_queue_items ORDER BY sort_order").all() as Record<string, unknown>[];
  return rows.map((row) => (String(row.item_type) === "dictionary_entry" ? -Math.abs(Number(row.item_id)) : Number(row.item_id))).filter(Number.isFinite);
}

function searchDictionary(database: DatabaseSync, query: string, limit: number) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const appendRows = (nextRows: Record<string, unknown>[]) => {
    for (const row of nextRows) {
      const key = normalizeWordKey(row.word);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
      if (rows.length >= limit) break;
    }
  };
  const wordPrefix = `${normalizedQuery}%`;
  appendRows(
    database
      .prepare(
        `SELECT e.*
         FROM dictionary_entries e
         JOIN (
           SELECT min(id) as id
           FROM dictionary_entries
           WHERE word LIKE ? COLLATE NOCASE
           GROUP BY lower(word)
           LIMIT ?
         ) unique_entries ON unique_entries.id = e.id
         ORDER BY
           CASE WHEN e.word = ? COLLATE NOCASE THEN 0 ELSE 1 END,
           length(e.word),
           e.word`,
      )
      .all(wordPrefix, limit, normalizedQuery) as Record<string, unknown>[],
  );
  if (rows.length < limit && normalizedQuery.length >= 2) {
    appendRows(
      database
        .prepare(
          `SELECT e.*
           FROM dictionary_entries e
           JOIN (
             SELECT min(id) as id
             FROM dictionary_entries
             WHERE word LIKE ? COLLATE NOCASE
             GROUP BY lower(word)
             LIMIT ?
           ) unique_entries ON unique_entries.id = e.id
           ORDER BY length(e.word), e.word`,
        )
        .all(`%${normalizedQuery}%`, limit - rows.length) as Record<string, unknown>[],
    );
  }
  if (rows.length < limit && normalizedQuery.length >= 2) {
    appendRows(
      database
        .prepare(
          `SELECT e.*
           FROM dictionary_entries e
           JOIN (
             SELECT min(id) as id
             FROM dictionary_entries
             WHERE meaning_cn LIKE ?
             GROUP BY lower(word)
             LIMIT ?
           ) unique_entries ON unique_entries.id = e.id
           ORDER BY length(e.word), e.word`,
        )
        .all(`%${normalizedQuery}%`, limit - rows.length) as Record<string, unknown>[],
    );
  }
  return rows.map(mapDictionaryEntry);
}

function recordSearch(database: DatabaseSync, query: string, entryId?: number): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  database.exec("BEGIN");
  try {
    database.prepare("DELETE FROM search_history WHERE lower(query) = lower(?) OR (? IS NOT NULL AND entry_id = ?)").run(trimmed, entryId ?? null, entryId ?? null);
    database.prepare("INSERT INTO search_history (query, entry_id, searched_at) VALUES (?, ?, ?)").run(trimmed, entryId ?? null, Date.now());
    const staleRows = database.prepare("SELECT id FROM search_history ORDER BY searched_at DESC LIMIT -1 OFFSET 12").all() as { id: number }[];
    if (staleRows.length) {
      const deleteStale = database.prepare("DELETE FROM search_history WHERE id = ?");
      for (const row of staleRows) deleteStale.run(row.id);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function findSearchHistory(database: DatabaseSync, limit: number) {
  const rows = database
    .prepare(
      `SELECT h.id, h.query, h.entry_id, h.searched_at, e.word, e.meaning_cn
       FROM search_history h
       LEFT JOIN dictionary_entries e ON e.id = h.entry_id
       ORDER BY h.searched_at DESC
       LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    query: String(row.query),
    entryId: row.entry_id == null ? undefined : Number(row.entry_id),
    word: optionalString(row.word),
    meaningCn: optionalString(row.meaning_cn),
    searchedAt: Number(row.searched_at),
  }));
}

function findDictionaryEntryWithExamples(
  database: DatabaseSync,
  input: { entryId?: number; word?: string; limitExamples?: number },
) {
  const row =
    input.entryId != null
      ? (database.prepare("SELECT * FROM dictionary_entries WHERE id = ?").get(input.entryId) as Record<string, unknown> | undefined)
      : input.word
        ? (database
            .prepare("SELECT * FROM dictionary_entries WHERE lower(word) = lower(?) ORDER BY source = 'custom' DESC, id LIMIT 1")
            .get(input.word.trim()) as Record<string, unknown> | undefined)
        : undefined;
  if (!row) return { entry: null, examples: [] };
  const entry = mapDictionaryEntry(row);
  return { entry, examples: findDictionaryExamplesForEntry(database, entry.id, input.limitExamples ?? 8) };
}

function mapDictionaryEntry(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    word: String(row.word),
    ukPhonetic: optionalString(row.uk_phonetic),
    usPhonetic: optionalString(row.us_phonetic),
    partOfSpeech: optionalString(row.part_of_speech),
    meaningCn: String(row.meaning_cn),
    wordForms: row.word_forms_json ? JSON.parse(String(row.word_forms_json)) : undefined,
    source: String(row.source),
  };
}

function findDictionaryExamplesForEntry(database: DatabaseSync, entryId: number, limit: number) {
  const rows = database
    .prepare(
      `SELECT min(id) as id, entry_id, example_en, example_cn, author, author_status, license, source_url
       FROM dictionary_examples
       WHERE entry_id = ?
       GROUP BY example_en, coalesce(example_cn, '')
       ORDER BY min(id)
       LIMIT ?`,
    )
    .all(entryId, limit) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    entryId: Number(row.entry_id),
    exampleEn: String(row.example_en),
    exampleCn: optionalString(row.example_cn),
    author: optionalString(row.author),
    authorStatus: optionalString(row.author_status),
    license: String(row.license),
    sourceUrl: optionalString(row.source_url),
  }));
}

function findSessions(database: DatabaseSync) {
  const rows = database.prepare("SELECT * FROM dictation_sessions ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return rows.map((row) => {
    const settingsRecord = safeJsonRecord(row.settings_json);
    const sessionSettings = toRecord(settingsRecord.settings);
    return {
      id: Number(row.id),
      source: mapPracticeSource(row),
      sourceName: String(row.source_name),
      mode: String(row.mode),
      accent: String(row.accent),
      status: String(row.status),
      wordCount: Number(row.word_count),
      currentIndex: Number(settingsRecord.currentIndex ?? 0),
      settings: Object.keys(sessionSettings).length ? sessionSettings : undefined,
      durationSec: Number(row.duration_sec),
      pausedDurationSec: Number(row.paused_duration_sec ?? 0),
      pausedAt: row.paused_at == null ? undefined : Number(row.paused_at),
      createdAt: Number(row.created_at),
      completedAt: row.completed_at == null ? undefined : Number(row.completed_at),
    };
  });
}

function findResults(database: DatabaseSync) {
  const rows = database.prepare("SELECT * FROM dictation_results ORDER BY session_id, order_index").all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: Number(row.id),
    sessionId: Number(row.session_id),
    wordId: Number(row.word_id),
    orderIndex: Number(row.order_index),
    word: String(row.word),
    meaning: String(row.meaning),
    userAnswer: optionalString(row.user_answer),
    correctAnswer: String(row.correct_answer),
    result: String(row.result),
    hintUsed: Boolean(row.hint_used),
    isFavorited: Boolean(row.is_favorited),
    isAddedToWrongBook: Boolean(row.is_added_to_wrong_book),
  }));
}

function buildHistory(database: DatabaseSync) {
  const rows = database
    .prepare(
      `SELECT s.id as session_id, s.source_type, s.source_name, s.mode, s.accent, s.duration_sec, s.completed_at,
        count(r.id) as total,
        sum(CASE WHEN r.result = 'correct' THEN 1 ELSE 0 END) as correct_count,
        sum(CASE WHEN r.result IN ('wrong', 'skipped', 'unmarked') THEN 1 ELSE 0 END) as wrong_count,
        sum(CASE WHEN r.result = 'skipped' THEN 1 ELSE 0 END) as skipped_count,
        sum(CASE WHEN r.result = 'unmarked' THEN 1 ELSE 0 END) as unmarked_count
       FROM dictation_sessions s
       LEFT JOIN dictation_results r ON r.session_id = s.id
       WHERE s.status = 'completed'
       GROUP BY s.id
       ORDER BY s.completed_at DESC`,
    )
    .all() as Record<string, unknown>[];
  return rows.map((row) => {
    const total = Number(row.total ?? 0);
    const correctCount = Number(row.correct_count ?? 0);
    return {
      sessionId: Number(row.session_id),
      sourceName: String(row.source_name),
      sourceType: String(row.source_type),
      mode: String(row.mode),
      accent: String(row.accent),
      total,
      correctCount,
      wrongCount: Number(row.wrong_count ?? 0),
      skippedCount: Number(row.skipped_count ?? 0),
      unmarkedCount: Number(row.unmarked_count ?? 0),
      accuracy: total === 0 ? 0 : Math.round((correctCount / total) * 1000) / 10,
      durationSec: Number(row.duration_sec ?? 0),
      endedAt: Number(row.completed_at ?? 0),
    };
  });
}

function getSettings(database: DatabaseSync) {
  const settings: Record<string, unknown> = {
    defaultAccent: "us",
    defaultDictationMode: "typing",
    autoPlay: true,
    theme: "light",
    fontSize: "normal",
    cacheLimitMb: 512,
    colorWeakMode: false,
  };
  const rows = database.prepare("SELECT key, value FROM app_settings").all() as { key: string; value: string }[];
  for (const row of rows) settings[row.key as keyof typeof settings] = JSON.parse(row.value);
  return settings;
}

function mapPracticeSource(row: Record<string, unknown>) {
  const sourceType = String(row.source_type);
  const sourceId = row.source_id == null ? undefined : Number(row.source_id);
  if (sourceType === "library" || sourceType === "unit" || sourceType === "history_session") return { sourceType, sourceId };
  if (sourceType === "words") {
    const settings = safeJsonRecord(row.settings_json);
    const savedSource = toRecord(settings.source);
    const wordIds = Array.isArray(savedSource.wordIds) ? savedSource.wordIds.map(Number).filter(Number.isFinite) : [];
    return wordIds.length ? { sourceType: "words", wordIds } : { sourceType: "words", wordIds: [] };
  }
  if (sourceType === "wrong_book" || sourceType === "favorite" || sourceType === "none") return { sourceType };
  return { sourceType: "none" };
}

function parseIdList(value: unknown): number[] | undefined {
  if (value == null || value === "") return undefined;
  return String(value)
    .split(",")
    .map(Number)
    .filter(Number.isFinite);
}

function optionalString(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}

function normalizeWordKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 8);
}

function parseTags(value: unknown): string[] | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return normalizeTags(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function safeJsonRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value) return {};
  try {
    return toRecord(JSON.parse(value));
  } catch {
    return {};
  }
}
