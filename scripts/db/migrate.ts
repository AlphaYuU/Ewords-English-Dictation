import path from "node:path";
import { applyMigrationFile, openDatabase } from "@dictation/data-access";

const dbPath = process.env.DICTATION_DB_PATH ?? path.resolve("data/processed/dictation.sqlite");
const migrationPath = path.resolve("data/migrations/0001_init.sql");

const db = openDatabase(dbPath);
applyMigrationFile(db, migrationPath);
ensureLibraryTagsColumn();
refreshOfficialDescriptions();
db.close();

console.log(`Migrated SQLite database at ${dbPath}`);

function ensureLibraryTagsColumn(): void {
  const columns = db.prepare("PRAGMA table_info(vocabulary_libraries)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "tags_json")) {
    db.exec("ALTER TABLE vocabulary_libraries ADD COLUMN tags_json TEXT");
  }
}

function refreshOfficialDescriptions(): void {
  const rows = db.prepare("SELECT id, word_count FROM vocabulary_libraries WHERE type = 'official'").all() as { id: number; word_count: number }[];
  const update = db.prepare("UPDATE vocabulary_libraries SET description = ? WHERE id = ?");
  for (const row of rows) {
    update.run(`${Number(row.word_count ?? 0).toLocaleString()} 词`, Number(row.id));
  }
}
