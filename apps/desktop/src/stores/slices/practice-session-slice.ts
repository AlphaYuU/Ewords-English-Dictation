import { summarizeResults } from "@dictation/domain";
import type { DictationResult, HistoryItem } from "@dictation/domain";
import { gradeAnswer } from "@dictation/dictation-engine";
import type { AppState, GetAppState, SetAppState } from "../store-types";
import {
  allSessionWordIds,
  completedSessionWordIds,
  gradingRulesForSession,
  materializeSampleForSetup,
  resolveSourceName,
  sessionDurationSec,
  sessionSettingsFromSetup,
  setSessionIndexState,
  type ResultTransition,
} from "../store-helpers";
import { persistPracticeQueue, persistSessionSnapshot } from "../store-persistence";
import { persistPracticeSetupSettings } from "../practice-setup-persistence";
import { resolveSetupWords, shuffleWords } from "../practice-word-resolver";
import { updateWordForManualMark, updateWordsForResultTransition } from "../word-state-transitions";

export function createPracticeSessionSlice(set: SetAppState, get: GetAppState): Pick<
  AppState,
  | "createSession"
  | "revealCurrentHint"
  | "submitCurrentAnswer"
  | "skipCurrentWord"
  | "finishTypingSession"
  | "markResult"
  | "markAllResults"
  | "previousWord"
  | "nextWord"
  | "pauseSession"
  | "resumeSession"
  | "completeSession"
  | "abandonSession"
> {
  return {
    createSession: () => {
      const state = get();
      const sourceWords = resolveSetupWords({ ...state.setup, orderMode: "sequence" }, state.words, state.results);
      if (!sourceWords.length || state.setup.source.sourceType === "none") return null;
      const materialized = materializeSampleForSetup(state.setup, state.words, state.results);
      const setupForSession = materialized.setup;
      const orderedWords =
        setupForSession.orderMode === "sample" ? materialized.selectedWords : setupForSession.orderMode === "random" ? shuffleWords(sourceWords) : sourceWords;
      const resultSessionIds = state.results.map((result) => Math.floor(result.id / 100));
      const id = Math.max(...state.sessions.map((session) => session.id), ...resultSessionIds, 5000) + 1;
      const sourceName = resolveSourceName(setupForSession, state.libraries, state.words);
      const session = {
        id,
        source: setupForSession.source,
        sourceName,
        mode: setupForSession.mode,
        accent: setupForSession.accent,
        status: "active" as const,
        wordCount: orderedWords.length,
        currentIndex: 0,
        settings: sessionSettingsFromSetup(setupForSession),
        durationSec: 0,
        createdAt: Date.now(),
      };
      const results: DictationResult[] = orderedWords.map((word, index) => ({
        id: id * 100 + index,
        sessionId: id,
        wordId: word.id,
        orderIndex: index,
        word: word.word,
        meaning: word.meaning,
        correctAnswer: word.word,
        result: "unmarked",
        hintUsed: false,
        isFavorited: word.isFavorite,
        isAddedToWrongBook: Boolean(word.inWrongBook),
      }));
      const clearedSetup = { ...setupForSession, source: { sourceType: "none" } as const, sampleWordIds: undefined };
      set({ sessions: [...state.sessions, session], results: [...state.results, ...results], setup: clearedSetup, sessionIndex: 0, answerInput: "", sessionFeedback: "idle" });
      persistPracticeSetupSettings(clearedSetup);
      persistSessionSnapshot(set, get, id, []);
      persistPracticeQueue(set, get, clearedSetup.source, get().words);
      return id;
    },
    revealCurrentHint: (sessionId) => {
      const state = get();
      const current = state.results.filter((row) => row.sessionId === sessionId).sort((a, b) => a.orderIndex - b.orderIndex)[state.sessionIndex];
      if (!current) return;
      set({
        results: state.results.map((row) => (row.id === current.id ? { ...row, hintUsed: true } : row)),
      });
      persistSessionSnapshot(set, get, sessionId, []);
    },
    submitCurrentAnswer: (sessionId, answerOverride, options) => {
      const state = get();
      const sessionResults = state.results.filter((row) => row.sessionId === sessionId).sort((a, b) => a.orderIndex - b.orderIndex);
      const current = sessionResults[state.sessionIndex];
      if (!current) return null;
      const answer = answerOverride ?? state.answerInput;
      if (!answer.trim() && !options?.allowEmpty) return null;
      const grade = options?.forceWrong || !answer.trim() ? { result: "wrong" as const } : gradeAnswer(answer, current.correctAnswer, gradingRulesForSession(state, sessionId));
      const dictatedAt = Date.now();
      const transition = updateWordsForResultTransition(state.words, current.wordId, current.result, grade.result, dictatedAt);
      const updatedWord = transition.target;
      set({
        results: state.results.map((row) =>
          row.id === current.id
            ? {
                ...row,
                userAnswer: answer,
                result: grade.result,
                answerRevealed: options?.forceWrong ? true : row.answerRevealed,
                isAddedToWrongBook: updatedWord?.inWrongBook ?? (grade.result === "wrong" || row.isAddedToWrongBook),
              }
            : row,
        ),
        words: transition.words,
        sessionFeedback: grade.result,
      });
      persistSessionSnapshot(set, get, sessionId, [current.wordId]);
      return grade.result;
    },
    skipCurrentWord: (sessionId) => {
      const state = get();
      const current = state.results.filter((row) => row.sessionId === sessionId).sort((a, b) => a.orderIndex - b.orderIndex)[state.sessionIndex];
      if (!current) return;
      const dictatedAt = Date.now();
      const transition = updateWordsForResultTransition(state.words, current.wordId, current.result, "wrong", dictatedAt);
      const updatedWord = transition.target;
      set({
        results: state.results.map((row) => (row.id === current.id ? { ...row, result: "wrong", isAddedToWrongBook: updatedWord?.inWrongBook ?? true } : row)),
        words: transition.words,
        sessionFeedback: "wrong",
      });
      persistSessionSnapshot(set, get, sessionId, [current.wordId]);
    },
    finishTypingSession: (sessionId, answerOverride) => {
      set((state) => {
        const session = state.sessions.find((item) => item.id === sessionId);
        const completedAt = Date.now();
        const sessionResults = state.results.filter((row) => row.sessionId === sessionId).sort((a, b) => a.orderIndex - b.orderIndex);
        const current = sessionResults[state.sessionIndex];
        const transitions: ResultTransition[] = [];
        const finalizedResults = state.results.map((row) => {
          if (row.sessionId !== sessionId) return row;
          let nextResult = row.result;
          let nextUserAnswer = row.userAnswer;
          if (row.id === current?.id) {
            const answer = answerOverride ?? state.answerInput;
            nextUserAnswer = answer;
            nextResult = row.answerRevealed ? "wrong" : answer.trim() ? gradeAnswer(answer, row.correctAnswer, gradingRulesForSession(state, sessionId)).result : "wrong";
          } else if (row.result !== "correct" && row.result !== "wrong") {
            nextResult = "wrong";
          }
          if (nextResult !== row.result) transitions.push({ wordId: row.wordId, previous: row.result, next: nextResult });
          return { ...row, userAnswer: nextUserAnswer, result: nextResult, isAddedToWrongBook: nextResult === "wrong" || row.isAddedToWrongBook };
        });
        let finalizedWords = state.words;
        for (const transition of transitions) {
          finalizedWords = updateWordsForResultTransition(finalizedWords, transition.wordId, transition.previous, transition.next, completedAt).words;
        }
        const wrongBookByWordId = new Map(finalizedWords.map((word) => [word.id, Boolean(word.inWrongBook)]));
        const resultRows = finalizedResults.map((row) =>
          row.sessionId === sessionId ? { ...row, isAddedToWrongBook: wrongBookByWordId.get(row.wordId) ?? row.isAddedToWrongBook } : row,
        );
        const durationSec = sessionDurationSec(session, completedAt);
        const summary = summarizeResults(resultRows.filter((row) => row.sessionId === sessionId), durationSec);
        const historyItem: HistoryItem = {
          sessionId,
          sourceName: session?.sourceName ?? "临时听写",
          sourceType: session?.source.sourceType ?? "words",
          mode: session?.mode ?? "typing",
          accent: session?.accent ?? "us",
          endedAt: completedAt,
          ...summary,
        };
        return {
          results: resultRows,
          words: finalizedWords,
          sessions: state.sessions.map((item) =>
            item.id === sessionId ? { ...item, status: "completed", currentIndex: Math.max(0, sessionResults.length - 1), durationSec, completedAt, pausedAt: undefined } : item,
          ),
          history: [historyItem, ...state.history.filter((item) => item.sessionId !== sessionId)],
          answerInput: "",
          sessionFeedback: "idle",
        };
      });
      persistSessionSnapshot(set, get, sessionId, completedSessionWordIds(get(), sessionId));
    },
    markResult: (sessionId, resultId, result) => {
      set((state) => {
        const target = state.results.find((row) => row.id === resultId);
        const markedAt = Date.now();
        const targetWord = target ? state.words.find((word) => word.id === target.wordId) : undefined;
        const transition = target ? updateWordsForResultTransition(state.words, target.wordId, target.result, result, markedAt) : { words: state.words };
        const nextTargetWord = transition.target ?? (target && targetWord ? updateWordForManualMark(targetWord, target.result, result, markedAt) : undefined);
        return {
          results: state.results.map((row) =>
            row.id === resultId ? { ...row, result, isAddedToWrongBook: nextTargetWord?.inWrongBook ?? (result === "wrong" || row.isAddedToWrongBook) } : row,
          ),
          words: transition.words,
        };
      });
      persistSessionSnapshot(set, get, sessionId, [get().results.find((row) => row.id === resultId)?.wordId].filter((id): id is number => id != null));
    },
    markAllResults: (sessionId, result) => {
      set((state) => {
        const sessionRowsByWordId = new Map(state.results.filter((row) => row.sessionId === sessionId).map((row) => [row.wordId, row]));
        const markedAt = Date.now();
        let nextWords = state.words;
        for (const row of sessionRowsByWordId.values()) {
          nextWords = updateWordsForResultTransition(nextWords, row.wordId, row.result, result, markedAt).words;
        }
        const wrongBookByWordId = new Map(nextWords.map((word) => [word.id, Boolean(word.inWrongBook)]));
        return {
          results: state.results.map((row) =>
            row.sessionId === sessionId ? { ...row, result, isAddedToWrongBook: wrongBookByWordId.get(row.wordId) ?? (result === "wrong" || row.isAddedToWrongBook) } : row,
          ),
          words: nextWords,
        };
      });
      persistSessionSnapshot(set, get, sessionId, allSessionWordIds(get(), sessionId));
    },
    previousWord: (sessionId) => {
      const state = get();
      if (state.sessionIndex <= 0) return;
      set(setSessionIndexState(state, sessionId, state.sessionIndex - 1));
      if (sessionId != null) persistSessionSnapshot(set, get, sessionId, []);
    },
    nextWord: (sessionId) => {
      const state = get();
      const count = state.results.filter((row) => row.sessionId === sessionId).length;
      if (state.sessionIndex >= count - 1) {
        const session = state.sessions.find((item) => item.id === sessionId);
        if (session?.mode !== "paper") get().completeSession(sessionId);
        return true;
      }
      set(setSessionIndexState(state, sessionId, state.sessionIndex + 1));
      persistSessionSnapshot(set, get, sessionId, []);
      return false;
    },
    pauseSession: (sessionId) => {
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? { ...session, status: "paused", currentIndex: state.sessionIndex, pausedAt: session.pausedAt ?? Date.now() } : session,
        ),
      }));
      persistSessionSnapshot(set, get, sessionId, []);
    },
    resumeSession: (sessionId) => {
      const resumedAt = Date.now();
      set((state) => ({
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                status: "active",
                currentIndex: state.sessionIndex,
                pausedDurationSec: (session.pausedDurationSec ?? 0) + (session.pausedAt ? Math.max(0, Math.round((resumedAt - session.pausedAt) / 1000)) : 0),
                pausedAt: undefined,
              }
            : session,
        ),
      }));
      persistSessionSnapshot(set, get, sessionId, []);
    },
    completeSession: (sessionId) => {
      completeSession(set, get, sessionId);
    },
    abandonSession: (sessionId) => {
      set((state) => ({
        sessions: state.sessions.map((session) => (session.id === sessionId ? { ...session, status: "abandoned", completedAt: Date.now() } : session)),
        history: state.history.filter((item) => item.sessionId !== sessionId),
      }));
      persistSessionSnapshot(set, get, sessionId, []);
    },
  };
}

function completeSession(set: SetAppState, get: GetAppState, sessionId: number): void {
  set((state) => {
    const session = state.sessions.find((item) => item.id === sessionId);
    const completedAt = Date.now();
    const transitions: ResultTransition[] = [];
    const provisionalResults = state.results.map((row) => {
      if (row.sessionId !== sessionId) return row;
      if (row.result === "correct" || row.result === "wrong") return row;
      transitions.push({ wordId: row.wordId, previous: row.result, next: "wrong" });
      return { ...row, result: "wrong" as const, isAddedToWrongBook: true };
    });
    let finalizedWords = state.words;
    for (const transition of transitions) {
      finalizedWords = updateWordsForResultTransition(finalizedWords, transition.wordId, transition.previous, transition.next, completedAt).words;
    }
    const wrongBookByWordId = new Map(finalizedWords.map((word) => [word.id, Boolean(word.inWrongBook)]));
    const finalizedResults = provisionalResults.map((row) =>
      row.sessionId === sessionId ? { ...row, isAddedToWrongBook: wrongBookByWordId.get(row.wordId) ?? row.isAddedToWrongBook } : row,
    );
    const sessionResults = finalizedResults.filter((row) => row.sessionId === sessionId);
    const durationSec = sessionDurationSec(session, completedAt);
    const summary = summarizeResults(sessionResults, durationSec);
    const historyItem: HistoryItem = {
      sessionId,
      sourceName: session?.sourceName ?? "临时听写",
      sourceType: session?.source.sourceType ?? "words",
      mode: session?.mode ?? "typing",
      accent: session?.accent ?? "us",
      endedAt: completedAt,
      ...summary,
    };
    return {
      results: finalizedResults,
      words: finalizedWords,
      sessions: state.sessions.map((item) =>
        item.id === sessionId ? { ...item, status: "completed", currentIndex: Math.max(0, sessionResults.length - 1), durationSec, completedAt, pausedAt: undefined } : item,
      ),
      history: [historyItem, ...state.history.filter((item) => item.sessionId !== sessionId)],
    };
  });
  persistSessionSnapshot(set, get, sessionId, completedSessionWordIds(get(), sessionId));
}
