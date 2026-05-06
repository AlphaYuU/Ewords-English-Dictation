import type { AppState, GetAppState, SetAppState } from "../store-types";
import { normalizeTags } from "../store-helpers";
import { persistDatabaseMutation, persistDatabaseMutationAsync } from "../store-persistence";
import { normalizeWordKey } from "../word-state-transitions";

export function createLibrarySlice(set: SetAppState, get: GetAppState): Pick<AppState, "createLibrary" | "deleteCustomLibrary" | "reorderLibraries" | "deleteWord" | "importWords"> {
  return {
    createLibrary: (input) => {
      const payload = typeof input === "string" ? { name: input } : input;
      const trimmed = payload.name.trim();
      const tags = normalizeTags(payload.tags);
      const coverColor = payload.coverColor ?? "#D4916E";
      if (!trimmed) return;
      if (get().dataSource === "database") {
        set({ dialog: null });
        persistDatabaseMutation(set, get, { resource: "create-library", name: trimmed, tags, coverColor });
        return;
      }
      set((state) => {
        const id = Math.max(...state.libraries.map((library) => library.id)) + 1;
        return {
          dialog: null,
          libraries: [
            ...state.libraries,
            {
              id,
              name: trimmed,
              description: "自建词库",
              tags,
              type: "custom",
              coverColor,
              coverIcon: "book",
              wordCount: 0,
              unitCount: 1,
              progress: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ],
          units: [...state.units, { id: id * 10, libraryId: id, name: "全部", sortOrder: 0, wordCount: 0 }],
        };
      });
    },
    deleteCustomLibrary: (id) => {
      set((state) => ({
        dialog: null,
        libraries: state.libraries.filter((library) => library.id !== id || library.type !== "custom"),
        words: state.words.filter((word) => word.libraryId !== id),
      }));
      if (get().dataSource === "database") persistDatabaseMutation(set, get, { resource: "delete-library", libraryId: id });
    },
    reorderLibraries: (libraryIds) => {
      set((state) => {
        const order = new Map(libraryIds.map((id, index) => [id, index]));
        return {
          libraries: state.libraries
            .map((library) => ({ ...library, updatedAt: order.has(library.id) ? Date.now() : library.updatedAt }))
            .sort((left, right) => (order.get(left.id) ?? 9999) - (order.get(right.id) ?? 9999)),
        };
      });
      if (get().dataSource === "database") persistDatabaseMutation(set, get, { resource: "update-library-order", libraryIds });
    },
    deleteWord: (wordId) => {
      set((state) => {
        const target = state.words.find((word) => word.id === wordId);
        const nextWords = state.words.filter((word) => word.id !== wordId);
        return {
          words: nextWords,
          results: state.results.filter((row) => row.wordId !== wordId),
          libraries: target
            ? state.libraries.map((library) =>
                library.id === target.libraryId ? { ...library, wordCount: Math.max(0, library.wordCount - 1), updatedAt: Date.now() } : library,
              )
            : state.libraries,
          units: target?.unitIds?.length
            ? state.units.map((unit) => (target.unitIds?.includes(unit.id) ? { ...unit, wordCount: Math.max(0, unit.wordCount - 1) } : unit))
            : state.units,
        };
      });
      if (get().dataSource === "database") persistDatabaseMutation(set, get, { resource: "delete-word", wordId });
    },
    importWords: async (rows, targetLibraryId, options) => {
      const importableRows = rows.filter((row) => row.word && row.action === "add" && row.status !== "error");
      if (!importableRows.length) {
        set({ dialog: "import-failed" });
        return false;
      }
      if (get().dataSource === "database") {
        const ok = await persistDatabaseMutationAsync(set, get, { resource: "import-words", rows: importableRows, targetLibraryId });
        if (ok && !options?.silent) set({ dialog: "import-success" });
        return ok;
      }
      set((state) => {
        const existingLibrary = targetLibraryId ? state.libraries.find((library) => library.id === targetLibraryId) : state.libraries.find((library) => library.type === "custom");
        const libraryId = existingLibrary?.id ?? Math.max(...state.libraries.map((library) => library.id), 20) + 1;
        const unitId = state.units.find((unit) => unit.libraryId === libraryId)?.id ?? libraryId * 10;
        const nextDictionaryStart = Math.max(...state.dictionary.map((entry) => entry.id), 1000) + 1;
        const nextWordStart = Math.max(...state.words.map((word) => word.id), 1000) + 1;
        const importedDictionary = importableRows.map((row, index) => ({
          id: nextDictionaryStart + index,
          word: row.word,
          meaningCn: row.meaning || "暂无释义",
          partOfSpeech: row.partOfSpeech,
          source: "custom" as const,
        }));
        const importedWords = importableRows.map((row, index) => ({
          id: nextWordStart + index,
          libraryId,
          dictionaryEntryId: nextDictionaryStart + index,
          wordKey: normalizeWordKey(row.word),
          unitIds: [unitId],
          word: row.word,
          meaning: row.meaning || "暂无释义",
          partOfSpeech: row.partOfSpeech,
          isFavorite: false,
          inWrongBook: false,
          masteryLevel: 0,
          wrongCount: 0,
          dictationCount: 0,
          addedAt: Date.now() + index,
        }));
        const nextLibraries = existingLibrary
          ? state.libraries.map((library) => (library.id === libraryId ? { ...library, wordCount: library.wordCount + importedWords.length, updatedAt: Date.now() } : library))
          : [
              ...state.libraries,
              {
                id: libraryId,
                name: "导入词库",
                description: `${importedWords.length} 词`,
                type: "custom" as const,
                coverColor: "#F3EBE2",
                coverIcon: "book",
                wordCount: importedWords.length,
                unitCount: 1,
                progress: 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ];
        return {
          dialog: options?.silent ? state.dialog : "import-success",
          libraries: nextLibraries,
          units: state.units.some((unit) => unit.id === unitId) ? state.units : [...state.units, { id: unitId, libraryId, name: "全部", sortOrder: 0, wordCount: importedWords.length }],
          dictionary: [...state.dictionary, ...importedDictionary],
          words: [...state.words, ...importedWords],
        };
      });
      return true;
    },
  };
}
