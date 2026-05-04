import type { DictationEvent, DictationState } from "./dictation-state";

export function transitionDictationState(state: DictationState, event: DictationEvent): DictationState {
  switch (state) {
    case "idle":
      return event.type === "OPEN_SOURCE_PICKER" ? "sourceSelecting" : state;
    case "sourceSelecting":
      return event.type === "CHOOSE_SOURCE" ? "configured" : state;
    case "configured":
      return event.type === "START" ? "preparing" : event.type === "OPEN_SOURCE_PICKER" ? "sourceSelecting" : state;
    case "preparing":
      return event.type === "READY" ? (event.autoPlayNext ? "playing" : "waitingInput") : state;
    case "playing":
      if (event.type === "AUDIO_ENDED") return "waitingInput";
      if (event.type === "PAUSE") return "paused";
      if (event.type === "OPEN_SETTINGS") return "settingsOpen";
      if (event.type === "EXIT") return "exiting";
      return state;
    case "waitingInput":
      if (event.type === "SUBMIT") return "checking";
      if (event.type === "PAUSE") return "paused";
      if (event.type === "OPEN_SETTINGS") return "settingsOpen";
      if (event.type === "EXIT") return "exiting";
      return state;
    case "checking":
      return event.type === "GRADE_DONE" ? (event.correct ? "answeredCorrect" : "answeredWrong") : state;
    case "answeredCorrect":
    case "answeredWrong":
      if (event.type === "NEXT") {
        if (event.isLast) return "completed";
        return event.autoPlayNext ? "playing" : "waitingInput";
      }
      return state;
    case "paused":
      return event.type === "RESUME" ? (event.prior && event.prior !== "paused" ? event.prior : "waitingInput") : state;
    case "settingsOpen":
      return event.type === "APPLY_SETTINGS"
        ? event.prior && event.prior !== "settingsOpen"
          ? event.prior
          : "waitingInput"
        : state;
    case "exiting":
      if (event.type === "CANCEL_EXIT") return event.prior && event.prior !== "exiting" ? event.prior : "waitingInput";
      if (event.type === "SAVE_AND_COMPLETE") return "completed";
      if (event.type === "ABANDON") return "abandoned";
      return state;
    case "completed":
    case "abandoned":
      return state;
  }
}
