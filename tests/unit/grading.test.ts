import { describe, expect, it } from "vitest";
import { gradeAnswer, normalizeAnswer } from "@dictation/dictation-engine";

describe("grading rules", () => {
  it("normalizes case, punctuation, whitespace and apostrophes", () => {
    expect(normalizeAnswer("  AMBIGUOUS!  ")).toBe("ambiguous");
    expect(normalizeAnswer("state-of-the-art")).toBe("stateoftheart");
    expect(normalizeAnswer("don't")).toBe("dont");
  });

  it("grades exact normalized answers as correct", () => {
    expect(gradeAnswer("Ambiguous", "ambiguous").result).toBe("correct");
    expect(gradeAnswer("ambiant", "ambient").result).toBe("wrong");
  });

  it("accepts common UK and US spelling variants only when enabled", () => {
    expect(gradeAnswer("colour", "color").result).toBe("correct");
    expect(gradeAnswer("colour", "color", { acceptUkUs: false }).result).toBe("wrong");
  });
});
