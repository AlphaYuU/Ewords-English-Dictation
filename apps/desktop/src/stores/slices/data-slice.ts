import { normalizeLibrariesForDisplay } from "../../services/library-display";
import type { AppState, GetAppState, SetAppState } from "../store-types";
import { hydrateFromDesktopDatabase, emptyDataState, persistDatabaseMutation } from "../store-persistence";
import { resetPracticeSetupSettings } from "../practice-setup-persistence";

export function createDataSlice(set: SetAppState, get: GetAppState): Pick<AppState, "hydrateFromDatabase" | "restoreBackup" | "clearAllData" | "updateSettings"> {
  return {
    hydrateFromDatabase: () => hydrateFromDesktopDatabase(set, get),
    restoreBackup: (backup) => {
      set({
        libraries: backup.libraries ? normalizeLibrariesForDisplay(backup.libraries) : get().libraries,
        units: backup.units ?? get().units,
        words: backup.words ?? get().words,
        sessions: backup.sessions ?? get().sessions,
        results: backup.results ?? get().results,
        history: backup.history ?? get().history,
        searchHistory: backup.searchHistory ?? get().searchHistory,
        settings: backup.settings ? { ...get().settings, ...backup.settings } : get().settings,
        dialog: null,
      });
      if (get().dataSource === "database") persistDatabaseMutation(set, get, { resource: "restore-data", backup });
    },
    clearAllData: () => {
      const setup = resetPracticeSetupSettings();
      set({
        dialog: null,
        selectedLibraryId: null,
        pendingAddWordId: null,
        pendingAddDictionaryEntry: null,
        setup,
        sessionIndex: 0,
        answerInput: "",
        sessionFeedback: "idle",
        libraryListUiState: {},
      });
      if (get().dataSource === "database") {
        set({ hydrationStatus: "loading", hydrationError: undefined });
        persistDatabaseMutation(set, get, { resource: "clear-data" });
        return;
      }
      set({
        ...emptyDataState(),
        dataSource: "empty",
        hydrationStatus: "ready",
        hydrationError: undefined,
      });
    },
    updateSettings: (settings) => {
      set((state) => ({ settings: { ...state.settings, ...settings } }));
      if (get().dataSource === "database") persistDatabaseMutation(set, get, { resource: "update-settings", settings });
    },
  };
}
