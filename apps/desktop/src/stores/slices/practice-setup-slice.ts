import type { AppState, GetAppState, SetAppState } from "../store-types";
import { clampPracticeSampleCount, materializeSampleForSetup, sessionSettingsFromSetup, sourceWordCountForSetup } from "../store-helpers";
import { persistPracticeQueue, persistSessionSnapshot } from "../store-persistence";
import { persistPracticeSetupSettings } from "../practice-setup-persistence";

export function createPracticeSetupSlice(set: SetAppState, get: GetAppState): Pick<
  AppState,
  | "setPracticeSource"
  | "setPracticeMode"
  | "setPracticeAccent"
  | "setPracticeOrderMode"
  | "setPracticeSampleCount"
  | "materializePracticeSample"
  | "updatePlaybackSettings"
  | "updateGradingRules"
  | "setShowChineseHint"
  | "setAnswerInput"
> {
  return {
    setPracticeSource: (source) => {
      set((state) => {
        const sourceCount = sourceWordCountForSetup({ ...state.setup, source }, state.words, state.results);
        const setup = { ...state.setup, source, sampleCount: sourceCount > 0 ? sourceCount : state.setup.sampleCount, sampleWordIds: undefined };
        persistPracticeSetupSettings(setup);
        return { setup };
      });
      persistPracticeQueue(set, get, source, get().words);
    },
    setPracticeMode: (mode) =>
      set((state) => {
        const setup = { ...state.setup, mode };
        persistPracticeSetupSettings(setup);
        return { setup };
      }),
    setPracticeAccent: (accent) =>
      set((state) => {
        const setup = { ...state.setup, accent };
        persistPracticeSetupSettings(setup);
        return { setup };
      }),
    setPracticeOrderMode: (orderMode) =>
      set((state) => {
        const setup = { ...state.setup, orderMode, sampleWordIds: undefined };
        persistPracticeSetupSettings(setup);
        return { setup };
      }),
    setPracticeSampleCount: (sampleCount) =>
      set((state) => {
        const setup = { ...state.setup, sampleCount: clampPracticeSampleCount(state.setup, state.words, state.results, sampleCount), sampleWordIds: undefined };
        persistPracticeSetupSettings(setup);
        return { setup };
      }),
    materializePracticeSample: () => {
      const state = get();
      const materialized = materializeSampleForSetup(state.setup, state.words, state.results);
      if (materialized.setup !== state.setup) set({ setup: materialized.setup });
      return materialized.selectedWords;
    },
    updatePlaybackSettings: (settings) => {
      set((state) => {
        const playbackSettings = { ...state.setup.playbackSettings, ...settings };
        const setup = { ...state.setup, playbackSettings };
        persistPracticeSetupSettings(setup);
        return {
          setup,
          sessions: state.sessions.map((session) =>
            session.status === "active" || session.status === "paused"
              ? { ...session, settings: { ...(session.settings ?? sessionSettingsFromSetup(state.setup)), playbackSettings } }
              : session,
          ),
        };
      });
      for (const session of get().sessions.filter((item) => item.status === "active" || item.status === "paused")) persistSessionSnapshot(set, get, session.id, []);
    },
    updateGradingRules: (rules) => {
      set((state) => {
        const gradingRules = { ...state.setup.gradingRules, ...rules };
        const setup = { ...state.setup, gradingRules };
        persistPracticeSetupSettings(setup);
        return {
          setup,
          sessions: state.sessions.map((session) =>
            session.status === "active" || session.status === "paused"
              ? { ...session, settings: { ...(session.settings ?? sessionSettingsFromSetup(state.setup)), gradingRules } }
              : session,
          ),
        };
      });
      for (const session of get().sessions.filter((item) => item.status === "active" || item.status === "paused")) persistSessionSnapshot(set, get, session.id, []);
    },
    setShowChineseHint: (showChineseHint) =>
      set((state) => {
        const setup = { ...state.setup, showChineseHint };
        persistPracticeSetupSettings(setup);
        return { setup };
      }),
    setAnswerInput: (answerInput) => set({ answerInput }),
  };
}
