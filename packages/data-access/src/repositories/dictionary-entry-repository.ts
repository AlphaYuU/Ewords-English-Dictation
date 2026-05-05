import type { DictionaryEntry } from "@dictation/domain";
import type { SQLInputValue } from "node:sqlite";
import type { SQLiteDatabase } from "../db/client";

export class DictionaryEntryRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  search(query: string, limit = 20): DictionaryEntry[] {
    const normalized = query.trim();
    if (!normalized) return [];
    const rows: Record<string, any>[] = [];
    const seen = new Set<string>();
    const appendRows = (sql: string, params: SQLInputValue[]) => {
      if (rows.length >= limit) return;
      const candidates = this.db.prepare(sql).all(...params, limit - rows.length) as Record<string, any>[];
      for (const row of candidates) {
        const key = String(row.word).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(row);
        if (rows.length >= limit) break;
      }
    };
    appendRows(
      "SELECT * FROM dictionary_entries WHERE word LIKE ? COLLATE NOCASE ORDER BY CASE WHEN word = ? COLLATE NOCASE THEN 0 ELSE 1 END, word LIMIT ?",
      [`${normalized}%`, normalized],
    );
    appendRows(
      "SELECT * FROM dictionary_entries WHERE word LIKE ? COLLATE NOCASE ORDER BY CASE WHEN word = ? COLLATE NOCASE THEN 0 ELSE 1 END, word LIMIT ?",
      [`%${normalized}%`, normalized],
    );
    if (normalized.length >= 2) {
      appendRows("SELECT * FROM dictionary_entries WHERE meaning_cn LIKE ? ORDER BY word LIMIT ?", [`%${normalized}%`]);
    }
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
