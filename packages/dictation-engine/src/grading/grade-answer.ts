import type { GradingRules } from "@dictation/domain";
import { normalizeAnswer } from "./normalize-answer";

export type GradeAnswerResult = {
  result: "correct" | "wrong";
  normalizedUserAnswer: string;
  normalizedCorrectAnswer: string;
};

const ukUsSpellingPairs = [
  ["aluminum", "aluminium"],
  ["analyze", "analyse"],
  ["behavior", "behaviour"],
  ["canceled", "cancelled"],
  ["canceling", "cancelling"],
  ["catalog", "catalogue"],
  ["center", "centre"],
  ["check", "cheque"],
  ["color", "colour"],
  ["curb", "kerb"],
  ["defense", "defence"],
  ["dialog", "dialogue"],
  ["favorite", "favourite"],
  ["fiber", "fibre"],
  ["gray", "grey"],
  ["honor", "honour"],
  ["jewelry", "jewellery"],
  ["labor", "labour"],
  ["license", "licence"],
  ["liter", "litre"],
  ["meter", "metre"],
  ["mold", "mould"],
  ["neighbor", "neighbour"],
  ["offense", "offence"],
  ["organize", "organise"],
  ["plow", "plough"],
  ["practice", "practise"],
  ["program", "programme"],
  ["realize", "realise"],
  ["theater", "theatre"],
  ["tire", "tyre"],
  ["traveled", "travelled"],
  ["traveler", "traveller"],
] as const;

const ukUsSpellingMap = new Map<string, string>(
  ukUsSpellingPairs.flatMap(([us, uk]) => [
    [us, uk],
    [uk, us],
  ]),
);

function matchesUkUsSpelling(userAnswer: string, correctAnswer: string): boolean {
  const userTokens = userAnswer.split(" ");
  const correctTokens = correctAnswer.split(" ");
  if (userTokens.length !== correctTokens.length) return false;
  return userTokens.every((token, index) => token === correctTokens[index] || ukUsSpellingMap.get(token) === correctTokens[index]);
}

export function gradeAnswer(userAnswer: string, correctAnswer: string, rules: Partial<GradingRules> = {}): GradeAnswerResult {
  const normalizedUserAnswer = normalizeAnswer(userAnswer, rules);
  const normalizedCorrectAnswer = normalizeAnswer(correctAnswer, rules);
  const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer || (rules.acceptUkUs !== false && matchesUkUsSpelling(normalizedUserAnswer, normalizedCorrectAnswer));
  return {
    result: isCorrect ? "correct" : "wrong",
    normalizedUserAnswer,
    normalizedCorrectAnswer,
  };
}
