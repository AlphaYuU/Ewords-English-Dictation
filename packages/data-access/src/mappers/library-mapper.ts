import type { VocabularyLibrary, VocabularyWord } from "@dictation/domain";

export function mapLibraryRow(row: Record<string, any>): VocabularyLibrary {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: row.description ?? undefined,
    tags: parseTags(row.tags_json),
    type: row.type,
    coverColor: row.cover_color ?? undefined,
    coverIcon: row.cover_icon ?? undefined,
    wordCount: Number(row.word_count ?? 0),
    unitCount: Number(row.unit_count ?? 0),
    progress: Number(row.progress ?? 0),
    accuracy: row.accuracy == null ? undefined : Number(row.accuracy),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function parseTags(value: unknown): string[] | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : undefined;
  } catch {
    return undefined;
  }
}

export function mapWordRow(row: Record<string, any>): VocabularyWord {
  return {
    id: Number(row.id),
    libraryId: Number(row.library_id),
    dictionaryEntryId: row.dictionary_entry_id == null ? undefined : Number(row.dictionary_entry_id),
    wordKey: String(row.word).trim().toLowerCase(),
    word: String(row.word),
    meaning: String(row.meaning),
    phonetic: row.phonetic ?? undefined,
    partOfSpeech: row.part_of_speech ?? undefined,
    isFavorite: Boolean(row.state_is_favorite ?? row.is_favorite),
    inWrongBook: Number(row.state_wrong_count ?? row.wrong_count ?? 0) > 0,
    masteryLevel: Number(row.state_mastery_level ?? row.mastery_level ?? 0),
    wrongCount: Number(row.state_wrong_count ?? row.wrong_count ?? 0),
    dictationCount: Number(row.state_dictation_count ?? row.dictation_count ?? 0),
    lastDictatedAt: row.state_last_dictated_at == null && row.last_dictated_at == null ? undefined : Number(row.state_last_dictated_at ?? row.last_dictated_at),
    addedAt: Number(row.added_at),
  };
}
