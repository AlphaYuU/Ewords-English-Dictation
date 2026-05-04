import type { DictionaryEntry } from "@dictation/domain";
import type { SQLiteDatabase } from "../db/client";

export class DictionaryEntryRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  search(query: string, limit = 20): DictionaryEntry[] {
    const q = `%${query.toLowerCase()}%`;
    const rows = this.db
      .prepare(
        "SELECT * FROM dictionary_entries WHERE lower(word) LIKE ? OR lower(meaning_cn) LIKE ? ORDER BY CASE WHEN lower(word)=lower(?) THEN 0 ELSE 1 END, word LIMIT ?",
      )
      .all(q, q, query, limit) as Record<string, any>[];
    return rows.map(mapDictionaryEntry);
  }

  findById(id: number): DictionaryEntry | null {
    const row = this.db.prepare("SELECT * FROM dictionary_entries WHERE id = ?").get(id) as Record<string, any> | undefined;
    return row ? mapDictionaryEntry(row) : null;
  }
}

function mapDictionaryEntry(row: Record<string, any>): DictionaryEntry {
  return {
    id: Number(row.id),
    word: String(row.word),
    ukPhonetic: row.uk_phonetic ?? undefined,
    usPhonetic: row.us_phonetic ?? undefined,
    partOfSpeech: row.part_of_speech ?? undefined,
    meaningCn: String(row.meaning_cn),
    wordForms: row.word_forms_json ? JSON.parse(String(row.word_forms_json)) : undefined,
    source: row.source,
  };
}
