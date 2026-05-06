import type { AppState, SetAppState } from "../store-types";

export function createUiSlice(set: SetAppState): Pick<
  AppState,
  "openDialog" | "closeDialog" | "setSelectedLibraryId" | "setPendingAddWordId" | "setPendingAddDictionaryEntry" | "setLibraryListUiState"
> {
  return {
    openDialog: (dialog) => set({ dialog }),
    closeDialog: () => set({ dialog: null, pendingAddWordId: null, pendingAddDictionaryEntry: null }),
    setSelectedLibraryId: (selectedLibraryId) => set({ selectedLibraryId }),
    setPendingAddWordId: (pendingAddWordId) => set({ pendingAddWordId }),
    setPendingAddDictionaryEntry: (pendingAddDictionaryEntry) => set({ pendingAddDictionaryEntry }),
    setLibraryListUiState: (key, patch) =>
      set((state) => ({
        libraryListUiState: {
          ...state.libraryListUiState,
          [key]: {
            ...state.libraryListUiState[key],
            ...patch,
          },
        },
      })),
  };
}
