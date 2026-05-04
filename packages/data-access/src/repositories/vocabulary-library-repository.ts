import type { LibraryType, VocabularyLibrary } from "@dictation/domain";
import type { SQLiteDatabase } from "../db/client";
import { mapLibraryRow } from "../mappers/library-mapper";

export class VocabularyLibraryRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  findAll(filter: { type?: LibraryType; q?: string } = {}): VocabularyLibrary[] {
    const clauses: string[] = [];
    const params: any[] = [];
    if (filter.type) {
      clauses.push("type = ?");
      params.push(filter.type);
    }
    if (filter.q) {
      clauses.push("name LIKE ?");
      params.push(`%${filter.q}%`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db.prepare(`SELECT * FROM vocabulary_libraries ${where} ORDER BY sort_order, updated_at DESC`).all(...params) as Record<
      string,
      any
    >[];
    return rows.map(mapLibraryRow);
  }

  create(input: { name: string; description?: string; tags?: string[]; coverColor?: string; coverIcon?: string }): VocabularyLibrary {
    const now = Date.now();
    const result = this.db
      .prepare(
        "INSERT INTO vocabulary_libraries (name, description, tags_json, type, cover_color, cover_icon, created_at, updated_at) VALUES (?, ?, ?, 'custom', ?, ?, ?, ?)",
      )
      .run(input.name, input.description ?? null, JSON.stringify(input.tags ?? []), input.coverColor ?? "#D4916E", input.coverIcon ?? "book", now, now);
    return this.findById(Number(result.lastInsertRowid))!;
  }

  findById(id: number): VocabularyLibrary | null {
    const row = this.db.prepare("SELECT * FROM vocabulary_libraries WHERE id = ?").get(id) as Record<string, any> | undefined;
    return row ? mapLibraryRow(row) : null;
  }

  delete(id: number): void {
    this.db.prepare("DELETE FROM vocabulary_libraries WHERE id = ? AND type = 'custom'").run(id);
  }
}
