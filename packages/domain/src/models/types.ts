export type ID = number;

export type LibraryType = "official" | "custom" | "wrong_book" | "favorite";
export type PracticeSourceType = "none" | "library" | "unit" | "words" | "wrong_book" | "favorite" | "history_session";
export type DictationMode = "typing" | "paper";
export type Accent = "uk" | "us";
export type OrderMode = "sequence" | "random" | "sample";
export type MasteryLevel = number;
export type DictationResultStatus = "correct" | "wrong" | "skipped" | "unmarked";
export type DictationSessionStatus = "draft" | "active" | "paused" | "completed" | "abandoned";

export type DictionaryEntry = {
  id: ID;
  word: string;
  ukPhonetic?: string;
  usPhonetic?: string;
  ukAudioUrl?: string;
  usAudioUrl?: string;
  partOfSpeech?: string;
  meaningCn: string;
  wordForms?: Record<string, string>;
  source: "ecdict" | "custom";
};

export type DictionaryExample = {
  id: ID;
  entryId: ID;
  exampleEn: string;
  exampleCn?: string;
  author?: string;
  authorStatus?: string;
  license: string;
  sourceUrl?: string;
};

export type VocabularyLibrary = {
  id: ID;
  name: string;
  description?: string;
  tags?: string[];
  type: LibraryType;
  coverColor?: string;
  coverIcon?: string;
  wordCount: number;
  unitCount: number;
  progress: number;
  accuracy?: number;
  createdAt: number;
  updatedAt: number;
};

export type VocabularyUnit = {
  id: ID;
  libraryId: ID;
  name: string;
  sortOrder: number;
  wordCount: number;
};

export type VocabularyWord = {
  id: ID;
  libraryId: ID;
  dictionaryEntryId?: ID;
  wordKey?: string;
  transientSource?: "dictionary";
  unitIds?: ID[];
  word: string;
  meaning: string;
  phonetic?: string;
  partOfSpeech?: string;
  isFavorite: boolean;
  inWrongBook?: boolean;
  masteryLevel: MasteryLevel;
  wrongCount: number;
  dictationCount: number;
  lastDictatedAt?: number;
  addedAt: number;
};

export type PracticeSource =
  | { sourceType: "none" }
  | { sourceType: "library"; sourceId: ID }
  | { sourceType: "unit"; sourceId: ID }
  | { sourceType: "wrong_book" }
  | { sourceType: "favorite" }
  | { sourceType: "history_session"; sourceId: ID; filter?: "all" | "wrong" }
  | { sourceType: "words"; wordIds: ID[]; sourceGroups?: PracticeSourceGroup[] };

export type PracticeSourceGroup = {
  key: string;
  label: string;
  wordIds: ID[];
};

export type PlaybackSettings = {
  playCount: 1 | 2 | 3;
  intervalSec: 5 | 10 | 15;
  speed: 0.5 | 1 | 1.5;
  allowReplay: boolean;
  autoPlayNext: boolean;
};

export type GradingRules = {
  ignoreCase: boolean;
  trimWhitespace: boolean;
  acceptUkUs: boolean;
  collapseSpaces: boolean;
  strictHyphen: boolean;
  strictApostrophe: boolean;
  skippedAsWrong: boolean;
};

export type PracticeSetup = {
  source: PracticeSource;
  mode: DictationMode;
  accent: Accent;
  orderMode: OrderMode;
  sampleCount?: number;
  sampleWordIds?: ID[];
  showChineseHint: boolean;
  playbackSettings: PlaybackSettings;
  gradingRules: GradingRules;
};

export type PracticeSessionSettings = Omit<PracticeSetup, "source">;

export type SessionWord = {
  orderIndex: number;
  wordId: ID;
  word: string;
  meaning: string;
  phonetic?: string;
  ukAudioUrl?: string;
  usAudioUrl?: string;
};

export type DictationSession = {
  id: ID;
  source: PracticeSource;
  sourceName: string;
  mode: DictationMode;
  accent: Accent;
  status: DictationSessionStatus;
  wordCount: number;
  currentIndex?: number;
  settings?: PracticeSessionSettings;
  durationSec: number;
  pausedDurationSec?: number;
  pausedAt?: number;
  createdAt: number;
  completedAt?: number;
};

export type DictationResult = {
  id: ID;
  sessionId: ID;
  wordId: ID;
  orderIndex: number;
  word: string;
  meaning: string;
  userAnswer?: string;
  correctAnswer: string;
  result: DictationResultStatus;
  hintUsed: boolean;
  answerRevealed?: boolean;
  isFavorited: boolean;
  isAddedToWrongBook: boolean;
};

export type DictationSummary = {
  total: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  unmarkedCount: number;
  accuracy: number;
  durationSec: number;
};

export type HistoryItem = DictationSummary & {
  sessionId: ID;
  sourceName: string;
  sourceType: PracticeSourceType;
  mode: DictationMode;
  accent: Accent;
  endedAt: number;
};

export type SearchHistoryItem = {
  id: ID;
  query: string;
  entryId?: ID;
  word?: string;
  meaningCn?: string;
  searchedAt: number;
};

export type AppSettings = {
  defaultAccent: Accent;
  defaultDictationMode: DictationMode;
  autoPlay: boolean;
  theme: "light" | "dark" | "system";
  fontSize: "normal" | "large" | "extraLarge";
  cacheLimitMb: number;
  colorWeakMode: boolean;
};

export const defaultPlaybackSettings: PlaybackSettings = {
  playCount: 2,
  intervalSec: 5,
  speed: 1,
  allowReplay: true,
  autoPlayNext: true,
};

export const defaultGradingRules: GradingRules = {
  ignoreCase: true,
  trimWhitespace: true,
  acceptUkUs: true,
  collapseSpaces: true,
  strictHyphen: false,
  strictApostrophe: false,
  skippedAsWrong: false,
};

export const defaultSettings: AppSettings = {
  defaultAccent: "us",
  defaultDictationMode: "typing",
  autoPlay: true,
  theme: "light",
  fontSize: "normal",
  cacheLimitMb: 512,
  colorWeakMode: false,
};
