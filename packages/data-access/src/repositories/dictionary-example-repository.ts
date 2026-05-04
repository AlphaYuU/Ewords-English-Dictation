import type { DictionaryExample } from "@dictation/domain";
import type { SQLiteDatabase } from "../db/client";

export class DictionaryExampleRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  findByEntryId(entryId: number): DictionaryExample[] {
    const rows = this.db.prepare("SELECT * FROM dictionary_examples WHERE entry_id = ? ORDER BY id").all(entryId) as Record<string, any>[];
    return rows.map((row) => ({
      id: Number(row.id),
      entryId: Number(row.entry_id),
      exampleEn: String(row.example_en),
      exampleCn: row.example_cn ?? undefined,
      author: row.author ?? undefined,
      authorStatus: row.author_status ?? undefined,
      license: String(row.license),
      sourceUrl: row.source_url ?? undefined,
    }));
  }
}
