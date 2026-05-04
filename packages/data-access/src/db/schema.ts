export const requiredTables = [
  "dictionary_entries",
  "dictionary_examples",
  "vocabulary_libraries",
  "vocabulary_units",
  "vocabulary_words",
  "vocabulary_word_units",
  "dictation_sessions",
  "dictation_results",
  "wrong_book_words",
  "favorite_words",
  "app_settings",
  "search_history",
  "import_tasks",
  "import_preview_rows",
] as const;

export type RequiredTable = (typeof requiredTables)[number];
