CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dictionary_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL UNIQUE,
  uk_phonetic TEXT,
  us_phonetic TEXT,
  part_of_speech TEXT,
  meaning_cn TEXT NOT NULL,
  word_forms_json TEXT,
  source TEXT NOT NULL DEFAULT 'ecdict',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dictionary_examples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  example_en TEXT NOT NULL,
  example_cn TEXT,
  author TEXT,
  author_status TEXT,
  license TEXT NOT NULL,
  source_url TEXT,
  FOREIGN KEY (entry_id) REFERENCES dictionary_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vocabulary_libraries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  tags_json TEXT,
  type TEXT NOT NULL,
  cover_color TEXT,
  cover_icon TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  unit_count INTEGER NOT NULL DEFAULT 0,
  progress REAL NOT NULL DEFAULT 0,
  accuracy REAL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vocabulary_units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (library_id) REFERENCES vocabulary_libraries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vocabulary_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id INTEGER NOT NULL,
  dictionary_entry_id INTEGER,
  custom_word TEXT,
  custom_meaning TEXT,
  custom_phonetic TEXT,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  phonetic TEXT,
  part_of_speech TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  mastery_level INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  dictation_count INTEGER NOT NULL DEFAULT 0,
  last_dictated_at INTEGER,
  added_at INTEGER NOT NULL,
  FOREIGN KEY (library_id) REFERENCES vocabulary_libraries(id) ON DELETE CASCADE,
  FOREIGN KEY (dictionary_entry_id) REFERENCES dictionary_entries(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS vocabulary_word_units (
  word_id INTEGER NOT NULL,
  unit_id INTEGER NOT NULL,
  PRIMARY KEY (word_id, unit_id),
  FOREIGN KEY (word_id) REFERENCES vocabulary_words(id) ON DELETE CASCADE,
  FOREIGN KEY (unit_id) REFERENCES vocabulary_units(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dictation_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL,
  source_id INTEGER,
  source_name TEXT NOT NULL,
  mode TEXT NOT NULL,
  accent TEXT NOT NULL,
  status TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  paused_duration_sec INTEGER NOT NULL DEFAULT 0,
  paused_at INTEGER,
  settings_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS practice_queue_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

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

CREATE TABLE IF NOT EXISTS dictation_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  word_id INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  user_answer TEXT,
  correct_answer TEXT NOT NULL,
  result TEXT NOT NULL,
  hint_used INTEGER NOT NULL DEFAULT 0,
  is_favorited INTEGER NOT NULL DEFAULT 0,
  is_added_to_wrong_book INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES dictation_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wrong_book_words (
  word_id INTEGER PRIMARY KEY,
  wrong_count INTEGER NOT NULL DEFAULT 1,
  last_wrong_at INTEGER NOT NULL,
  last_user_answer TEXT,
  FOREIGN KEY (word_id) REFERENCES vocabulary_words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorite_words (
  word_id INTEGER PRIMARY KEY,
  favorited_at INTEGER NOT NULL,
  FOREIGN KEY (word_id) REFERENCES vocabulary_words(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  entry_id INTEGER,
  searched_at INTEGER NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES dictionary_entries(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS import_tasks (
  id TEXT PRIMARY KEY,
  target_library_id INTEGER,
  status TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS import_preview_rows (
  temp_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  word TEXT NOT NULL,
  meaning TEXT,
  part_of_speech TEXT,
  matched_entry_id INTEGER,
  status TEXT NOT NULL,
  error_message TEXT,
  action TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES import_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_dictionary_word ON dictionary_entries(word);
CREATE INDEX IF NOT EXISTS idx_dictionary_meaning ON dictionary_entries(meaning_cn);
CREATE INDEX IF NOT EXISTS idx_vocabulary_words_library ON vocabulary_words(library_id);
CREATE INDEX IF NOT EXISTS idx_dictation_results_session ON dictation_results(session_id);
CREATE INDEX IF NOT EXISTS idx_user_word_state_entry ON user_word_state(dictionary_entry_id);
CREATE INDEX IF NOT EXISTS idx_favorite_entries_entry ON favorite_entries(dictionary_entry_id);
CREATE INDEX IF NOT EXISTS idx_wrong_book_entries_entry ON wrong_book_entries(dictionary_entry_id);
DELETE FROM vocabulary_words
WHERE id NOT IN (
  SELECT MIN(id)
  FROM vocabulary_words
  GROUP BY library_id, lower(word)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vocabulary_words_library_word_unique ON vocabulary_words(library_id, lower(word));

INSERT INTO user_word_state (word_key, dictionary_entry_id, is_favorite, mastery_level, wrong_count, dictation_count, last_dictated_at, updated_at)
SELECT
  lower(trim(word)) AS word_key,
  min(dictionary_entry_id) AS dictionary_entry_id,
  max(is_favorite) AS is_favorite,
  max(mastery_level) AS mastery_level,
  max(wrong_count) AS wrong_count,
  max(dictation_count) AS dictation_count,
  max(last_dictated_at) AS last_dictated_at,
  strftime('%s','now') * 1000 AS updated_at
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
  updated_at = excluded.updated_at;

INSERT OR IGNORE INTO favorite_entries (word_key, dictionary_entry_id, favorited_at)
SELECT s.word_key, s.dictionary_entry_id, strftime('%s','now') * 1000
FROM user_word_state s
WHERE s.is_favorite = 1;

INSERT OR IGNORE INTO wrong_book_entries (word_key, dictionary_entry_id, wrong_count, last_wrong_at, last_user_answer)
SELECT s.word_key, s.dictionary_entry_id, max(1, s.wrong_count), strftime('%s','now') * 1000, NULL
FROM user_word_state s
WHERE s.wrong_count > 0;

INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (1, strftime('%s','now') * 1000);
