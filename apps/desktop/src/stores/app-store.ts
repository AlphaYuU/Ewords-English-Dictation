import { create } from "zustand";
import { defaultSettings } from "@dictation/domain";
import type { AppState } from "./store-types";
import { loadPracticeSetup } from "./practice-setup-persistence";
import { createDataSlice } from "./slices/data-slice";
import { createHistorySlice } from "./slices/history-slice";
import { createLibrarySlice } from "./slices/library-slice";
import { createPracticeSessionSlice } from "./slices/practice-session-slice";
import { createPracticeSetupSlice } from "./slices/practice-setup-slice";
import { createUiSlice } from "./slices/ui-slice";
import { createWordStateSlice } from "./slices/word-state-slice";

export { resolveSetupWords } from "./practice-word-resolver";
export type { AppBackup, AppState, CreateLibraryInput, DialogName, LibraryListUiState } from "./store-types";

export const useAppStore = create<AppState>((set, get) => ({
  libraries: [],
  units: [],
  words: [],
  dictionary: [],
  examples: [],
  sessions: [],
  results: [],
  history: [],
  searchHistory: [],
  settings: defaultSettings,
  dataSource: "empty",
  hydrationStatus: "idle",
  dialog: null,
  selectedLibraryId: null,
  pendingAddWordId: null,
  pendingAddDictionaryEntry: null,
  setup: loadPracticeSetup(),
  sessionIndex: 0,
  answerInput: "",
  sessionFeedback: "idle",
  libraryListUiState: {},
  ...createUiSlice(set),
  ...createDataSlice(set, get),
  ...createLibrarySlice(set, get),
  ...createWordStateSlice(set, get),
  ...createPracticeSetupSlice(set, get),
  ...createPracticeSessionSlice(set, get),
  ...createHistorySlice(set, get),
}));
