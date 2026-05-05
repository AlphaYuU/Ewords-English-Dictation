import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { builtInLibraryColor } from "./constants";
import type { ApplicationDatabaseServiceOptions } from "./types";

export function ensureDatabaseFile(targetPath: string, options: ApplicationDatabaseServiceOptions): void {
  if (existsSync(targetPath)) return;
  const bundledDb = options.findBundledResource?.("data/processed/dictation.sqlite");
  if (bundledDb) {
    copyFileSync(bundledDb, targetPath);
    return;
  }
  const developmentDb = options.developmentDbPath;
  if (developmentDb && developmentDb !== targetPath && existsSync(developmentDb)) {
    copyFileSync(developmentDb, targetPath);
  }
}

export function initializeApplicationDatabase(database: DatabaseSync, options: ApplicationDatabaseServiceOptions): void {
  database.exec("PRAGMA foreign_keys = ON;");
  applyMigration(database, options);
  ensureLibraryTagsColumn(database);
  ensureSessionTimingColumns(database);
  ensurePracticeQueueTable(database);
  ensureUserWordStateTables(database);
  ensureVocabularyWordUniqueIndex(database);
  ensureDictionarySearchIndexes(database);
  migrateLegacyWordState(database);
  ensureMinimumSeed(database);
}

function applyMigration(database: DatabaseSync, options: ApplicationDatabaseServiceOptions): void {
  const bundledMigration = options.findBundledResource?.("data/migrations/0001_init.sql");
  if (bundledMigration) {
    database.exec(readFileSync(bundledMigration, "utf8"));
    return;
  }
  const migrationPath = options.migrationPath;
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
