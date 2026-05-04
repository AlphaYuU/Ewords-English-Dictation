import type { DictationSession } from "@dictation/domain";
import type { SQLiteDatabase } from "../db/client";

export class DictationSessionRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  findById(id: number): DictationSession | null {
    const row = this.db.prepare("SELECT * FROM dictation_sessions WHERE id = ?").get(id) as Record<string, any> | undefined;
    if (!row) return null;
    return {
      id: Number(row.id),
      source: { sourceType: row.source_type, sourceId: row.source_id } as DictationSession["source"],
      sourceName: String(row.source_name),
      mode: row.mode,
      accent: row.accent,
      status: row.status,
      wordCount: Number(row.word_count),
      durationSec: Number(row.duration_sec),
      createdAt: Number(row.created_at),
      completedAt: row.completed_at == null ? undefined : Number(row.completed_at),
    };
  }
}
