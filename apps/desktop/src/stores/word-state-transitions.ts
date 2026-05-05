import type { DictionaryEntry, DictationResult, DictationResultStatus, VocabularyWord } from "@dictation/domain";

type WordTargetState = {
  words: VocabularyWord[];
  dictionary: DictionaryEntry[];
};

export function normalizeWordKey(value: string): string {
  return value.trim().toLowerCase();
}

export function findPracticeWordForDictionaryEntry(words: VocabularyWord[], entry: DictionaryEntry): VocabularyWord | undefined {
  const normalized = normalizeWordKey(entry.word);
  return words.find((word) => word.dictionaryEntryId === entry.id || normalizeWordKey(word.word) === normalized);
}

export function resolveWordTarget(state: WordTargetState, wordId: number): VocabularyWord | null {
  const existing = state.words.find((word) => word.id === wordId);
  if (existing) return existing;
  if (wordId < 0) {
    const entry = state.dictionary.find((item) => item.id === Math.abs(wordId));
    if (entry) return createTransientDictionaryWord(entry);
  }
  return null;
}

export function ensureWordInCollection(words: VocabularyWord[], target: VocabularyWord): VocabularyWord[] {
  return words.some((word) => word.id === target.id) ? words : [...words, target];
}

export function createTransientDictionaryWord(entry: DictionaryEntry): VocabularyWord {
  return {
    id: -Math.abs(entry.id),
    libraryId: 0,
    dictionaryEntryId: entry.id,
    wordKey: normalizeWordKey(entry.word),
    transientSource: "dictionary",
    word: entry.word,
    meaning: entry.meaningCn,
    phonetic: entry.usPhonetic ?? entry.ukPhonetic,
    partOfSpeech: entry.partOfSpeech,
    isFavorite: false,
    inWrongBook: false,
    masteryLevel: 0,
    wrongCount: 0,
    dictationCount: 0,
    addedAt: Date.now(),
  };
}

export function wordIdentity(word: Pick<VocabularyWord, "dictionaryEntryId" | "word" | "wordKey">): { dictionaryEntryId?: number; wordKey: string } {
  return {
    dictionaryEntryId: word.dictionaryEntryId,
    wordKey: normalizeWordKey(word.wordKey ?? word.word),
  };
}

export function sameWordIdentity(left: VocabularyWord, right: VocabularyWord): boolean {
  if (left.dictionaryEntryId != null && right.dictionaryEntryId != null && left.dictionaryEntryId === right.dictionaryEntryId) return true;
  return normalizeWordKey(left.wordKey ?? left.word) === normalizeWordKey(right.wordKey ?? right.word);
}

export function sameResultIdentity(result: DictationResult, identity: { dictionaryEntryId?: number; wordKey: string }): boolean {
  if (!identity.wordKey) return false;
  return normalizeWordKey(result.correctAnswer || result.word) === identity.wordKey;
}

export function updateWordsForResultTransition(
  words: VocabularyWord[],
  wordId: number,
  previousResult: DictationResultStatus,
  nextResult: DictationResultStatus,
  markedAt: number,
): { words: VocabularyWord[]; target?: VocabularyWord } {
  const target = words.find((word) => word.id === wordId);
  if (!target) return { words };
  let updatedTarget: VocabularyWord | undefined;
  const updatedWords = words.map((word) => {
    if (!sameWordIdentity(word, target)) return word;
    const updated = updateWordForResultTransition(word, previousResult, nextResult, markedAt);
    if (word.id === target.id) updatedTarget = updated;
    return updated;
  });
  return { words: updatedWords, target: updatedTarget };
}

export function updateWordForManualMark(
  word: VocabularyWord,
  previousResult: DictationResultStatus,
  nextResult: DictationResultStatus,
  markedAt: number,
): VocabularyWord {
  return updateWordForResultTransition(word, previousResult, nextResult, markedAt);
}

function updateWordForResultTransition(
  word: VocabularyWord,
  previousResult: DictationResultStatus,
  nextResult: DictationResultStatus,
  markedAt: number,
): VocabularyWord {
  const previousAnswered = previousResult !== "unmarked";
  const nextAnswered = nextResult !== "unmarked";
  const dictationDelta = previousAnswered === nextAnswered ? 0 : nextAnswered ? 1 : -1;
  const wrongDelta = resultWrongCountScore(nextResult) - resultWrongCountScore(previousResult);
  const masteryDelta = resultMasteryScore(nextResult) - resultMasteryScore(previousResult);
  const masteryLevel = Math.max(0, Math.min(10, word.masteryLevel + masteryDelta));
  const wrongCount = Math.max(0, word.wrongCount + wrongDelta);
  const mastered = masteryLevel >= 10;
  return {
    ...word,
    dictationCount: Math.max(0, word.dictationCount + dictationDelta),
    wrongCount: mastered ? 0 : wrongCount,
    inWrongBook: mastered ? false : nextResult === "wrong" ? true : word.inWrongBook,
    masteryLevel,
    lastDictatedAt: markedAt,
  };
}

function resultMasteryScore(result: DictationResultStatus): number {
  if (result === "correct") return 2;
  if (result === "wrong") return -1;
  return 0;
}

function resultWrongCountScore(result: DictationResultStatus): number {
  return result === "wrong" ? 1 : 0;
}
