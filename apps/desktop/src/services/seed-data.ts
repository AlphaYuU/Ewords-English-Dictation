import type {
  AppSettings,
  DictionaryEntry,
  DictionaryExample,
  DictationResult,
  DictationSession,
  HistoryItem,
  VocabularyLibrary,
  VocabularyUnit,
  VocabularyWord,
} from "@dictation/domain";
import { defaultSettings } from "@dictation/domain";

const now = new Date("2026-04-25T12:00:00").getTime();

const officialBooks = [
  { id: 10, code: "IELTS", name: "IELTS", count: 5040, examples: 3100, color: "#D4916E" },
  { id: 11, code: "TOEFL", name: "TOEFL", count: 6974, examples: 2899, color: "#D4916E" },
  { id: 12, code: "GRE", name: "GRE", count: 7504, examples: 1666, color: "#D4916E" },
  { id: 13, code: "CET4", name: "CET4", count: 3849, examples: 3094, color: "#D4916E" },
  { id: 14, code: "CET6", name: "CET6", count: 5407, examples: 3512, color: "#D4916E" },
  { id: 15, code: "考研", name: "考研英语", count: 4801, examples: 3417, color: "#D4916E" },
  { id: 16, code: "高考", name: "高考英语", count: 3677, examples: 3242, color: "#D4916E" },
  { id: 17, code: "中考", name: "中考英语", count: 1603, examples: 1567, color: "#D4916E" },
] as const;

const sampleWords = [
  [10, "abbreviation", "ә.bri:vi'eiʃәn", "n. 缩写词, 缩写, 缩短, 节略", "n.", "UK is the abbreviation for the United Kingdom.", "UK是英国的缩写。"],
  [10, "ability", "ә'biliti", "n. 能力, 才干", "n.", "She has great ability in teaching English.", "她很擅长英语教学。"],
  [10, "abnormal", "æb'nɒ:mәl", "a. 反常的, 不规则的, 变态的, 畸形的", "a.", "Environmental pollution is causing abnormal weather conditions.", "环境污染正造成异常的天气情况。"],
  [10, "abolish", "ә'bɒliʃ", "vt. 废止, 革除, 消灭", "v.", "We should abolish the death penalty.", "我们应该废除死刑。"],
  [11, "abandon", "ә'bændәn", "vt. 放弃, 抛弃, 遗弃, 使屈从", "v.", "We have to abandon the plan.", "我们必须放弃这个计划。"],
  [11, "abandoned", "ә'bændәnd", "a. 被抛弃的, 无约束的", "a.", "Kenji abandoned his hope of becoming a doctor.", "健二放弃了成为医生的希望。"],
  [12, "abandon", "ә'bændәn", "vt. 放弃, 抛弃, 遗弃, 使屈从", "v.", "I will not abandon you.", "我不会丢下你。"],
  [12, "abase", "ә'beis", "vt. 降低地位, 贬抑, 使谦卑", "v.", "", ""],
  [13, "abandon", "ә'bændәn", "vt. 放弃, 抛弃, 遗弃, 使屈从", "v.", "We have to abandon the plan.", "我们必须放弃这个计划。"],
  [13, "ability", "ә'biliti", "n. 能力, 才干", "n.", "From each according to their ability, to each according to their needs.", "各尽所能、各取所需。"],
  [14, "abandon", "ә'bændәn", "vt. 放弃, 抛弃, 遗弃, 使屈从", "v.", "I will not abandon you.", "我不会丢下你。"],
  [14, "abbreviation", "ә.bri:vi'eiʃәn", "n. 缩写词, 缩写, 缩短, 节略", "n.", "UK is the abbreviation for the United Kingdom.", "UK是英国的缩写。"],
  [15, "abandon", "ә'bændәn", "vt. 放弃, 抛弃, 遗弃, 使屈从", "v.", "We have to abandon the plan.", "我们必须放弃这个计划。"],
  [15, "abdomen", "'æbdәmen", "n. 腹部", "n.", "", ""],
  [16, "a", "ei", "第一个字母 A; 一个; 第一的", "", "", ""],
  [16, "abandon", "ә'bændәn", "vt. 放弃, 抛弃, 遗弃, 使屈从", "v.", "We have to abandon the plan.", "我们必须放弃这个计划。"],
  [17, "a", "ei", "第一个字母 A; 一个; 第一的", "", "", ""],
  [17, "ability", "ә'biliti", "n. 能力, 才干", "n.", "She has great ability in teaching English.", "她很擅长英语教学。"],
] as const;

function fallbackWordCount(libraryId: number): number {
  return sampleWords.filter(([sampleLibraryId]) => sampleLibraryId === libraryId).length;
}

export const seedLibraries: VocabularyLibrary[] = [
  {
    id: 1,
    name: "错题本",
    description: "听写答错或手动加入的单词会出现在这里",
    type: "wrong_book",
    coverColor: "#D4916E",
    coverIcon: "alert",
    wordCount: 0,
    unitCount: 0,
    progress: 0,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 2,
    name: "收藏夹",
    description: "点亮星标收藏的重要单词会出现在这里",
    type: "favorite",
    coverColor: "#D4916E",
    coverIcon: "star",
    wordCount: 0,
    unitCount: 0,
    progress: 0,
    createdAt: now,
    updatedAt: now,
  },
  ...officialBooks.map((book) => ({
    id: book.id,
    name: book.name,
    description: `${fallbackWordCount(book.id).toLocaleString()} 词`,
    type: "official" as const,
    coverColor: book.color,
    coverIcon: "book",
    wordCount: fallbackWordCount(book.id),
    unitCount: 1,
    progress: 0,
    createdAt: now,
    updatedAt: now,
  })),
];

export const seedUnits: VocabularyUnit[] = officialBooks.map((book, index) => ({
  id: 100 + index,
  libraryId: book.id,
  name: "全部",
  sortOrder: 0,
  wordCount: fallbackWordCount(book.id),
}));

export const seedWords: VocabularyWord[] = sampleWords.map(([libraryId, word, phonetic, meaning, partOfSpeech], index) => ({
  id: 1000 + index,
  libraryId,
  dictionaryEntryId: 1000 + index,
  unitIds: [100 + officialBooks.findIndex((book) => book.id === libraryId)],
  word,
  meaning,
  phonetic,
  partOfSpeech,
  isFavorite: false,
  inWrongBook: false,
  masteryLevel: 0,
  wrongCount: 0,
  dictationCount: 0,
  addedAt: now + index,
}));

export const seedDictionary: DictionaryEntry[] = seedWords.map((word) => ({
  id: word.dictionaryEntryId ?? word.id,
  word: word.word,
  ukPhonetic: word.phonetic,
  usPhonetic: word.phonetic,
  partOfSpeech: word.partOfSpeech,
  meaningCn: word.meaning,
  source: "ecdict",
}));

export const seedExamples: DictionaryExample[] = sampleWords
  .map(([, , , , , exampleEn, exampleCn], index) =>
    exampleEn
      ? {
          id: index + 1,
          entryId: 1000 + index,
          exampleEn,
          exampleCn,
          author: "Tatoeba contributor (username pending)",
          authorStatus: "username_pending_sentences_detailed",
          license: "CC BY 2.0 FR",
          sourceUrl: "https://tatoeba.org",
        }
      : null,
  )
  .filter(Boolean) as DictionaryExample[];

export const seedSettings: AppSettings = defaultSettings;
export const seedSessions: DictationSession[] = [];
export const seedResults: DictationResult[] = [];
export const seedHistory: HistoryItem[] = [];
