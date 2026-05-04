import { describe, expect, it } from "vitest";
import { transitionDictationState } from "@dictation/dictation-engine";

describe("dictation state machine", () => {
  it("follows setup to playback flow", () => {
    expect(transitionDictationState("idle", { type: "OPEN_SOURCE_PICKER" })).toBe("sourceSelecting");
    expect(transitionDictationState("sourceSelecting", { type: "CHOOSE_SOURCE" })).toBe("configured");
    expect(transitionDictationState("configured", { type: "START" })).toBe("preparing");
    expect(transitionDictationState("preparing", { type: "READY", autoPlayNext: true })).toBe("playing");
  });

  it("routes grading feedback to the correct answered state", () => {
    expect(transitionDictationState("checking", { type: "GRADE_DONE", correct: true })).toBe("answeredCorrect");
    expect(transitionDictationState("checking", { type: "GRADE_DONE", correct: false })).toBe("answeredWrong");
  });
});
