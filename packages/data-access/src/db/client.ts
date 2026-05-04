import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type SQLiteDatabase = DatabaseSync;

export function openDatabase(dbPath = path.resolve("data/processed/dictation.sqlite")): SQLiteDatabase {
  const directory = path.dirname(dbPath);
  mkdirSync(directory, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

export function applyMigrationFile(db: SQLiteDatabase, migrationPath: string): void {
  db.exec(readFileSync(migrationPath, "utf8"));
}

export function mapRows<T>(statement: ReturnType<SQLiteDatabase["prepare"]>, params: any[] = []): T[] {
  return statement.all(...params) as T[];
}
