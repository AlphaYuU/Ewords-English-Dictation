import type { SQLiteDatabase } from "../db/client";

export class FavoriteRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  add(wordId: number): void {
    this.db.prepare("INSERT OR REPLACE INTO favorite_words (word_id, favorited_at) VALUES (?, ?)").run(wordId, Date.now());
  }

  remove(wordId: number): void {
    this.db.prepare("DELETE FROM favorite_words WHERE word_id = ?").run(wordId);
  }
}
