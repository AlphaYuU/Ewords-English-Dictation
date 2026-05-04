import type { SQLiteDatabase } from "../db/client";

export class WrongBookRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  add(wordId: number, userAnswer?: string): void {
    this.db
      .prepare(
        "INSERT INTO wrong_book_words (word_id, wrong_count, last_wrong_at, last_user_answer) VALUES (?, 1, ?, ?) ON CONFLICT(word_id) DO UPDATE SET wrong_count = wrong_count + 1, last_wrong_at = excluded.last_wrong_at, last_user_answer = excluded.last_user_answer",
      )
      .run(wordId, Date.now(), userAnswer ?? null);
  }

  remove(wordId: number): void {
    this.db.prepare("DELETE FROM wrong_book_words WHERE word_id = ?").run(wordId);
  }
}
