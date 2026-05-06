import type {
  DictationResult,
  DictationResultStatus,
  DictationSession,
  GradingRules,
  PracticeSessionSettings,
  PracticeSetup,
  VocabularyLibrary,
  VocabularyWord,
} from "@dictation/domain";
import type { AppState } from "./store-types";
import { resolveSetupWords, shuffleWords } from "./practice-word-resolver";

export function sourceWordCountForSetup(setup: PracticeSetup, words: VocabularyWord[], results: DictationResult[]): number {
  return resolveSetupWords({ ...setup, orderMode: "sequence" }, words, results).length;
}

export function clampPracticeSampleCount(setup: PracticeSetup, words: VocabularyWord[], results: DictationResult[], sampleCount: number): number {
  const max = sourceWordCountForSetup(setup, words, results);
  const upper = max > 0 ? max : 9999;
  return Math.max(1, Math.min(upper, Math.round(sampleCount)));
}

export function sessionSettingsFromSetup(setup: PracticeSetup): PracticeSessionSettings {
  return {
    mode: setup.mode,
    accent: setup.accent,
    orderMode: setup.orderMode,
    sampleCount: setup.sampleCount,
    sampleWordIds: setup.sampleWordIds,
    showChineseHint: setup.showChineseHint,
    playbackSettings: setup.playbackSettings,
    gradingRules: setup.gradingRules,
  };
}

export function gradingRulesForSession(state: AppState, sessionId: number): GradingRules {
  return state.sessions.find((session) => session.id === sessionId)?.settings?.gradingRules ?? state.setup.gradingRules;
}

export function setSessionIndexState(state: AppState, sessionId: number | undefined, nextIndex: number): Partial<AppState> {
  if (sessionId == null) return { sessionIndex: nextIndex, answerInput: "", sessionFeedback: "idle" };
  return {
    sessionIndex: nextIndex,
    answerInput: "",
    sessionFeedback: "idle",
    sessions: state.sessions.map((session) => (session.id === sessionId ? { ...session, currentIndex: nextIndex } : session)),
  };
}

export function completedSessionWordIds(state: AppState, sessionId: number): number[] {
  return state.results
    .filter((row) => row.sessionId === sessionId && (row.result === "correct" || row.result === "wrong"))
    .map((row) => row.wordId);
}

export function allSessionWordIds(state: AppState, sessionId: number): number[] {
  return state.results.filter((row) => row.sessionId === sessionId).map((row) => row.wordId);
}

export function clearPracticeSample(setup: PracticeSetup): PracticeSetup {
  return setup.sampleWordIds?.length ? { ...setup, sampleWordIds: undefined } : setup;
}

export function materializeSampleForSetup(setup: PracticeSetup, words: VocabularyWord[], results: DictationResult[]): { setup: PracticeSetup; selectedWords: VocabularyWord[] } {
  if (setup.orderMode !== "sample") {
    return { setup: clearPracticeSample(setup), selectedWords: resolveSetupWords({ ...setup, sampleWordIds: undefined }, words, results) };
  }
  const sourceWords = resolveSetupWords({ ...setup, orderMode: "sequence", sampleWordIds: undefined }, words, results);
  if (!sourceWords.length) return { setup: { ...setup, sampleWordIds: [] }, selectedWords: [] };
  const byId = new Map(sourceWords.map((word) => [word.id, word]));
  const cachedWords = setup.sampleWordIds?.map((wordId) => byId.get(wordId)).filter((word): word is VocabularyWord => Boolean(word)) ?? [];
  const sampleCount = clampPracticeSampleCount(setup, words, results, setup.sampleCount ?? sourceWords.length);
  if (cachedWords.length === sampleCount) return { setup, selectedWords: cachedWords };
  const selectedWords = shuffleWords(sourceWords).slice(0, sampleCount);
  return { setup: { ...setup, sampleWordIds: selectedWords.map((word) => word.id) }, selectedWords };
}

export function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags?.length) return [];
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 8);
}

export function sessionDurationSec(session: DictationSession | undefined, endedAt: number): number {
  if (!session) return 0;
  const activePauseSec = session.pausedAt ? Math.max(0, Math.round((endedAt - session.pausedAt) / 1000)) : 0;
  return Math.max(0, Math.round((endedAt - session.createdAt) / 1000) - (session.pausedDurationSec ?? 0) - activePauseSec);
}

export function resolveSourceName(setup: PracticeSetup, libraries: VocabularyLibrary[], words: VocabularyWord[]): string {
  const source = setup.source;
  if (source.sourceType === "library") return libraries.find((library) => library.id === source.sourceId)?.name ?? "词库";
  if (source.sourceType === "unit") return "Unit";
  if (source.sourceType === "wrong_book") return "错题本";
  if (source.sourceType === "favorite") return "收藏夹";
  if (source.sourceType === "history_session") return "历史记录";
  if (source.sourceType === "words") {
    const selected = resolveSetupWords(setup, words);
    const counts = new Map<number, number>();
    for (const word of selected) counts.set(word.libraryId, (counts.get(word.libraryId) ?? 0) + 1);
    const groups = [...counts.entries()].map(([libraryId, count]) => `${libraryId === 0 ? "词典" : libraries.find((library) => library.id === libraryId)?.name ?? "词库"} · ${count}词`);
    if (!groups.length) return "选中单词";
    if (groups.length <= 2) return groups.join(" + ");
    return `${groups[0]} 等 ${groups.length} 个来源`;
  }
  return "未选择来源";
}

export type ResultTransition = {
  wordId: number;
  previous: DictationResultStatus;
  next: DictationResultStatus;
};
