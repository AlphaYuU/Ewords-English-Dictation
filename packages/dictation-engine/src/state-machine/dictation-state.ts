export type DictationState =
  | "idle"
  | "sourceSelecting"
  | "configured"
  | "preparing"
  | "playing"
  | "waitingInput"
  | "checking"
  | "answeredCorrect"
  | "answeredWrong"
  | "paused"
  | "settingsOpen"
  | "exiting"
  | "completed"
  | "abandoned";

export type DictationEvent =
  | { type: "OPEN_SOURCE_PICKER" }
  | { type: "CHOOSE_SOURCE" }
  | { type: "START" }
  | { type: "READY"; autoPlayNext: boolean }
  | { type: "AUDIO_ENDED" }
  | { type: "SUBMIT"; correct?: boolean }
  | { type: "GRADE_DONE"; correct: boolean }
  | { type: "NEXT"; isLast?: boolean; autoPlayNext?: boolean }
  | { type: "PAUSE" }
  | { type: "RESUME"; prior?: DictationState }
  | { type: "OPEN_SETTINGS" }
  | { type: "APPLY_SETTINGS"; prior?: DictationState }
  | { type: "EXIT" }
  | { type: "CANCEL_EXIT"; prior?: DictationState }
  | { type: "SAVE_AND_COMPLETE" }
  | { type: "ABANDON" };
