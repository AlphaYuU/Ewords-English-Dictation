import type { DictationResult } from "@dictation/domain";
import type { SQLiteDatabase } from "../db/client";

export class DictationResultRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  findBySession(sessionId: number): DictationResult[] {
    const rows = this.db.prepare("SELECT * FROM dictation_results WHERE session_id = ? ORDER BY order_index").all(sessionId) as Record<string, any>[];
    return rows.map((row) => ({
      id: Number(row.id),
      sessionId: Number(row.session_id),
      wordId: Number(row.word_id),
      orderIndex: Number(row.order_index),
      word: String(row.word),
      meaning: String(row.meaning),
      userAnswer: row.user_answer ?? undefined,
      correctAnswer: String(row.correct_answer),
      result: row.result,
      hintUsed: Boolean(row.hint_used),
      isFavorited: Boolean(row.is_favorited),
      isAddedToWrongBook: Boolean(row.is_added_to_wrong_book),
    }));
  }
}
