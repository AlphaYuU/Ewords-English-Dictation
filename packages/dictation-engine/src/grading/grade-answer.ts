import type { GradingRules } from "@dictation/domain";
import { normalizeAnswer } from "./normalize-answer";

export type GradeAnswerResult = {
  result: "correct" | "wrong";
  normalizedUserAnswer: string;
  normalizedCorrectAnswer: string;
};

export function gradeAnswer(userAnswer: string, correctAnswer: string, rules: Partial<GradingRules> = {}): GradeAnswerResult {
  const normalizedUserAnswer = normalizeAnswer(userAnswer, rules);
  const normalizedCorrectAnswer = normalizeAnswer(correctAnswer, rules);
  return {
    result: normalizedUserAnswer === normalizedCorrectAnswer ? "correct" : "wrong",
    normalizedUserAnswer,
    normalizedCorrectAnswer,
  };
}
