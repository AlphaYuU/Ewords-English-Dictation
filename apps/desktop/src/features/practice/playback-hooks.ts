import { useCallback, useEffect, useRef, useState } from "react";
import { ControlledAudioService } from "@dictation/audio";
import type { Accent, DictationResult, PlaybackSettings } from "@dictation/domain";

const audio = new ControlledAudioService();

export function useDictationPlayback({
  current,
  accent,
  settings,
  onAutoAdvance,
}: {
  current?: Pick<DictationResult, "id" | "wordId" | "word" | "result">;
  accent: Accent;
  settings: PlaybackSettings;
  onAutoAdvance?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [scheduledCount, setScheduledCount] = useState(0);
  const runIdRef = useRef(0);
  const scheduledCountRef = useRef(0);
  const autoAdvanceRef = useRef(onAutoAdvance);
  const playingRef = useRef(false);
  const currentId = current?.id;
  const currentWordId = current?.wordId;
  const currentWord = current?.word;

  useEffect(() => {
    autoAdvanceRef.current = onAutoAdvance;
  }, [onAutoAdvance]);

  const waitInterval = useCallback(
    (runId: number) =>
      new Promise<boolean>((resolve) => {
        const timer = window.setTimeout(() => resolve(runIdRef.current === runId), settings.intervalSec * 1000);
        if (runIdRef.current !== runId) {
          window.clearTimeout(timer);
          resolve(false);
        }
      }),
    [settings.intervalSec],
  );

  const playOnce = useCallback(
    async (target: Pick<DictationResult, "id" | "wordId" | "word">, runId?: number): Promise<boolean> => {
      while (playingRef.current) {
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }
      if (runId != null && runIdRef.current !== runId) return false;
      playingRef.current = true;
      setIsPlaying(true);
      try {
        await audio.play({ wordId: target.wordId, word: target.word, accent, speed: settings.speed });
        return true;
      } catch (error) {
        console.warn("Piper playback failed", error);
        return false;
      } finally {
        playingRef.current = false;
        setIsPlaying(false);
      }
    },
    [accent, settings.speed],
  );

  const runTimeline = useCallback(
    async (runId: number, target: Pick<DictationResult, "id" | "wordId" | "word">) => {
      while (runIdRef.current === runId && scheduledCountRef.current < settings.playCount) {
        scheduledCountRef.current += 1;
        setScheduledCount(scheduledCountRef.current);
        const played = await playOnce(target, runId);
        if (!played) return;
        const shouldContinue = await waitInterval(runId);
        if (!shouldContinue) return;
      }
      if (runIdRef.current === runId && settings.autoPlayNext) autoAdvanceRef.current?.();
    },
    [playOnce, settings.autoPlayNext, settings.playCount, waitInterval],
  );

  useEffect(() => {
    if (currentId == null || currentWordId == null || !currentWord) return;
    const target = { id: currentId, wordId: currentWordId, word: currentWord };
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    scheduledCountRef.current = 0;
    const resetTimer = window.setTimeout(() => setScheduledCount(0), 0);
    void runTimeline(runId, target);
    return () => {
      window.clearTimeout(resetTimer);
      runIdRef.current += 1;
      void audio.stop();
      playingRef.current = false;
      setIsPlaying(false);
    };
  }, [currentId, currentWordId, currentWord, runTimeline]);

  const replay = () => {
    if (!current || isPlaying) return;
    if (current.result !== "unmarked") {
      void playOnce(current);
      return;
    }
    if (settings.allowReplay) {
      void playOnce(current);
      return;
    }
    if (scheduledCountRef.current >= settings.playCount) return;
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    scheduledCountRef.current += 1;
    setScheduledCount(scheduledCountRef.current);
    void (async () => {
      const played = await playOnce(current, runId);
      if (!played) return;
      const shouldContinue = await waitInterval(runId);
      if (!shouldContinue) return;
      if (scheduledCountRef.current >= settings.playCount) {
        if (settings.autoPlayNext) autoAdvanceRef.current?.();
        return;
      }
      await runTimeline(runId, current);
    })();
  };

  return {
    isPlaying,
    replay,
    canReplay: Boolean(current && !isPlaying && (current.result !== "unmarked" || settings.allowReplay || scheduledCount < settings.playCount)),
  };
}

export function useDictationAudioPrefetch({
  results,
  sessionIndex,
  accent,
  speed,
}: {
  results: Pick<DictationResult, "wordId" | "word">[];
  sessionIndex: number;
  accent: Accent;
  speed: PlaybackSettings["speed"];
}) {
  const preparedRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    const upcoming = results.slice(sessionIndex + 1, sessionIndex + 5);
    if (!upcoming.length) return undefined;
    void (async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
      for (const result of upcoming) {
        if (cancelled) return;
        const key = `${result.wordId}:${result.word}:${accent}:${speed}`;
        if (preparedRef.current.has(key)) continue;
        preparedRef.current.add(key);
        await audio.prepare({ wordId: result.wordId, word: result.word, accent, speed });
        await new Promise((resolve) => window.setTimeout(resolve, 80));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accent, results, sessionIndex, speed]);
}
