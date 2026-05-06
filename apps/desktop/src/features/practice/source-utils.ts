import type { PracticeSource, PracticeSourceGroup, VocabularyLibrary, VocabularyWord } from "@dictation/domain";

export type SourceChipItem = {
  key: string;
  label: string;
  wordIds: number[];
};

export function parsePracticeSource(searchParams: URLSearchParams, resetWhenMissing: boolean): PracticeSource | null {
  const sourceType = searchParams.get("source_type");
  if (!sourceType) return resetWhenMissing ? { sourceType: "none" } : null;
  if (sourceType === "none") return { sourceType: "none" };
  if (sourceType === "wrong_book") return { sourceType: "wrong_book" };
  if (sourceType === "favorite") return { sourceType: "favorite" };
  if (sourceType === "library" || sourceType === "unit" || sourceType === "history_session") {
    const sourceId = Number(searchParams.get("source_id"));
    if (!Number.isFinite(sourceId)) return { sourceType: "none" };
    if (sourceType === "history_session") {
      const filter = searchParams.get("filter") === "wrong" ? "wrong" : searchParams.get("filter") === "all" ? "all" : undefined;
      return filter ? { sourceType, sourceId, filter } : { sourceType, sourceId };
    }
    return { sourceType, sourceId };
  }
  if (sourceType === "words") {
    const wordIds = (searchParams.get("word_ids") ?? "")
      .split(",")
      .map((item) => Number(item.trim()))
      .filter(Number.isFinite);
    return wordIds.length ? { sourceType: "words", wordIds } : { sourceType: "none" };
  }
  return { sourceType: "none" };
}

export function samePracticeSource(left: PracticeSource, right: PracticeSource): boolean {
  if (left.sourceType !== right.sourceType) return false;
  if (left.sourceType === "history_session" && right.sourceType === "history_session") {
    return left.sourceId === right.sourceId && left.filter === right.filter;
  }
  if ("sourceId" in left || "sourceId" in right) return "sourceId" in left && "sourceId" in right && left.sourceId === right.sourceId;
  if ("wordIds" in left || "wordIds" in right) {
    return "wordIds" in left && "wordIds" in right && left.wordIds.join(",") === right.wordIds.join(",");
  }
  return true;
}

export function sourceLabel(source: PracticeSource, libraries: { id: number; name: string }[], units: { id: number; name: string }[]): string {
  if (source.sourceType === "library") return libraries.find((library) => library.id === source.sourceId)?.name ?? "词库";
  if (source.sourceType === "unit") return units.find((unit) => unit.id === source.sourceId)?.name ?? "Unit";
  if (source.sourceType === "wrong_book") return "错题本";
  if (source.sourceType === "favorite") return "收藏夹";
  if (source.sourceType === "history_session") return "历史记录";
  if (source.sourceType === "words") return source.wordIds.length ? "多个来源" : "未选择";
  return "未选择";
}

export function buildWordSourceChips(words: VocabularyWord[], libraries: VocabularyLibrary[], sourceGroups?: PracticeSourceGroup[]): SourceChipItem[] {
  if (!words.length) return [{ key: "none", label: "未选择来源", wordIds: [] }];
  const wordIds = new Set(words.map((word) => word.id));
  const grouped = normalizeSourceGroups(sourceGroups ?? [], [...wordIds]);
  if (grouped.length) {
    return grouped.map((group) => ({
      key: group.key,
      label: `${group.label} · ${group.wordIds.length}词`,
      wordIds: group.wordIds,
    }));
  }
  const counts = new Map<number, number>();
  const wordIdsByLibrary = new Map<number, number[]>();
  for (const word of words) {
    counts.set(word.libraryId, (counts.get(word.libraryId) ?? 0) + 1);
    wordIdsByLibrary.set(word.libraryId, [...(wordIdsByLibrary.get(word.libraryId) ?? []), word.id]);
  }
  return [...counts.entries()].map(([libraryId, count]) => ({
    key: String(libraryId),
    label: `${libraryId === 0 ? "词典" : libraries.find((library) => library.id === libraryId)?.name ?? "词库"} · ${count}词`,
    wordIds: wordIdsByLibrary.get(libraryId) ?? [],
  }));
}

export function normalizeSourceGroups(groups: PracticeSourceGroup[], selectedWordIds: number[]): PracticeSourceGroup[] {
  const selectedSet = new Set(selectedWordIds);
  return groups
    .map((group) => ({
      ...group,
      wordIds: [...new Set(group.wordIds.filter((wordId) => selectedSet.has(wordId)))],
    }))
    .filter((group) => group.wordIds.length);
}

export function sourceGroupForLibrary(library: VocabularyLibrary | undefined): Pick<PracticeSourceGroup, "key" | "label"> {
  if (!library) return { key: "unknown", label: "词库" };
  if (library.type === "favorite") return { key: "favorite", label: "收藏夹" };
  if (library.type === "wrong_book") return { key: "wrong_book", label: "错题本" };
  return { key: `library:${library.id}`, label: library.name };
}

export function inferInitialLibraryId(source: PracticeSource, selectedWords: VocabularyWord[], libraries: VocabularyLibrary[]): number {
  if (source.sourceType === "library") return source.sourceId;
  if (source.sourceType === "wrong_book") return libraries.find((library) => library.type === "wrong_book")?.id ?? libraries[0]?.id ?? 0;
  if (source.sourceType === "favorite") return libraries.find((library) => library.type === "favorite")?.id ?? libraries[0]?.id ?? 0;
  if (selectedWords[0]) return selectedWords[0].libraryId;
  return libraries.find((library) => library.type === "official" || library.type === "custom")?.id ?? libraries[0]?.id ?? 0;
}

export function wordsForSourceLibrary(library: VocabularyLibrary, words: VocabularyWord[]): VocabularyWord[] {
  if (library.type === "wrong_book") return words.filter((word) => word.inWrongBook || word.wrongCount > 0);
  if (library.type === "favorite") return words.filter((word) => word.isFavorite);
  return words.filter((word) => word.libraryId === library.id);
}
