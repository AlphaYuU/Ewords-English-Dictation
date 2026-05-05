import type { CSSProperties } from "react";

export function estimateDurationLabel(wordCount: number, playCount: number, intervalSec: number): string {
  if (!wordCount) return "约 0 分钟";
  const seconds = wordCount * (playCount * 2.5 + intervalSec);
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `约 ${minutes} 分钟`;
}

export const panelStyle: CSSProperties = {
  padding: 20,
  border: "1px solid var(--border-subtle)",
  borderRadius: 14,
  background: "var(--surface-card)",
};
