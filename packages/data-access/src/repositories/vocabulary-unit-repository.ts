import type { VocabularyUnit } from "@dictation/domain";
import type { SQLiteDatabase } from "../db/client";

export class VocabularyUnitRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  findByLibrary(libraryId: number): VocabularyUnit[] {
    return this.db
      .prepare("SELECT id, library_id as libraryId, name, sort_order as sortOrder, word_count as wordCount FROM vocabulary_units WHERE library_id = ? ORDER BY sort_order")
      .all(libraryId) as VocabularyUnit[];
  }
}
