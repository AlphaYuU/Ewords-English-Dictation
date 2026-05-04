import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Chip, EmptyState, Icon, IconButton, LoadingState, NoticeDialog } from "@dictation/ui";
import type { DictionaryEntry, DictionaryExample, VocabularyLibrary, VocabularyWord } from "@dictation/domain";
import { ControlledAudioService } from "@dictation/audio";
import { useDictionaryStore } from "../stores/dictionary-store";
import { queryDesktopDatabase } from "../services/desktop-bridge";

const audio = new ControlledAudioService();

export function WordDetailPage() {
  const { wordId, entryId } = useParams();
  const navigate = useNavigate();
  const numericWordId = wordId == null ? undefined : Number(wordId);
  const numericEntryId = entryId == null ? undefined : Number(entryId);
  const isDictionaryEntryRoute = numericEntryId != null && numericWordId == null;
  const allWords = useDictionaryStore((state) => state.words);
  const libraries = useDictionaryStore((state) => state.libraries);
  const dictionary = useDictionaryStore((state) => state.dictionary);
  const allExamples = useDictionaryStore((state) => state.examples);
  const setup = useDictionaryStore((state) => state.setup);
  const [pendingRemoveFromDictation, setPendingRemoveFromDictation] = useState(false);
  const [remotePayload, setRemotePayload] = useState<{ key: string; entry: DictionaryEntry | null; examples: DictionaryExample[] } | null>(null);
  const routeWord = useMemo(() => (numericWordId == null ? undefined : allWords.find((item) => item.id === numericWordId)), [allWords, numericWordId]);
  const activeKey = numericWordId != null ? `word:${numericWordId}` : numericEntryId != null ? `entry:${numericEntryId}` : "";
  const activeRemotePayload = remotePayload?.key === activeKey ? remotePayload : null;
  const entryMatchedWord = useMemo(() => {
    if (routeWord) return routeWord;
    if (numericEntryId != null) {
      const byEntryId = allWords.find((item) => item.dictionaryEntryId === numericEntryId);
      if (byEntryId) return byEntryId;
    }
    const remoteEntry = activeRemotePayload?.entry;
    if (!remoteEntry) return undefined;
    return allWords.find((item) => item.word.toLowerCase() === remoteEntry.word.toLowerCase());
  }, [activeRemotePayload, allWords, numericEntryId, routeWord]);
  const word = isDictionaryEntryRoute ? undefined : entryMatchedWord;
  const library = useMemo(() => libraries.find((item) => item.id === word?.libraryId), [libraries, word]);
  const localDictionaryEntry = useMemo(
    () =>
      dictionary.find(
        (item) =>
          item.id === word?.dictionaryEntryId ||
          item.id === numericEntryId ||
          (word != null && item.word.toLowerCase() === word.word.toLowerCase()),
      ),
    [dictionary, numericEntryId, word],
  );
  const localExamples = useMemo(() => allExamples.filter((example) => example.entryId === (word?.dictionaryEntryId ?? numericEntryId)), [allExamples, numericEntryId, word]);
  const toggleFavorite = useDictionaryStore((state) => state.toggleFavorite);
  const toggleFavoriteForEntry = useDictionaryStore((state) => state.toggleFavoriteForEntry);
  const toggleWrongBook = useDictionaryStore((state) => state.toggleWrongBook);
  const toggleWrongBookForEntry = useDictionaryStore((state) => state.toggleWrongBookForEntry);
  const setPracticeSource = useDictionaryStore((state) => state.setPracticeSource);
  const queueDictionaryEntryForDictation = useDictionaryStore((state) => state.queueDictionaryEntryForDictation);
  const openDialog = useDictionaryStore((state) => state.openDialog);
  const setPendingAddWordId = useDictionaryStore((state) => state.setPendingAddWordId);
  const setPendingAddDictionaryEntry = useDictionaryStore((state) => state.setPendingAddDictionaryEntry);
  const dictionaryEntry = activeRemotePayload?.entry ?? localDictionaryEntry;
  const detailWord = word ?? (dictionaryEntry ? toDetailWord(dictionaryEntry) : null);
  const actionWord = entryMatchedWord ?? (dictionaryEntry ? toDetailWord(dictionaryEntry) : undefined);
  const examples = useMemo(
    () => dedupeExamples(activeRemotePayload?.examples.length ? activeRemotePayload.examples : localExamples),
    [activeRemotePayload, localExamples],
  );
  const queuedWordIds = setup.source.sourceType === "words" ? setup.source.wordIds : [];
  const dictationWord = dictionaryEntry ? findDictionaryQueueWord(dictionaryEntry, allWords) : entryMatchedWord;
  const isInDictationList = dictationWord ? queuedWordIds.includes(dictationWord.id) : false;
  const toggleDictationList = () => {
    if (isInDictationList) {
      setPendingRemoveFromDictation(true);
      return;
    }
    if (dictationWord) {
      setPracticeSource({ sourceType: "words", wordIds: [...new Set([...queuedWordIds, dictationWord.id])] });
      return;
    }
    if (dictionaryEntry) queueDictionaryEntryForDictation(dictionaryEntry);
  };
  const removeFromDictationList = () => {
    if (!dictationWord || setup.source.sourceType !== "words") {
      setPendingRemoveFromDictation(false);
      return;
    }
    const nextWordIds = setup.source.wordIds.filter((id) => id !== dictationWord.id);
    setPracticeSource(nextWordIds.length ? { sourceType: "words", wordIds: nextWordIds } : { sourceType: "none" });
    setPendingRemoveFromDictation(false);
  };
  useEffect(() => {
    const queryKey = activeKey;
    if (!queryKey) return;
    let cancelled = false;
    void queryDesktopDatabase<{ entry: DictionaryEntry | null; examples: DictionaryExample[] }>({
      resource: "dictionary-entry",
      entryId: word?.dictionaryEntryId ?? numericEntryId,
      word: word?.word,
      limitExamples: 8,
    })
      .then((payload) => {
        if (!cancelled && payload) {
          setRemotePayload({ key: queryKey, entry: payload.entry, examples: payload.examples });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeKey, numericEntryId, word]);
  if (!detailWord && numericEntryId != null && remotePayload?.key !== activeKey) return <LoadingState label="加载词条" />;
  if (!detailWord) return <EmptyState title="未找到单词" description="这个单词可能已经从词库移除。" action={<Button onClick={() => navigate("/library")}>返回书架</Button>} />;
  const siblings = word ? allWords.filter((item) => item.libraryId === word.libraryId) : [];
  const currentIndex = word ? siblings.findIndex((item) => item.id === word.id) : -1;
  const previousWord = currentIndex > 0 ? siblings[currentIndex - 1] : null;
  const nextWord = currentIndex >= 0 && currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null;
  const phonetic = dictionaryEntry?.ukPhonetic ?? dictionaryEntry?.usPhonetic ?? detailWord.phonetic;
  const meanings = splitMeanings(detailWord.meaning, detailWord.partOfSpeech);
  const forms = wordForms(dictionaryEntry);
  const officialTags = officialWordTags(detailWord.word, dictionaryEntry?.id, allWords, libraries);
  const detailScopeLabel = isDictionaryEntryRoute ? "词典" : library?.name ?? "词典";
  return (
    <>
      <div className="word-detail-nav">
        <button type="button" className="back-link" onClick={() => navigate(-1)}>‹ {detailScopeLabel} / {detailWord.word}</button>
        {!isDictionaryEntryRoute ? (
          <div className="page-actions">
            <Button variant="ghost" size="sm" disabled={!previousWord} onClick={() => previousWord && navigate(`/words/${previousWord.id}`)}>‹ 上一词</Button>
            <Button variant="primary" size="sm" disabled={!nextWord} onClick={() => nextWord && navigate(`/words/${nextWord.id}`)}>下一词 ›</Button>
          </div>
        ) : null}
      </div>
      <section className="word-detail-hero" style={{ "--word-hero-color": library?.coverColor ?? "var(--accent-primary)" } as CSSProperties}>
        <div>
          <span className="word-status-chip">{isDictionaryEntryRoute ? "词典词条" : word?.isFavorite ? "已收藏" : "未收藏"}</span>
          <h1>{detailWord.word}</h1>
          <div className="word-pronunciation-row">
            <button type="button" className="pronunciation-button" onClick={() => void audio.play({ wordId: detailWord.id, word: detailWord.word, accent: "uk", speed: 1 }).catch((error) => console.warn("Piper playback failed", error))}>
              <Icon name="play" size={14} /> UK
            </button>
            <button type="button" className="pronunciation-button" onClick={() => void audio.play({ wordId: detailWord.id, word: detailWord.word, accent: "us", speed: 1 }).catch((error) => console.warn("Piper playback failed", error))}>
              <Icon name="play" size={14} /> US
            </button>
            {phonetic ? <span className="word-phonetic">/{phonetic.replace(/^\/|\/$/g, "")}/</span> : null}
          </div>
        </div>
        <div className="word-hero-actions">
          <IconButton
            icon="star"
            size="lg"
            label={actionWord?.isFavorite ? "取消收藏" : "收藏"}
            active={Boolean(actionWord?.isFavorite)}
            disabled={!actionWord}
            onClick={() => {
              if (entryMatchedWord) toggleFavorite(entryMatchedWord.id);
              else if (dictionaryEntry) toggleFavoriteForEntry(dictionaryEntry);
            }}
          />
          <span>{actionWord?.dictationCount ? `已听写 · 第 ${actionWord.dictationCount} 次复习` : "尚未听写"}</span>
          <button
            type="button"
            className="word-detail-action word-detail-action-dark"
            onClick={toggleDictationList}
            disabled={!dictionaryEntry && !dictationWord}
          >
            <Icon name="headphones" size={16} /> {isInDictationList ? "已加入听写列表" : "加入听写列表"}
          </button>
          <button
            type="button"
            className="word-detail-action word-detail-action-light"
            onClick={() => {
              if (entryMatchedWord && entryMatchedWord.libraryId !== 0) setPendingAddWordId(entryMatchedWord.id);
              else if (dictionaryEntry) setPendingAddDictionaryEntry(dictionaryEntry);
              openDialog("add-word-select-library");
            }}
          >
            <Icon name="plus" size={16} /> 加入词库
          </button>
        </div>
      </section>
      <div className="word-detail-grid">
        <main className="word-detail-main">
          <section className="word-detail-card word-meaning-card">
            <h2>释义</h2>
            <div className="word-meaning-list">
              {meanings.map((meaning, index) => (
                <p key={`${meaning.text}-${index}`}>
                  {meaning.partOfSpeech ? <span className="chip is-selected">{meaning.partOfSpeech}</span> : null}
                  <span>{meaning.text}</span>
                </p>
              ))}
            </div>
          </section>
          <section className="word-detail-card">
            <h2>例句</h2>
            {examples.length ? examples.map((example) => (
              <div className="word-example-row" key={example.id}>
                <p>{example.exampleEn}</p>
                <span>{example.exampleCn}</span>
              </div>
            )) : <p className="page-subtitle">暂无例句。</p>}
          </section>
          <section className="word-detail-card">
            <h2>词形变化</h2>
            {forms.length ? (
              <div className="word-form-grid">
                {forms.map((form) => (
                  <div key={form.label}>
                    <span>{form.label}</span>
                    <strong>{form.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="page-subtitle">暂无词形变化。</p>
            )}
          </section>
        </main>
        <aside className="word-detail-aside">
          <section className="word-detail-card">
            <h2>标签</h2>
            {officialTags.length ? (
              <div className="chip-row">
                {officialTags.map((tag) => <Chip key={tag}>{tag}</Chip>)}
              </div>
            ) : (
              <p className="page-subtitle">暂无官方词库标签。</p>
            )}
          </section>
          <section className="word-detail-card">
            <h2>学习数据</h2>
            <p>听写次数 <strong>{actionWord?.dictationCount ?? 0}</strong> 次</p>
            <p>错词次数 <strong>{actionWord?.wrongCount ?? 0}</strong> 次</p>
          </section>
          <div className="word-aside-actions">
            <Button
              variant="danger"
              size="lg"
              iconStart={<Icon name="trash" />}
              disabled={!actionWord}
              onClick={() => {
                if (entryMatchedWord) toggleWrongBook(entryMatchedWord.id);
                else if (dictionaryEntry) toggleWrongBookForEntry(dictionaryEntry);
              }}
            >
              {actionWord?.inWrongBook ? "移出错题本" : "加入错题本"}
            </Button>
          </div>
        </aside>
      </div>
      <NoticeDialog
        open={pendingRemoveFromDictation}
        title="移出听写列表"
        description={`确认将「${detailWord.word}」从听写列表中移出？`}
        danger
        confirmText="移出"
        onConfirm={removeFromDictationList}
        onClose={() => setPendingRemoveFromDictation(false)}
      />
    </>
  );
}

export const WordDetailFavoritePage = WordDetailPage;
export const WordDetailWrongPage = WordDetailPage;
export const DictionaryEntryDetailPage = WordDetailPage;

function toDetailWord(entry: DictionaryEntry): VocabularyWord {
  return {
    id: -entry.id,
    libraryId: 0,
    dictionaryEntryId: entry.id,
    wordKey: normalizeWordKey(entry.word),
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

function findDictionaryQueueWord(entry: DictionaryEntry, words: VocabularyWord[]): VocabularyWord | undefined {
  const normalized = entry.word.trim().toLowerCase();
  return words.find((word) => word.dictionaryEntryId === entry.id || word.word.trim().toLowerCase() === normalized);
}

function normalizeWordKey(value: string): string {
  return value.trim().toLowerCase();
}

function splitMeanings(meaning: string, fallbackPartOfSpeech?: string): { partOfSpeech?: string; text: string }[] {
  const parts = meaning
    .split(/\n|；|;/)
    .map((item) => item.trim())
    .filter(Boolean);
  const rows = parts.length ? parts : [meaning];
  return rows.map((text) => {
    const match = text.match(/^([a-z.]+)\s+(.+)$/i);
    if (match) return { partOfSpeech: match[1], text: match[2] };
    return { partOfSpeech: fallbackPartOfSpeech, text };
  });
}

function wordForms(entry: DictionaryEntry | undefined): { label: string; value: string }[] {
  if (!entry?.wordForms) return [];
  const labels: Record<string, string> = {
    plural: "复数",
    thirdPerson: "三单",
    pastTense: "过去式",
    presentParticiple: "现在分词",
    pastParticiple: "过去分词",
    comparative: "比较级",
    superlative: "最高级",
  };
  return Object.entries(entry.wordForms)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({ label: labels[key] ?? key, value }));
}

function officialWordTags(word: string, entryId: number | undefined, words: VocabularyWord[], libraries: VocabularyLibrary[]): string[] {
  const normalizedWord = word.trim().toLowerCase();
  const officialLibrariesById = new Map(libraries.filter((library) => library.type === "official").map((library) => [library.id, officialTagLabel(library.name)]));
  const tags = new Set<string>();
  for (const candidate of words) {
    const sameEntry = entryId != null && candidate.dictionaryEntryId === entryId;
    const sameWord = candidate.word.trim().toLowerCase() === normalizedWord;
    if (!sameEntry && !sameWord) continue;
    const tag = officialLibrariesById.get(candidate.libraryId);
    if (tag) tags.add(tag);
  }
  const order = ["CET4", "CET6", "GRE", "IELTS", "TOEFL", "中考", "高考", "考研"];
  return order.filter((tag) => tags.has(tag));
}

function officialTagLabel(name: string): string | null {
  const compact = name.toLowerCase().replace(/[\s_-]/g, "");
  if (compact.includes("cet4") || name.includes("四级")) return "CET4";
  if (compact.includes("cet6") || name.includes("六级")) return "CET6";
  if (compact.includes("gre")) return "GRE";
  if (compact.includes("ielts") || name.includes("雅思")) return "IELTS";
  if (compact.includes("toefl") || name.includes("托福")) return "TOEFL";
  if (name.includes("中考")) return "中考";
  if (name.includes("高考")) return "高考";
  if (name.includes("考研")) return "考研";
  return null;
}

function dedupeExamples(examples: DictionaryExample[]): DictionaryExample[] {
  const seen = new Set<string>();
  const unique: DictionaryExample[] = [];
  for (const example of examples) {
    const key = `${example.exampleEn.trim().toLowerCase()}|${example.exampleCn?.trim() ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(example);
  }
  return unique.slice(0, 8);
}
