import type { GradingRules } from "@dictation/domain";

const punctuationRegex = /[.,!?;:"“”‘’()[\]{}，。！？；：、]/g;

export function normalizeAnswer(value: string, rules: Partial<GradingRules> = {}): string {
  let output = value.normalize("NFKC");
  if (rules.trimWhitespace !== false) output = output.trim();
  if (rules.collapseSpaces !== false) output = output.replace(/\s+/g, " ");
  if (rules.ignoreCase !== false) output = output.toLowerCase();
  output = output.replace(punctuationRegex, "");
  if (!rules.strictHyphen) output = output.replace(/[-‐‑‒–—]/g, "");
  if (!rules.strictApostrophe) output = output.replace(/['’]/g, "");
  return output;
}
