import type { PracticeSetup, SessionWord, VocabularyWord } from "@dictation/domain";

export function orderSessionWords(words: VocabularyWord[], setup: PracticeSetup): SessionWord[] {
  const source = setup.orderMode === "random" ? shuffle(words) : words.slice();
  const selected = setup.orderMode === "sample" ? source.slice(0, setup.sampleCount ?? source.length) : source;
  return selected.map((word, index) => ({
    orderIndex: index,
    wordId: word.id,
    word: word.word,
    meaning: word.meaning,
    phonetic: word.phonetic,
  }));
}

function shuffle<T>(items: T[]): T[] {
  const next = items.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}
