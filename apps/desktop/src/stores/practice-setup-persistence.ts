import type { PracticeSetup } from "@dictation/domain";
import { defaultGradingRules, defaultPlaybackSettings } from "@dictation/domain";

type PersistedPracticeSetup = Omit<PracticeSetup, "source" | "sampleWordIds">;

const PRACTICE_SETTINGS_STORAGE_KEY = "dictation.practice-settings.v1";

export function createDefaultPracticeSetup(): PracticeSetup {
  return {
    source: { sourceType: "none" },
    mode: "typing",
    accent: "uk",
    orderMode: "sequence",
    sampleCount: 1,
    showChineseHint: false,
    playbackSettings: defaultPlaybackSettings,
    gradingRules: defaultGradingRules,
  };
}

export function loadPracticeSetup(): PracticeSetup {
  const defaults = createDefaultPracticeSetup();
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(PRACTICE_SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const persisted = JSON.parse(raw) as Partial<PersistedPracticeSetup>;
    return {
      ...defaults,
      mode: persisted.mode === "paper" ? "paper" : "typing",
      accent: persisted.accent === "us" ? "us" : "uk",
      orderMode: persisted.orderMode === "random" || persisted.orderMode === "sample" ? persisted.orderMode : "sequence",
      sampleCount: Number.isFinite(persisted.sampleCount) ? Math.max(1, Math.round(Number(persisted.sampleCount))) : defaults.sampleCount,
      sampleWordIds: undefined,
      showChineseHint: persisted.showChineseHint === true,
      playbackSettings: {
        playCount: persisted.playbackSettings?.playCount === 1 || persisted.playbackSettings?.playCount === 3 ? persisted.playbackSettings.playCount : 2,
        intervalSec:
          persisted.playbackSettings?.intervalSec === 10 || persisted.playbackSettings?.intervalSec === 15 ? persisted.playbackSettings.intervalSec : 5,
        speed: persisted.playbackSettings?.speed === 0.5 || persisted.playbackSettings?.speed === 1.5 ? persisted.playbackSettings.speed : 1,
        allowReplay: persisted.playbackSettings?.allowReplay !== false,
        autoPlayNext: persisted.playbackSettings?.autoPlayNext !== false,
      },
      gradingRules: {
        ...defaults.gradingRules,
        ignoreCase: persisted.gradingRules?.ignoreCase !== false,
        trimWhitespace: persisted.gradingRules?.trimWhitespace !== false,
        acceptUkUs: persisted.gradingRules?.acceptUkUs !== false,
        collapseSpaces: persisted.gradingRules?.collapseSpaces !== false,
        strictHyphen: persisted.gradingRules?.strictHyphen === true,
        strictApostrophe: persisted.gradingRules?.strictApostrophe === true,
        skippedAsWrong: persisted.gradingRules?.skippedAsWrong === true,
      },
    };
  } catch {
    return defaults;
  }
}

export function persistPracticeSetupSettings(setup: PracticeSetup): void {
  if (typeof window === "undefined") return;
  const persisted: PersistedPracticeSetup = {
    mode: setup.mode,
    accent: setup.accent,
    orderMode: setup.orderMode,
    sampleCount: setup.sampleCount,
    showChineseHint: setup.showChineseHint,
    playbackSettings: setup.playbackSettings,
    gradingRules: setup.gradingRules,
  };
  try {
    window.localStorage.setItem(PRACTICE_SETTINGS_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // Local persistence is best-effort; the running setup should still update.
  }
}

export function resetPracticeSetupSettings(): PracticeSetup {
  const setup = createDefaultPracticeSetup();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(PRACTICE_SETTINGS_STORAGE_KEY);
    } catch {
      // Local persistence is best-effort; clearing app data should continue.
    }
  }
  return setup;
}
