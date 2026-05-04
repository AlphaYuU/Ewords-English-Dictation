import type { VocabularyWord } from "@dictation/domain";
import type { SQLiteDatabase } from "../db/client";
import { mapWordRow } from "../mappers/library-mapper";

export class VocabularyWordRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  findByLibrary(input: { libraryId: number; q?: string; page?: number; pageSize?: number }): { items: VocabularyWord[]; total: number } {
    const params: any[] = [input.libraryId];
    let where = "WHERE library_id = ?";
    if (input.q) {
      where += " AND (word LIKE ? OR meaning LIKE ?)";
      params.push(`%${input.q}%`, `%${input.q}%`);
    }
    const total = Number((this.db.prepare(`SELECT count(*) as count FROM vocabulary_words ${where}`).get(...params) as any).count);
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 50;
    const rows = this.db
      .prepare(`SELECT * FROM vocabulary_words ${where} ORDER BY added_at LIMIT ? OFFSET ?`)
      .all(...params, pageSize, (page - 1) * pageSize) as Record<string, any>[];
    return { items: rows.map(mapWordRow), total };
  }

  findByIds(ids: number[]): VocabularyWord[] {
    if (!ids.length) return [];
    const placeholders = ids.map(() => "?").join(",");
    const rows = this.db.prepare(`SELECT * FROM vocabulary_words WHERE id IN (${placeholders})`).all(...ids) as Record<string, any>[];
    return rows.map(mapWordRow);
  }
}
