import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { openDatabase } from "@dictation/data-access";
import { parseCsvText } from "@dictation/import-export";

type CsvRow = Record<string, string>;

const dbPath = process.env.DICTATION_DB_PATH ?? path.resolve("data/processed/dictation.sqlite");
const officialLimitPerBook = optionalLimit(process.env.SEED_LIMIT_PER_BOOK);
const dictionaryLimit = optionalLimit(process.env.SEED_DICTIONARY_LIMIT);
const now = Date.now();

const db = openDatabase(dbPath);
db.exec(readFileSync(path.resolve("data/migrations/0001_init.sql"), "utf8"));
ensureLibraryTagsColumn();
resetSeededData();
seedSystemLibraries();
seedDictionary();
seedOfficialLibraries();
seedSettings();
db.close();

console.log(`Seeded production data into ${dbPath}`);

function resetSeededData(): void {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM import_preview_rows;
    DELETE FROM import_tasks;
    DELETE FROM practice_queue_items;
    DELETE FROM search_history;
    DELETE FROM dictation_results;
    DELETE FROM dictation_sessions;
    DELETE FROM favorite_words;
    DELETE FROM wrong_book_words;
    DELETE FROM favorite_entries;
    DELETE FROM wrong_book_entries;
    DELETE FROM user_word_state;
    DELETE FROM vocabulary_word_units;
    DELETE FROM vocabulary_words;
    DELETE FROM vocabulary_units;
    DELETE FROM vocabulary_libraries;
    DELETE FROM dictionary_examples;
    DELETE FROM dictionary_entries;
    DELETE FROM app_settings;
    DELETE FROM sqlite_sequence WHERE name IN (
      'dictionary_entries',
      'dictionary_examples',
      'vocabulary_libraries',
      'vocabulary_units',
      'vocabulary_words',
      'dictation_sessions',
      'dictation_results',
      'practice_queue_items',
      'search_history'
    );
    PRAGMA foreign_keys = ON;
  `);
}

function ensureLibraryTagsColumn(): void {
  const columns = db.prepare("PRAGMA table_info(vocabulary_libraries)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "tags_json")) {
    db.exec("ALTER TABLE vocabulary_libraries ADD COLUMN tags_json TEXT");
  }
}

function seedSystemLibraries(): void {
  const statement = db.prepare(
    "INSERT INTO vocabulary_libraries (id, name, description, type, cover_color, cover_icon, word_count, unit_count, progress, accuracy, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, NULL, ?, ?, ?)",
  );
  statement.run(1, "错题本", "听写答错或手动加入的单词会出现在这里", "wrong_book", "#D4916E", "triangle-alert", 1, now, now);
  statement.run(2, "收藏夹", "点亮星标收藏的重要单词会出现在这里", "favorite", "#D4916E", "star", 2, now, now);
}

function seedDictionary(): void {
  const dictionaryPath = path.resolve("data/raw/examples/ecdict_tatoeba_examples_with_attribution.csv");
  if (!existsSync(dictionaryPath)) return;
  const rows = readCsv(dictionaryPath, dictionaryLimit);
  const insertEntry = db.prepare(
    "INSERT OR IGNORE INTO dictionary_entries (word, uk_phonetic, us_phonetic, part_of_speech, meaning_cn, word_forms_json, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ecdict', ?, ?)",
  );
  const findEntry = db.prepare("SELECT id FROM dictionary_entries WHERE word = ?");
  const insertExample = db.prepare(
    "INSERT INTO dictionary_examples (entry_id, example_en, example_cn, author, author_status, license, source_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  db.exec("BEGIN");
  try {
    for (const row of rows) {
      const word = row.word?.trim();
      const meaning = normalizeText(row.translation || row.definition || "");
      if (!word || !meaning) continue;
      insertEntry.run(word, row.phonetic || null, row.phonetic || null, row.pos || null, meaning, parseExchange(row.exchange), now, now);
      const entry = findEntry.get(word) as { id: number };
      insertExamples(insertExample, Number(entry.id), row);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedOfficialLibraries(): void {
  const manifestPath = path.resolve("data/raw/official-vocab/official_vocab_manifest.csv");
  if (!existsSync(manifestPath)) return;
  const preferredOrder = ["ielts", "toefl", "gre", "cet4", "cet6", "ky", "gk", "zk"];
  const rows = readCsv(manifestPath).sort(
    (left, right) => preferredOrder.indexOf(left.book_code) - preferredOrder.indexOf(right.book_code),
  );
  const insertLibrary = db.prepare(
    "INSERT INTO vocabulary_libraries (id, name, description, type, cover_color, cover_icon, word_count, unit_count, progress, accuracy, sort_order, created_at, updated_at) VALUES (?, ?, ?, 'official', ?, 'book-open', 0, 1, 0, NULL, ?, ?, ?)",
  );

  rows.forEach((row, index) => {
    const libraryId = 10 + index;
    const bookName = normalizeOfficialBookName(row.book_code, row.book_name || row.book_name_en || row.book_code);
    const description = `${Number(row.word_count || 0).toLocaleString()} 词`;
    insertLibrary.run(libraryId, bookName, description, coverColor(index), 10 + index, now, now);
    const unitId = ensureUnit(libraryId, "全部");
    seedBookWords(libraryId, unitId, row.csv_file);
  });

  refreshCounts();
  refreshOfficialDescriptions();
}

function seedBookWords(libraryId: number, unitId: number, csvFile: string): void {
  const filePath = path.resolve("data/raw/official-vocab", csvFile.replace(/\//g, path.sep));
  if (!existsSync(filePath)) return;
  const rows = readCsv(filePath, officialLimitPerBook);
  const insertEntry = db.prepare(
    "INSERT OR IGNORE INTO dictionary_entries (word, uk_phonetic, us_phonetic, part_of_speech, meaning_cn, word_forms_json, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'ecdict', ?, ?)",
  );
  const findEntry = db.prepare("SELECT id FROM dictionary_entries WHERE word = ?");
  const insertWord = db.prepare(
    "INSERT INTO vocabulary_words (library_id, dictionary_entry_id, word, meaning, phonetic, part_of_speech, is_favorite, mastery_level, wrong_count, dictation_count, added_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?)",
  );
  const insertExample = db.prepare(
    "INSERT INTO dictionary_examples (entry_id, example_en, example_cn, author, author_status, license, source_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertWordUnit = db.prepare("INSERT OR IGNORE INTO vocabulary_word_units (word_id, unit_id) VALUES (?, ?)");

  db.exec("BEGIN");
  try {
    for (const [index, row] of rows.entries()) {
      const word = row.word?.trim();
      if (!word) continue;
      const meaning = normalizeText(row.translation || row.definition || "暂无释义");
      insertEntry.run(word, row.phonetic || null, row.phonetic || null, row.pos || null, meaning, parseExchange(row.exchange), now, now);
      const entry = findEntry.get(word) as { id: number };
      insertExamples(insertExample, Number(entry.id), row);
      const result = insertWord.run(libraryId, Number(entry.id), word, meaning, row.phonetic || null, row.pos || null, now + index);
      insertWordUnit.run(Number(result.lastInsertRowid), unitId);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function insertExamples(
  statement: ReturnType<typeof db.prepare>,
  entryId: number,
  row: CsvRow,
): void {
  for (const suffix of ["1", "2"]) {
    const exampleEn = row[`example_en_${suffix}`]?.trim();
    if (!exampleEn) continue;
    statement.run(
      entryId,
      exampleEn,
      row[`example_cn_${suffix}`] || null,
      row[`example_${suffix}_tatoeba_en_author`] || null,
      row[`example_${suffix}_author_status`] || null,
      row[`example_${suffix}_license`] || "CC BY 2.0 FR",
      row[`example_${suffix}_tatoeba_en_url`] || null,
    );
  }
}

function ensureUnit(libraryId: number, name: string): number {
  const result = db.prepare("INSERT INTO vocabulary_units (library_id, name, sort_order, word_count) VALUES (?, ?, 0, 0)").run(libraryId, name);
  return Number(result.lastInsertRowid);
}

function refreshCounts(): void {
  db.exec(`
    UPDATE vocabulary_libraries
    SET word_count = (SELECT count(*) FROM vocabulary_words WHERE vocabulary_words.library_id = vocabulary_libraries.id),
        unit_count = (SELECT count(*) FROM vocabulary_units WHERE vocabulary_units.library_id = vocabulary_libraries.id);
    UPDATE vocabulary_units
    SET word_count = (SELECT count(*) FROM vocabulary_word_units WHERE vocabulary_word_units.unit_id = vocabulary_units.id);
  `);
}

function refreshOfficialDescriptions(): void {
  const rows = db.prepare("SELECT id, word_count FROM vocabulary_libraries WHERE type = 'official'").all() as { id: number; word_count: number }[];
  const update = db.prepare("UPDATE vocabulary_libraries SET description = ? WHERE id = ?");
  for (const row of rows) update.run(`${Number(row.word_count ?? 0).toLocaleString()} 词`, Number(row.id));
}

function seedSettings(): void {
  const settings = {
    defaultAccent: "us",
    defaultDictationMode: "typing",
    autoPlay: true,
    theme: "light",
    fontSize: "normal",
    cacheLimitMb: 512,
    colorWeakMode: false,
  };
  const statement = db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)");
  for (const [key, value] of Object.entries(settings)) statement.run(key, JSON.stringify(value), now);
}

function readCsv(filePath: string, limit = Number.POSITIVE_INFINITY): CsvRow[] {
  const rows = parseCsvText(readFileSync(filePath, "utf8"));
  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1, Number.isFinite(limit) ? limit + 1 : undefined);
  return dataRows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function optionalLimit(value: string | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.POSITIVE_INFINITY;
}

function normalizeText(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function parseExchange(value: string | undefined): string | null {
  if (!value || value === "0") return null;
  const labels: Record<string, string> = {
    "0": "lemma",
    "1": "plural",
    "3": "thirdPerson",
    d: "pastTense",
    i: "presentParticiple",
    p: "pastParticiple",
    r: "comparative",
    s: "plural",
    t: "superlative",
  };
  const forms = Object.fromEntries(
    value
      .split("/")
      .map((part) => part.split(":"))
      .filter(([key, form]) => key && form)
      .map(([key, form]) => [labels[key] ?? key, form]),
  );
  return Object.keys(forms).length ? JSON.stringify(forms) : null;
}

function coverColor(index: number): string {
  void index;
  return "#D4916E";
}

function normalizeOfficialBookName(code: string, fallback: string): string {
  const normalizedCode = code.trim().toLowerCase();
  const names: Record<string, string> = {
    ielts: "IELTS",
    toefl: "TOEFL",
    gre: "GRE",
    cet4: "CET4",
    cet6: "CET6",
    ky: "考研英语",
    gk: "高考英语",
    zk: "中考英语",
  };
  return names[normalizedCode] ?? fallback;
}
