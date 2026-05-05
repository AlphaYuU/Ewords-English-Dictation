import type { PointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Accent, DictationResult, PlaybackSettings, PracticeSource, PracticeSourceGroup, VocabularyLibrary, VocabularyWord } from "@dictation/domain";
import {
  Button,
  Chip,
  DictationControlBar,
  DictationPlayer,
  DictationResultSummary,
  EmptyState,
  Icon,
  IconButton,
  NoticeDialog,
  ProgressBar,
  SegmentedControl,
  SessionTopActions,
  useModalA11y,
} from "@dictation/ui";
import { ControlledAudioService } from "@dictation/audio";
import { summarizeResults } from "@dictation/domain";
import { exportHistoryCsv } from "@dictation/import-export";
import { saveTextFile } from "../services/desktop-bridge";
import { usePracticeStore } from "../stores/practice-store";
import { resolveSetupWords } from "../stores/app-store";
import { ChoiceCardGroup, SettingSwitch, SummaryTile } from "../features/practice/setup-components";
import { estimateDurationLabel, panelStyle } from "../features/practice/setup-utils";
import { DictationResultTable, PaperGradingTable } from "../features/practice/result-components";
import { filterDictationResults, resultSummaryMeta, type ResultFilter } from "../features/practice/result-utils";

const audio = new ControlledAudioService();

type SourceChipItem = {
  key: string;
  label: string;
  wordIds: number[];
};

type SourceChipDragState = {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
};

export function PracticeSetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingSourceRemoval, setPendingSourceRemoval] = useState<SourceChipItem | null>(null);
  const [sampleCountDraft, setSampleCountDraft] = useState<string | null>(null);
  const sourceChipViewportRef = useRef<HTMLDivElement>(null);
  const sourceChipDragRef = useRef<SourceChipDragState | null>(null);
  const [searchParams] = useSearchParams();
  const setup = usePracticeStore((state) => state.setup);
  const words = usePracticeStore((state) => state.words);
  const results = usePracticeStore((state) => state.results);
  const units = usePracticeStore((state) => state.units);
  const libraries = usePracticeStore((state) => state.libraries);
  const setPracticeSource = usePracticeStore((state) => state.setPracticeSource);
  const setPracticeMode = usePracticeStore((state) => state.setPracticeMode);
  const setPracticeAccent = usePracticeStore((state) => state.setPracticeAccent);
  const setPracticeOrderMode = usePracticeStore((state) => state.setPracticeOrderMode);
  const setPracticeSampleCount = usePracticeStore((state) => state.setPracticeSampleCount);
  const updatePlaybackSettings = usePracticeStore((state) => state.updatePlaybackSettings);
  const updateGradingRules = usePracticeStore((state) => state.updateGradingRules);
  const setShowChineseHint = usePracticeStore((state) => state.setShowChineseHint);
  const materializePracticeSample = usePracticeStore((state) => state.materializePracticeSample);
  const createSession = usePracticeStore((state) => state.createSession);
  useEffect(() => {
    const nextSource = parsePracticeSource(searchParams, location.pathname === "/practice" && setup.source.sourceType === "none");
    if (nextSource && !samePracticeSource(setup.source, nextSource)) {
      setPracticeSource(nextSource);
    }
  }, [location.pathname, searchParams, setPracticeSource, setup.source]);
  const resolvedSetup = setup;
  const selectedWords = useMemo(() => resolveSetupWords(resolvedSetup, words, results), [resolvedSetup, results, words]);
  const sourceWords = useMemo(() => resolveSetupWords({ ...resolvedSetup, orderMode: "sequence" }, words, results), [resolvedSetup, results, words]);
  const sampleMax = sourceWords.length;
  const sampleCount = Math.max(1, Math.min(sampleMax || 1, resolvedSetup.sampleCount ?? (sampleMax || 1)));
  const selectedSourceName = useMemo(() => sourceLabel(resolvedSetup.source, libraries, units), [libraries, resolvedSetup.source, units]);
  const sourceChips = useMemo(() => {
    const source = resolvedSetup.source;
    if (source.sourceType === "words") return buildWordSourceChips(sourceWords, libraries, source.sourceGroups);
    if (source.sourceType === "library") {
      const sourceUnits = units
        .filter((unit) => unit.libraryId === source.sourceId && unit.sortOrder > 0)
        .map((unit) => ({ key: String(unit.id), label: unit.name, wordIds: sourceWords.filter((word) => word.unitIds?.includes(unit.id)).map((word) => word.id) }))
        .filter((unit) => unit.wordIds.length);
      return sourceUnits.length ? sourceUnits : [{ key: String(source.sourceId), label: sourceLabel(source, libraries, units), wordIds: sourceWords.map((word) => word.id) }];
    }
    if (source.sourceType === "none") return [{ key: "none", label: "未选择来源", wordIds: [] }];
    return [{ key: source.sourceType, label: sourceLabel(source, libraries, units), wordIds: sourceWords.map((word) => word.id) }];
  }, [libraries, resolvedSetup.source, sourceWords, units]);
  const canStart = resolvedSetup.source.sourceType !== "none" && selectedWords.length > 0;
  const removeSourceChip = (chip: SourceChipItem) => {
    const removedIds = new Set(chip.wordIds);
    const nextWordIds = sourceWords.filter((word) => !removedIds.has(word.id)).map((word) => word.id);
    const nextGroups = resolvedSetup.source.sourceType === "words"
      ? normalizeSourceGroups(
          resolvedSetup.source.sourceGroups
            ?.filter((group) => group.key !== chip.key)
            .map((group) => ({ ...group, wordIds: group.wordIds.filter((wordId) => !removedIds.has(wordId)) })) ?? [],
          nextWordIds,
        )
      : [];
    setPracticeSource(nextWordIds.length ? { sourceType: "words", wordIds: nextWordIds, sourceGroups: nextGroups } : { sourceType: "none" });
    setPendingSourceRemoval(null);
  };
  const handleChipPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!sourceChipViewportRef.current) return;
    sourceChipDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: sourceChipViewportRef.current.scrollLeft,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleChipPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = sourceChipDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || !sourceChipViewportRef.current) return;
    sourceChipViewportRef.current.scrollLeft = dragState.startScrollLeft - (event.clientX - dragState.startX);
  };
  const handleChipPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (sourceChipDragRef.current?.pointerId === event.pointerId) sourceChipDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const activateSampleMode = (nextCount = sampleCount) => {
    setSampleCountDraft(null);
    setPracticeOrderMode("sample");
    if (sampleMax > 0) setPracticeSampleCount(Math.max(1, Math.min(sampleMax, Math.round(nextCount))));
  };
  const commitSampleCountDraft = () => {
    if (sampleCountDraft == null) return;
    setPracticeOrderMode("sample");
    const trimmed = sampleCountDraft.trim();
    const nextCount = trimmed ? Number(trimmed) : sampleMax;
    if (sampleMax > 0 && Number.isFinite(nextCount)) {
      setPracticeSampleCount(Math.max(1, Math.min(sampleMax, Math.round(nextCount))));
    }
    setSampleCountDraft(null);
  };
  return (
    <>
      <header className="page-topbar">
        <div>
          <h1 className="page-title">听写设置</h1>
          <p className="page-subtitle">选择范围、顺序、发音与批改规则后开始今日听写。</p>
        </div>
      </header>
      <div className="practice-setup-layout">
        <main className="practice-setup-main">
          <section className="practice-source-card">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ margin: 0 }}>听写来源</h2>
                <p className="page-subtitle">共 {sourceWords.length || 0} 词 · 来自 {selectedSourceName}</p>
              </div>
              <Button variant="secondary" size="sm" iconStart={<Icon name="list" />} onClick={() => navigate("/practice/source-picker")}>更改</Button>
            </div>
            <div
              className="source-chip-viewport"
              ref={sourceChipViewportRef}
              onPointerDown={handleChipPointerDown}
              onPointerMove={handleChipPointerMove}
              onPointerUp={handleChipPointerEnd}
              onPointerCancel={handleChipPointerEnd}
            >
              <div className="source-chip-track">
                {sourceChips.map((chip) => (
                  chip.wordIds.length ? (
                    <div key={chip.key} className="chip source-chip-removable is-selected">
                      <span>{chip.label}</span>
                      <button
                        type="button"
                        className="source-chip-remove-button"
                        aria-label={`删除${chip.label}`}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => setPendingSourceRemoval(chip)}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ) : (
                    <Chip key={chip.key}>{chip.label}</Chip>
                  )
                ))}
              </div>
            </div>
          </section>
          <section className="practice-base-card">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <h2 style={{ margin: 0 }}>基础设置</h2>
              <span style={{ color: "var(--foreground-tertiary)" }}>听写范围</span>
            </div>
            <div className="practice-range-grid">
              <div
                role="button"
                tabIndex={0}
                className={`practice-range-card ${resolvedSetup.orderMode !== "sample" ? "is-selected" : ""}`}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest(".segmented")) return;
                  setPracticeOrderMode(resolvedSetup.orderMode === "random" ? "random" : "sequence");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setPracticeOrderMode("sequence");
                }}
              >
                <h3 style={{ marginTop: 0 }}><Icon name="list" /> 听写全部</h3>
                <p>所选单词全部进入本次听写</p>
                <SegmentedControl
                  options={[{ label: "正序", value: "sequence" }, { label: "随机", value: "random" }]}
                  value={resolvedSetup.orderMode === "random" ? "random" : "sequence"}
                  onChange={(value) => setPracticeOrderMode(value)}
                />
              </div>
              <div
                className={`practice-range-card ${resolvedSetup.orderMode === "sample" ? "is-selected" : ""}`}
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("button,input")) return;
                  activateSampleMode();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") activateSampleMode();
                }}
              >
                <h3 style={{ marginTop: 0 }}><Icon name="shuffle" /> 抽 N 个听写</h3>
                <p>从已选来源中抽取指定数量</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <button
                    type="button"
                    className="sample-step-button"
                    onClick={() => activateSampleMode(sampleCount - 1)}
                    disabled={sampleMax <= 0 || sampleCount <= 1}
                  >
                    <Icon name="minus" size={18} />
                  </button>
                  <input
                    className="practice-sample-input"
                    type="number"
                    min={1}
                    max={sampleMax || 1}
                    value={sampleCountDraft ?? String(sampleCount)}
                    onFocus={() => setPracticeOrderMode("sample")}
                    onBlur={commitSampleCountDraft}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitSampleCountDraft();
                        event.currentTarget.blur();
                      }
                    }}
                    onChange={(event) => {
                      const rawValue = event.target.value;
                      setSampleCountDraft(rawValue);
                      setPracticeOrderMode("sample");
                      if (!rawValue.trim()) return;
                      const next = Number(rawValue);
                      if (Number.isFinite(next) && sampleMax > 0) setPracticeSampleCount(Math.max(1, Math.min(sampleMax, Math.round(next))));
                    }}
                    aria-label="抽取词数"
                  />
                  <button
                    type="button"
                    className="sample-step-button"
                    onClick={() => activateSampleMode(sampleCount + 1)}
                    disabled={sampleMax <= 0 || sampleCount >= sampleMax}
                  >
                    <Icon name="plus" size={18} />
                  </button>
                </div>
              </div>
            </div>
            <h3>发音</h3>
            <ChoiceCardGroup
              options={[{ label: "英音 (UK)", value: "uk" }, { label: "美音 (US)", value: "us" }]}
              value={resolvedSetup.accent}
              onChange={setPracticeAccent}
              selectedTone="cool"
            />
            <h3>听写模式</h3>
            <ChoiceCardGroup
              options={[{ label: "打字模式", value: "typing" }, { label: "纸笔模式", value: "paper" }]}
              value={resolvedSetup.mode}
              onChange={setPracticeMode}
              selectedTone="warm"
              subtitles={{ typing: "听写后自动批改", paper: "手动标记结果" }}
              icons={{ typing: "keyboard", paper: "pencil" }}
            />
          </section>
        </main>
        <aside className="practice-setup-aside">
          <section className="practice-settings-card practice-playback-card">
            <h2 style={{ marginTop: 0 }}>播放设置</h2>
            {["每词播放次数", "词间间隔", "播放速度"].map((label, index) => (
              <div key={label} className="setting-item">
                <span>{label}</span>
                <div style={{ width: 210 }}>
                  <SegmentedControl
                    options={index === 0 ? [{ label: "1次", value: "1" }, { label: "2次", value: "2" }, { label: "3次", value: "3" }] : index === 1 ? [{ label: "5s", value: "5" }, { label: "10s", value: "10" }, { label: "15s", value: "15" }] : [{ label: "0.5x", value: "0.5" }, { label: "1.0x", value: "1" }, { label: "1.5x", value: "1.5" }]}
                    value={
                      index === 0
                        ? String(resolvedSetup.playbackSettings.playCount)
                        : index === 1
                          ? String(resolvedSetup.playbackSettings.intervalSec)
                          : String(resolvedSetup.playbackSettings.speed)
                    }
                    onChange={(value) => {
                      if (index === 0) updatePlaybackSettings({ playCount: Number(value) as 1 | 2 | 3 });
                      else if (index === 1) updatePlaybackSettings({ intervalSec: Number(value) as 5 | 10 | 15 });
                      else updatePlaybackSettings({ speed: Number(value) as 0.5 | 1 | 1.5 });
                    }}
                  />
                </div>
              </div>
            ))}
            <SettingSwitch label="允许重放" checked={resolvedSetup.playbackSettings.allowReplay} onChange={(checked) => updatePlaybackSettings({ allowReplay: checked })} />
            <SettingSwitch label="自动播放下一词" checked={resolvedSetup.playbackSettings.autoPlayNext} onChange={(checked) => updatePlaybackSettings({ autoPlayNext: checked })} />
            <SettingSwitch label="隐藏中文释义" checked={!resolvedSetup.showChineseHint} onChange={(checked) => setShowChineseHint(!checked)} />
          </section>
          <section className="practice-settings-card practice-grading-card">
            <h2 style={{ marginTop: 0 }}>批改规则</h2>
            <SettingSwitch label="忽略大小写" checked={resolvedSetup.gradingRules.ignoreCase} onChange={(checked) => updateGradingRules({ ignoreCase: checked })} />
            <SettingSwitch label="忽略首尾空格" checked={resolvedSetup.gradingRules.trimWhitespace} onChange={(checked) => updateGradingRules({ trimWhitespace: checked })} />
            <SettingSwitch label="接受英美拼写差异" checked={resolvedSetup.gradingRules.acceptUkUs} onChange={(checked) => updateGradingRules({ acceptUkUs: checked })} />
            <SettingSwitch label="严格匹配连字符" checked={resolvedSetup.gradingRules.strictHyphen} onChange={(checked) => updateGradingRules({ strictHyphen: checked })} />
            <SettingSwitch label="严格匹配撇号" checked={resolvedSetup.gradingRules.strictApostrophe} onChange={(checked) => updateGradingRules({ strictApostrophe: checked })} />
          </section>
        </aside>
      </div>
      <section className="practice-bottom-action-bar">
        <SummaryTile label="词数" value={`${selectedWords.length} 词`} />
        <SummaryTile label="预计用时" value={estimateDurationLabel(selectedWords.length, resolvedSetup.playbackSettings.playCount, resolvedSetup.playbackSettings.intervalSec)} />
        <SummaryTile label="模式" value={resolvedSetup.mode === "typing" ? "打字" : "纸笔"} />
        <SummaryTile label="发音" value={resolvedSetup.accent === "us" ? "美音" : "英音"} accent />
        <Button
          variant="secondary"
          size="lg"
          iconStart={<Icon name="list" />}
          onClick={() => {
            commitSampleCountDraft();
            materializePracticeSample();
            navigate("/practice/list");
          }}
        >
          查看听写列表
        </Button>
        <Button
          variant="primary"
          size="lg"
          disabled={!canStart}
          iconStart={<Icon name="headphones" />}
          onClick={() => {
            commitSampleCountDraft();
            materializePracticeSample();
            const id = createSession();
            if (!id) navigate("/practice");
            else navigate(`/practice/session/${id}?mode=${resolvedSetup.mode}`);
          }}
        >
          开始听写
        </Button>
      </section>
      <NoticeDialog
        open={Boolean(pendingSourceRemoval)}
        title="是否删除该来源"
        description="确认后会将该来源的所有单词从本次听写列表中删除。"
        confirmText="确定"
        onClose={() => setPendingSourceRemoval(null)}
        onConfirm={() => {
          if (pendingSourceRemoval) removeSourceChip(pendingSourceRemoval);
        }}
      />
    </>
  );
}

function parsePracticeSource(searchParams: URLSearchParams, resetWhenMissing: boolean): PracticeSource | null {
  const sourceType = searchParams.get("source_type");
  if (!sourceType) return resetWhenMissing ? { sourceType: "none" } : null;
  if (sourceType === "none") return { sourceType: "none" };
  if (sourceType === "wrong_book") return { sourceType: "wrong_book" };
  if (sourceType === "favorite") return { sourceType: "favorite" };
  if (sourceType === "library" || sourceType === "unit" || sourceType === "history_session") {
    const sourceId = Number(searchParams.get("source_id"));
    if (!Number.isFinite(sourceId)) return { sourceType: "none" };
    if (sourceType === "history_session") {
      const filter = searchParams.get("filter") === "wrong" ? "wrong" : searchParams.get("filter") === "all" ? "all" : undefined;
      return filter ? { sourceType, sourceId, filter } : { sourceType, sourceId };
    }
    return { sourceType, sourceId };
  }
  if (sourceType === "words") {
    const wordIds = (searchParams.get("word_ids") ?? "")
      .split(",")
      .map((item) => Number(item.trim()))
      .filter(Number.isFinite);
    return wordIds.length ? { sourceType: "words", wordIds } : { sourceType: "none" };
  }
  return { sourceType: "none" };
}

function samePracticeSource(left: PracticeSource, right: PracticeSource): boolean {
  if (left.sourceType !== right.sourceType) return false;
  if (left.sourceType === "history_session" && right.sourceType === "history_session") {
    return left.sourceId === right.sourceId && left.filter === right.filter;
  }
  if ("sourceId" in left || "sourceId" in right) return "sourceId" in left && "sourceId" in right && left.sourceId === right.sourceId;
  if ("wordIds" in left || "wordIds" in right) {
    return "wordIds" in left && "wordIds" in right && left.wordIds.join(",") === right.wordIds.join(",");
  }
  return true;
}

function sourceLabel(source: PracticeSource, libraries: { id: number; name: string }[], units: { id: number; name: string }[]) {
  if (source.sourceType === "library") return libraries.find((library) => library.id === source.sourceId)?.name ?? "词库";
  if (source.sourceType === "unit") return units.find((unit) => unit.id === source.sourceId)?.name ?? "Unit";
  if (source.sourceType === "wrong_book") return "错题本";
  if (source.sourceType === "favorite") return "收藏夹";
  if (source.sourceType === "history_session") return "历史记录";
  if (source.sourceType === "words") return source.wordIds.length ? "多个来源" : "未选择";
  return "未选择";
}

function buildWordSourceChips(words: VocabularyWord[], libraries: VocabularyLibrary[], sourceGroups?: PracticeSourceGroup[]): SourceChipItem[] {
  if (!words.length) return [{ key: "none", label: "未选择来源", wordIds: [] }];
  const wordIds = new Set(words.map((word) => word.id));
  const grouped = normalizeSourceGroups(sourceGroups ?? [], [...wordIds]);
  if (grouped.length) {
    return grouped.map((group) => ({
      key: group.key,
      label: `${group.label} · ${group.wordIds.length}词`,
      wordIds: group.wordIds,
    }));
  }
  const counts = new Map<number, number>();
  const wordIdsByLibrary = new Map<number, number[]>();
  for (const word of words) {
    counts.set(word.libraryId, (counts.get(word.libraryId) ?? 0) + 1);
    wordIdsByLibrary.set(word.libraryId, [...(wordIdsByLibrary.get(word.libraryId) ?? []), word.id]);
  }
  return [...counts.entries()].map(([libraryId, count]) => ({
    key: String(libraryId),
    label: `${libraryId === 0 ? "词典" : libraries.find((library) => library.id === libraryId)?.name ?? "词库"} · ${count}词`,
    wordIds: wordIdsByLibrary.get(libraryId) ?? [],
  }));
}

function normalizeSourceGroups(groups: PracticeSourceGroup[], selectedWordIds: number[]): PracticeSourceGroup[] {
  const selectedSet = new Set(selectedWordIds);
  return groups
    .map((group) => ({
      ...group,
      wordIds: [...new Set(group.wordIds.filter((wordId) => selectedSet.has(wordId)))],
    }))
    .filter((group) => group.wordIds.length);
}

function sourceGroupForLibrary(library: VocabularyLibrary | undefined): Pick<PracticeSourceGroup, "key" | "label"> {
  if (!library) return { key: "unknown", label: "词库" };
  if (library.type === "favorite") return { key: "favorite", label: "收藏夹" };
  if (library.type === "wrong_book") return { key: "wrong_book", label: "错题本" };
  return { key: `library:${library.id}`, label: library.name };
}

export function PracticeSourcePickerPage() {
  const navigate = useNavigate();
  const setup = usePracticeStore((state) => state.setup);
  const libraries = usePracticeStore((state) => state.libraries);
  const units = usePracticeStore((state) => state.units);
  const words = usePracticeStore((state) => state.words);
  const results = usePracticeStore((state) => state.results);
  const setPracticeSource = usePracticeStore((state) => state.setPracticeSource);
  const sourceLibraries = libraries;
  const initialWords = useMemo(() => resolveSetupWords({ ...setup, orderMode: "sequence" }, words, results), [results, setup, words]);
  const initialSourceGroups = useMemo(() => {
    if (setup.source.sourceType === "words" && setup.source.sourceGroups?.length) {
      return normalizeSourceGroups(setup.source.sourceGroups, initialWords.map((word) => word.id));
    }
    if (setup.source.sourceType === "favorite") return [{ key: "favorite", label: "收藏夹", wordIds: initialWords.map((word) => word.id) }];
    if (setup.source.sourceType === "wrong_book") return [{ key: "wrong_book", label: "错题本", wordIds: initialWords.map((word) => word.id) }];
    return [];
  }, [initialWords, setup.source]);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(() => new Set(initialWords.map((word) => word.id)));
  const selectedSourceGroupsRef = useRef<PracticeSourceGroup[]>(initialSourceGroups);
  const [activeLibraryId, setActiveLibraryId] = useState(() => inferInitialLibraryId(setup.source, initialWords, sourceLibraries));
  const [activeUnitByLibrary, setActiveUnitByLibrary] = useState<Record<number, number | "all">>({});
  const [filter, setFilter] = useState<"all" | "unselected" | "selected">("all");
  const [query, setQuery] = useState("");
  const pickerDialogRef = useRef<HTMLElement>(null);
  useModalA11y(true, pickerDialogRef, () => navigate("/practice/setup"), "practice-source-picker");
  const activeLibrary = sourceLibraries.find((library) => library.id === activeLibraryId) ?? sourceLibraries[0];
  const activeUnits = activeLibrary ? units.filter((unit) => unit.libraryId === activeLibrary.id && unit.sortOrder > 0) : [];
  const activeUnit = activeLibrary ? activeUnitByLibrary[activeLibrary.id] ?? "all" : "all";
  const libraryWords = useMemo(() => (activeLibrary ? wordsForSourceLibrary(activeLibrary, words) : []), [activeLibrary, words]);
  const scopedWords = useMemo(() => {
    const byUnit = activeUnit === "all" ? libraryWords : libraryWords.filter((word) => word.unitIds?.includes(activeUnit));
    const normalizedQuery = query.trim().toLowerCase();
    return normalizedQuery
      ? byUnit.filter((word) => word.word.toLowerCase().includes(normalizedQuery) || word.meaning.includes(query.trim()))
      : byUnit;
  }, [activeUnit, libraryWords, query]);
  const visibleWords = useMemo(() => {
    if (filter === "selected") return scopedWords.filter((word) => selectedWordIds.has(word.id));
    if (filter === "unselected") return scopedWords.filter((word) => !selectedWordIds.has(word.id));
    return scopedWords;
  }, [filter, scopedWords, selectedWordIds]);
  const selectedCount = selectedWordIds.size;
  const visibleSelectedCount = visibleWords.filter((word) => selectedWordIds.has(word.id)).length;
  const applySelectedSourceGroups = (updater: (current: PracticeSourceGroup[]) => PracticeSourceGroup[]) => {
    const next = updater(selectedSourceGroupsRef.current);
    selectedSourceGroupsRef.current = next;
  };
  const assignWordsToActiveGroup = (wordIds: number[]) => {
    if (!activeLibrary || !wordIds.length) return;
    const group = sourceGroupForLibrary(activeLibrary);
    applySelectedSourceGroups((current) => {
      const wordIdSet = new Set(wordIds);
      const nextGroups = current
        .map((item) => (item.key === group.key ? item : { ...item, wordIds: item.wordIds.filter((wordId) => !wordIdSet.has(wordId)) }))
        .filter((item) => item.wordIds.length);
      const existing = nextGroups.find((item) => item.key === group.key);
      if (existing) existing.wordIds = [...new Set([...existing.wordIds, ...wordIds])];
      else nextGroups.push({ ...group, wordIds });
      return nextGroups;
    });
  };
  const removeWordsFromGroups = (wordIds: number[]) => {
    const wordIdSet = new Set(wordIds);
    applySelectedSourceGroups((current) =>
      current
        .map((group) => ({ ...group, wordIds: group.wordIds.filter((wordId) => !wordIdSet.has(wordId)) }))
        .filter((group) => group.wordIds.length),
    );
  };
  const toggleWord = (wordId: number) => {
    const selected = selectedWordIds.has(wordId);
    setSelectedWordIds((current) => {
      const next = new Set(current);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
    if (selected) removeWordsFromGroups([wordId]);
    else assignWordsToActiveGroup([wordId]);
  };
  const selectVisibleWords = () => {
    const visibleWordIds = visibleWords.map((word) => word.id);
    setSelectedWordIds((current) => {
      const next = new Set(current);
      for (const word of visibleWords) next.add(word.id);
      return next;
    });
    assignWordsToActiveGroup(visibleWordIds);
  };
  const unselectVisibleWords = () => {
    const visibleWordIds = visibleWords.map((word) => word.id);
    setSelectedWordIds((current) => {
      const next = new Set(current);
      for (const word of visibleWords) next.delete(word.id);
      return next;
    });
    removeWordsFromGroups(visibleWordIds);
  };
  return (
    <>
      <PracticeSetupPage />
      {createPortal(
      <div className="picker-page picker-page-source">
      <section ref={pickerDialogRef} className="picker-dialog picker-dialog-source source-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="source-picker-title" tabIndex={-1}>
        <header className="picker-header">
          <div>
            <h1 id="source-picker-title">选择目标词库与 Unit</h1>
            <p>可组合多个词库、Unit 或单词，本次已选 {selectedCount} 词。</p>
          </div>
          <button type="button" className="picker-close" aria-label="关闭来源选择器" onClick={() => navigate("/practice/setup")}>
            <Icon name="x" size={22} />
          </button>
        </header>
        <div className="source-picker-body">
          <aside className="source-picker-sidebar">
            <div className="source-picker-section-label">词库</div>
            {sourceLibraries.map((library) => {
              const libraryWordsForCount = wordsForSourceLibrary(library, words);
              const selectedInLibrary = libraryWordsForCount.filter((word) => selectedWordIds.has(word.id)).length;
              return (
                <button
                  type="button"
                  key={library.id}
                  className={`source-library-row ${activeLibrary?.id === library.id ? "is-active" : ""}`}
                  onClick={() => setActiveLibraryId(library.id)}
                >
                  <Icon name={library.type === "wrong_book" ? "alert" : library.type === "favorite" ? "star" : "book"} size={18} />
                  <span>
                    <strong>{library.name}</strong>
                    <small>{selectedInLibrary ? `${selectedInLibrary} / ${libraryWordsForCount.length} 词已选` : `${libraryWordsForCount.length} 词`}</small>
                  </span>
                </button>
              );
            })}
          </aside>
          <main className="source-picker-main">
            <div className="source-picker-toolbar">
              <div>
                <h2>{activeLibrary?.name ?? "词库"}</h2>
                <p>{scopedWords.length} 词 · 当前显示 {visibleWords.length} 词 · 已选 {visibleSelectedCount} 词</p>
              </div>
              {activeLibrary && activeUnits.length ? (
                <label className="source-unit-select">
                  <span>Unit</span>
                  <select
                    value={activeUnit}
                    onChange={(event) =>
                      setActiveUnitByLibrary((current) => ({
                        ...current,
                        [activeLibrary.id]: event.target.value === "all" ? "all" : Number(event.target.value),
                      }))
                    }
                  >
                    <option value="all">全部</option>
                    {activeUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="source-picker-controls">
              <div className="source-picker-filter">
                <Chip selected={filter === "all"} onClick={() => setFilter("all")}>全部</Chip>
                <Chip selected={filter === "unselected"} onClick={() => setFilter("unselected")}>未选</Chip>
                <Chip selected={filter === "selected"} onClick={() => setFilter("selected")}>已选</Chip>
              </div>
              <input className="source-picker-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索当前词库单词 / 释义" />
              <Button variant="secondary" size="sm" onClick={selectVisibleWords}>全选当前列表</Button>
              <Button variant="ghost" size="sm" onClick={unselectVisibleWords}>取消当前列表</Button>
            </div>
            <div className="source-word-list">
              {visibleWords.length ? (
                visibleWords.map((word) => (
                  <button
                    type="button"
                    key={word.id}
                    className={`source-word-row ${selectedWordIds.has(word.id) ? "is-selected" : ""}`}
                    onClick={() => toggleWord(word.id)}
                  >
                    <span className="source-word-check">{selectedWordIds.has(word.id) ? <Icon name="check" size={15} /> : null}</span>
                    <span>
                      <strong>{word.word}</strong>
                      <small>{word.phonetic ?? "/-/"}</small>
                    </span>
                    <span>{word.partOfSpeech ? `${word.partOfSpeech} ${word.meaning}` : word.meaning}</span>
                  </button>
                ))
              ) : (
                <div className="picker-empty">当前筛选下没有可显示的单词。</div>
              )}
            </div>
          </main>
        </div>
        <footer className="picker-footer">
          <Button variant="secondary" size="dialog" onClick={() => navigate("/practice/setup")}>取消</Button>
          <Button
            variant="primary"
            size="dialog"
            disabled={!selectedCount}
            onClick={() => {
              const wordIds = [...selectedWordIds];
              const nextSource: PracticeSource = selectedCount
                ? { sourceType: "words", wordIds, sourceGroups: normalizeSourceGroups(selectedSourceGroupsRef.current, wordIds) }
                : { sourceType: "none" };
              setPracticeSource(nextSource);
              navigate("/practice/setup");
            }}
          >
            确定 · {selectedCount} 词
          </Button>
        </footer>
      </section>
      </div>
      , document.body)}
    </>
  );
}

export function PracticeSetupListPage() {
  const navigate = useNavigate();
  const setup = usePracticeStore((state) => state.setup);
  const allWords = usePracticeStore((state) => state.words);
  const allResults = usePracticeStore((state) => state.results);
  const setPracticeSource = usePracticeStore((state) => state.setPracticeSource);
  const createSession = usePracticeStore((state) => state.createSession);
  const [listWords] = useState(() => resolveSetupWords(setup, allWords, allResults));
  const [removedWordIds, setRemovedWordIds] = useState<Set<number>>(() => new Set());
  const listDialogRef = useRef<HTMLElement>(null);
  useModalA11y(true, listDialogRef, () => navigate("/practice/setup"), "practice-setup-list");
  const activeWords = useMemo(() => listWords.filter((word) => !removedWordIds.has(word.id)), [listWords, removedWordIds]);
  const updateRemovedWords = (wordId: number) => {
    setRemovedWordIds((current) => {
      const next = new Set(current);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      const nextActiveIds = listWords.filter((word) => !next.has(word.id)).map((word) => word.id);
      setPracticeSource(nextActiveIds.length ? { sourceType: "words", wordIds: nextActiveIds } : { sourceType: "none" });
      return next;
    });
  };
  return (
    createPortal(
    <div className="picker-page picker-page-scrim">
      <section ref={listDialogRef} className="picker-dialog picker-dialog-list" role="dialog" aria-modal="true" aria-labelledby="practice-list-title" tabIndex={-1}>
        <header className="picker-header">
          <div>
            <h1 id="practice-list-title">本次听写列表</h1>
            <p>{activeWords.length} 个单词</p>
          </div>
          <IconButton icon="x" size="md" label="关闭听写列表" onClick={() => navigate("/practice/setup")} />
        </header>
        <div className="practice-word-preview-list">
          {listWords.map((word, index) => {
            const removed = removedWordIds.has(word.id);
            return (
            <div key={word.id} className="practice-word-preview-row">
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{word.word}</strong>
              <span>{word.partOfSpeech ? `${word.partOfSpeech} ${word.meaning}` : word.meaning}</span>
              <button
                type="button"
                className={`practice-word-preview-toggle ${removed ? "is-add" : "is-remove"}`}
                onClick={() => updateRemovedWords(word.id)}
              >
                {removed ? "加入" : "移出"}
              </button>
            </div>
            );
          })}
        </div>
        <footer className="picker-footer">
          <Button variant="secondary" size="dialog" onClick={() => navigate("/practice/setup")}>返回设置</Button>
          <Button
            variant="primary"
            size="dialog"
            iconStart={<Icon name="headphones" />}
            disabled={!activeWords.length || setup.source.sourceType === "none"}
            onClick={() => {
              setPracticeSource({ sourceType: "words", wordIds: activeWords.map((word) => word.id) });
              const id = createSession();
              if (id) navigate(`/practice/session/${id}?mode=${setup.mode}`);
            }}
          >
            开始听写
          </Button>
        </footer>
      </section>
    </div>
    , document.body)
  );
}

function inferInitialLibraryId(source: PracticeSource, selectedWords: VocabularyWord[], libraries: VocabularyLibrary[]): number {
  if (source.sourceType === "library") return source.sourceId;
  if (source.sourceType === "wrong_book") return libraries.find((library) => library.type === "wrong_book")?.id ?? libraries[0]?.id ?? 0;
  if (source.sourceType === "favorite") return libraries.find((library) => library.type === "favorite")?.id ?? libraries[0]?.id ?? 0;
  if (selectedWords[0]) return selectedWords[0].libraryId;
  return libraries.find((library) => library.type === "official" || library.type === "custom")?.id ?? libraries[0]?.id ?? 0;
}

function wordsForSourceLibrary(library: VocabularyLibrary, words: VocabularyWord[]): VocabularyWord[] {
  if (library.type === "wrong_book") return words.filter((word) => word.inWrongBook || word.wrongCount > 0);
  if (library.type === "favorite") return words.filter((word) => word.isFavorite);
  return words.filter((word) => word.libraryId === library.id);
}

function useDictationPlayback({
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

  const waitInterval = useCallback((runId: number) =>
    new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => resolve(runIdRef.current === runId), settings.intervalSec * 1000);
      if (runIdRef.current !== runId) {
        window.clearTimeout(timer);
        resolve(false);
      }
    }), [settings.intervalSec]);

  const playOnce = useCallback(async (target: Pick<DictationResult, "id" | "wordId" | "word">, runId?: number): Promise<boolean> => {
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
  }, [accent, settings.speed]);

  const runTimeline = useCallback(async (runId: number, target: Pick<DictationResult, "id" | "wordId" | "word">) => {
    while (runIdRef.current === runId && scheduledCountRef.current < settings.playCount) {
      scheduledCountRef.current += 1;
      setScheduledCount(scheduledCountRef.current);
      const played = await playOnce(target, runId);
      if (!played) return;
      const shouldContinue = await waitInterval(runId);
      if (!shouldContinue) return;
    }
    if (runIdRef.current === runId && settings.autoPlayNext) autoAdvanceRef.current?.();
  }, [playOnce, settings.autoPlayNext, settings.playCount, waitInterval]);

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

function useDictationAudioPrefetch({
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

export function PracticeEmptyPage() {
  const navigate = useNavigate();
  return <EmptyState title="还没有选择来源" description="请先选择词库、Unit、错题本或收藏夹。" action={<Button onClick={() => navigate("/practice/source-picker")}>选择来源</Button>} />;
}

export function DictationSessionTypingPage() {
  const { sessionId = "5000" } = useParams();
  const navigate = useNavigate();
  const setup = usePracticeStore((state) => state.setup);
  const sessionIndex = usePracticeStore((state) => state.sessionIndex);
  const answerInput = usePracticeStore((state) => state.answerInput);
  const setAnswerInput = usePracticeStore((state) => state.setAnswerInput);
  const revealCurrentHint = usePracticeStore((state) => state.revealCurrentHint);
  const submitCurrentAnswer = usePracticeStore((state) => state.submitCurrentAnswer);
  const skipCurrentWord = usePracticeStore((state) => state.skipCurrentWord);
  const finishTypingSession = usePracticeStore((state) => state.finishTypingSession);
  const previousWord = usePracticeStore((state) => state.previousWord);
  const nextWord = usePracticeStore((state) => state.nextWord);
  const pauseSession = usePracticeStore((state) => state.pauseSession);
  const toggleFavorite = usePracticeStore((state) => state.toggleFavorite);
  const feedback = usePracticeStore((state) => state.sessionFeedback);
  const allResults = usePracticeStore((state) => state.results);
  const allWords = usePracticeStore((state) => state.words);
  const sessions = usePracticeStore((state) => state.sessions);
  const [answerReveal, setAnswerReveal] = useState<{ resultId: number | null; visible: boolean }>({ resultId: null, visible: false });
  const [confirmAnswerOpen, setConfirmAnswerOpen] = useState(false);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const [hintVisibility, setHintVisibility] = useState<Record<number, boolean>>({});
  const session = useMemo(() => sessions.find((item) => item.id === Number(sessionId)), [sessionId, sessions]);
  const sessionAccent = session?.accent ?? setup.accent;
  const sessionSettings = session?.settings ?? setup;
  const results = useMemo(
    () => allResults.filter((row) => row.sessionId === Number(sessionId)).sort((a, b) => a.orderIndex - b.orderIndex),
    [allResults, sessionId],
  );
  const current = results[sessionIndex];
  const previous = results[sessionIndex - 1];
  const currentWord = useMemo(() => allWords.find((word) => word.id === current?.wordId), [allWords, current?.wordId]);
  const isCurrentAnswered = current?.result !== "unmarked";
  const correctCount = results.filter((row) => row.result === "correct").length;
  const wrongCount = results.filter((row) => row.result === "wrong" || row.result === "skipped").length;
  const goToNextOrResult = () => {
    const done = nextWord(Number(sessionId));
    if (done) navigate(`/practice/result/${sessionId}?mode=typing`);
  };
  const submitCurrentAndMaybeAdvance = () => {
    if (!current) return;
    const isLast = sessionIndex >= results.length - 1;
    if (!answerInput.trim()) return;
    const result = submitCurrentAnswer(Number(sessionId));
    if (isLast) {
      finishTypingSession(Number(sessionId), answerInput);
      navigate(`/practice/result/${sessionId}?mode=typing`);
      return;
    }
    if (result === "correct" || result === "wrong") goToNextOrResult();
  };
  const finishNow = () => {
    finishTypingSession(Number(sessionId), answerInput);
    setConfirmFinishOpen(false);
    navigate(`/practice/result/${sessionId}?mode=typing`);
  };
  const playback = useDictationPlayback({
    current,
    accent: sessionAccent,
    settings: sessionSettings.playbackSettings,
    onAutoAdvance: () => {
      submitCurrentAnswer(Number(sessionId), answerInput, { allowEmpty: true });
      goToNextOrResult();
    },
  });
  useDictationAudioPrefetch({ results, sessionIndex, accent: sessionAccent, speed: sessionSettings.playbackSettings.speed });
  if (!current) return <PracticeEmptyPage />;
  const showAnswer = answerReveal.resultId === current.id && answerReveal.visible;
  const showHint = Boolean(sessionSettings.showChineseHint && hintVisibility[current.id]);
  return (
    <>
      <header className="page-topbar session-topbar">
        <div><p className="session-kicker">听写中 · {formatSessionSourceName(session?.sourceName ?? "听写")}</p><h1 className="page-title">打字模式 · {sessionAccent.toUpperCase()} 发音</h1></div>
        <SessionTopActions correctCount={correctCount} wrongCount={wrongCount} onSettings={() => navigate(`/practice/session/${sessionId}?settings=1`)} onExit={() => navigate(`/practice/session/${sessionId}?exit=1`)} />
      </header>
      <strong>进度 {sessionIndex + 1} / {results.length}</strong>
      <ProgressBar value={((sessionIndex + 1) / results.length) * 100} tone="accent" />
      <div style={{ marginTop: 18 }}>
        <DictationPlayer
          round={`ROUND ${sessionIndex + 1} OF ${results.length} · HINT ${sessionSettings.showChineseHint ? "可显示" : "隐藏"}`}
          hint={showHint ? current.meaning : "请在下方输入听到的单词"}
          playing={playback.isPlaying}
          disablePlay={playback.isPlaying}
          onPlay={playback.replay}
        >
          <button
            type="button"
            className="session-hint-chip"
            disabled={!sessionSettings.showChineseHint}
            onClick={(event) => {
              event.stopPropagation();
              if (!showHint) revealCurrentHint(Number(sessionId));
              setHintVisibility((visibility) => ({ ...visibility, [current.id]: !showHint }));
            }}
          >
            {sessionSettings.showChineseHint ? (showHint ? "隐藏中文" : "显示中文") : "中文已隐藏"}
          </button>
          <div style={{ display: "flex", width: 640, height: 78, alignItems: "center", gap: 12, marginTop: 34, padding: 18, borderRadius: 16, background: "var(--surface-card)" }}>
            <span className="session-input-caret" />
            <input
              value={answerInput}
              onChange={(event) => setAnswerInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitCurrentAndMaybeAdvance();
              }}
              style={{ flex: 1, border: 0, outline: 0, fontSize: 24, background: "transparent" }}
              autoFocus
            />
            <Button variant="primary" size="md" onClick={submitCurrentAndMaybeAdvance}>提交</Button>
          </div>
        </DictationPlayer>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, marginTop: 18 }}>
        <div style={panelStyle}>
          {showAnswer ? (
            `正确答案：${current.correctAnswer}`
          ) : feedback === "idle" && previous ? (
            <PreviousResult result={previous} />
          ) : feedback === "idle" ? (
            "输入答案后提交，或选择不会跳过。"
          ) : feedback === "correct" ? (
            "回答正确"
          ) : (
            `正确答案：${current.correctAnswer}`
          )}
        </div>
        <div style={{ ...panelStyle, display: "flex", justifyContent: "space-between" }}>
          <Button variant="text" size="sm" iconStart={<Icon name="skip" size={14} />} onClick={() => {
            skipCurrentWord(Number(sessionId));
            goToNextOrResult();
          }}>不会 跳过</Button>
          <Button variant="text" size="sm" iconStart={<Icon name="eye" size={14} />} onClick={() => setConfirmAnswerOpen(true)}>查看答案</Button>
          <Button
            variant="text"
            size="sm"
            iconStart={<Icon name="star" size={14} filled={Boolean(currentWord?.isFavorite)} />}
            onClick={() => toggleFavorite(current.wordId)}
            style={{ color: currentWord?.isFavorite ? "var(--accent-primary)" : undefined }}
          >
            {currentWord?.isFavorite ? "已收藏" : "收藏"}
          </Button>
        </div>
      </div>
      <DictationControlBar
        onPrevious={() => previousWord(Number(sessionId))}
        onReplay={playback.replay}
        onNext={() => {
          const done = nextWord(Number(sessionId));
          if (done) navigate(`/practice/result/${sessionId}?mode=typing`);
        }}
        onPause={() => {
          pauseSession(Number(sessionId));
          navigate(`/practice/session/${sessionId}?paused=1`);
        }}
        onSubmit={() => {
          const isLast = sessionIndex >= results.length - 1;
          if (isLast && answerInput.trim()) {
            finishTypingSession(Number(sessionId), answerInput);
            navigate(`/practice/result/${sessionId}?mode=typing`);
            return;
          }
          setConfirmFinishOpen(true);
        }}
        disablePrevious={sessionIndex <= 0}
        disableReplay={!playback.canReplay}
        disableNext={!isCurrentAnswered}
        disableSubmit={false}
        submitLabel="完成听写"
      />
      <NoticeDialog
        open={confirmAnswerOpen}
        title="是否查看答案"
        description="查看答案后当前词语按照错误处理"
        confirmText="确认"
        onConfirm={() => {
          submitCurrentAnswer(Number(sessionId), answerInput, { allowEmpty: true, forceWrong: true });
          setAnswerReveal({ resultId: current.id, visible: true });
          setConfirmAnswerOpen(false);
        }}
        onClose={() => setConfirmAnswerOpen(false)}
      />
      <NoticeDialog
        open={confirmFinishOpen}
        title="当前听写未完成，是否提交"
        description="确认后将直接进入结算，未完成的单词按错误处理。"
        confirmText="确认"
        onConfirm={finishNow}
        onClose={() => setConfirmFinishOpen(false)}
      />
    </>
  );
}

function formatSessionSourceName(sourceName: string): string {
  return sourceName.split("·")[0]?.trim() || sourceName;
}

function PreviousResult({ result }: { result: { result: string; word: string; correctAnswer: string; meaning: string } }) {
  const isCorrect = result.result === "correct";
  return (
    <div className="previous-result">
      <span className={`previous-result-mark ${isCorrect ? "is-correct" : "is-wrong"}`}>{isCorrect ? "✓" : "!"}</span>
      <div>
        <p>
          上一题 · {isCorrect ? "正确" : "错误"}
        </p>
        <strong>{result.correctAnswer || result.word}</strong>
        <span> · {result.meaning}</span>
      </div>
    </div>
  );
}

export function DictationSessionPaperPage() {
  const { sessionId = "5000" } = useParams();
  const navigate = useNavigate();
  const setup = usePracticeStore((state) => state.setup);
  const sessionIndex = usePracticeStore((state) => state.sessionIndex);
  const allResults = usePracticeStore((state) => state.results);
  const sessions = usePracticeStore((state) => state.sessions);
  const previousWord = usePracticeStore((state) => state.previousWord);
  const nextWord = usePracticeStore((state) => state.nextWord);
  const pauseSession = usePracticeStore((state) => state.pauseSession);
  const revealCurrentHint = usePracticeStore((state) => state.revealCurrentHint);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const [hintVisibility, setHintVisibility] = useState<Record<number, boolean>>({});
  const session = useMemo(() => sessions.find((item) => item.id === Number(sessionId)), [sessionId, sessions]);
  const sessionAccent = session?.accent ?? setup.accent;
  const sessionSettings = session?.settings ?? setup;
  const results = useMemo(
    () => allResults.filter((row) => row.sessionId === Number(sessionId)).sort((a, b) => a.orderIndex - b.orderIndex),
    [allResults, sessionId],
  );
  const current = results[sessionIndex];
  const playback = useDictationPlayback({
    current,
    accent: sessionAccent,
    settings: sessionSettings.playbackSettings,
    onAutoAdvance: () => {
      const done = nextWord(Number(sessionId));
      if (done) navigate(`/practice/result/${sessionId}?mode=paper`);
    },
  });
  useDictationAudioPrefetch({ results, sessionIndex, accent: sessionAccent, speed: sessionSettings.playbackSettings.speed });
  if (!current) return <PracticeEmptyPage />;
  const showHint = Boolean(sessionSettings.showChineseHint && hintVisibility[current.id]);
  return (
    <>
      <header className="page-topbar session-topbar">
        <div><p className="session-kicker">听写中 · {formatSessionSourceName(session?.sourceName ?? "听写")}</p><h1 className="page-title">纸笔模式 · {sessionAccent.toUpperCase()} 发音</h1></div>
        <SessionTopActions onSettings={() => navigate(`/practice/session/${sessionId}?settings=1`)} onExit={() => navigate(`/practice/session/${sessionId}?exit=1`)} />
      </header>
      <strong>进度 {sessionIndex + 1} / {results.length}</strong>
      <ProgressBar value={((sessionIndex + 1) / results.length) * 100} tone="accent" />
      <div style={{ marginTop: 18 }}>
        <DictationPlayer
          round={`ROUND ${sessionIndex + 1} OF ${results.length} · HINT ${sessionSettings.showChineseHint ? "可显示" : "隐藏"}`}
          hint={showHint ? current.meaning : "请在纸上写下听到的单词"}
          playing={playback.isPlaying}
          disablePlay={playback.isPlaying}
          onPlay={playback.replay}
        >
          <button
            type="button"
            className="session-hint-chip"
            disabled={!sessionSettings.showChineseHint}
            onClick={(event) => {
              event.stopPropagation();
              if (!showHint) revealCurrentHint(Number(sessionId));
              setHintVisibility((visibility) => ({ ...visibility, [current.id]: !showHint }));
            }}
          >
            {sessionSettings.showChineseHint ? (showHint ? "隐藏中文" : "显示中文") : "中文已隐藏"}
          </button>
          <p style={{ marginTop: 30, color: "var(--foreground-inverse)", opacity: 0.86 }}>
            在纸上写下听到的单词，完成后进入批改页手动标记结果。
          </p>
        </DictationPlayer>
      </div>
      <DictationControlBar
        onPrevious={() => previousWord(Number(sessionId))}
        onReplay={playback.replay}
        onNext={() => {
          const done = nextWord(Number(sessionId));
          if (done) navigate(`/practice/result/${sessionId}?mode=paper`);
        }}
        onPause={() => {
          pauseSession(Number(sessionId));
          navigate(`/practice/session/${sessionId}?paused=1`);
        }}
        onSubmit={() => setConfirmFinishOpen(true)}
        disablePrevious={sessionIndex <= 0}
        disableReplay={!playback.canReplay}
        submitLabel="完成听写"
      />
      <NoticeDialog
        open={confirmFinishOpen}
        title="是否完成听写"
        description="确认后进入纸笔批改页面。"
        confirmText="确定"
        onConfirm={() => {
          setConfirmFinishOpen(false);
          navigate(`/practice/result/${sessionId}?mode=paper`);
        }}
        onClose={() => setConfirmFinishOpen(false)}
      />
    </>
  );
}

export function DictationSessionPausedPage() {
  const navigate = useNavigate();
  const { sessionId = "5000" } = useParams();
  const resumeSession = usePracticeStore((state) => state.resumeSession);
  const session = usePracticeStore((state) => state.sessions.find((item) => item.id === Number(sessionId)));
  return <EmptyState title="听写已暂停" description="继续后会回到当前单词。" action={<Button onClick={() => {
    resumeSession(Number(sessionId));
    navigate(`/practice/session/${sessionId}?mode=${session?.mode ?? "typing"}`);
  }}>继续听写</Button>} />;
}

export function DictationSessionSettingsPage() {
  const navigate = useNavigate();
  const { sessionId = "5000" } = useParams();
  const setup = usePracticeStore((state) => state.setup);
  const sessions = usePracticeStore((state) => state.sessions);
  const updatePlaybackSettings = usePracticeStore((state) => state.updatePlaybackSettings);
  const updateGradingRules = usePracticeStore((state) => state.updateGradingRules);
  const session = sessions.find((item) => item.id === Number(sessionId));
  const mode = session?.mode ?? setup.mode;
  const sessionSettings = session?.settings ?? setup;
  const closeUrl = `/practice/session/${sessionId}?mode=${mode}`;
  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(closeUrl)}>‹ 返回听写</button>
      <header className="page-topbar"><div><p className="page-subtitle">本次听写</p><h1 className="page-title">听写设置</h1></div></header>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>播放设置</h2>
          <div className="setting-item">
            <span>播放速度</span>
            <SegmentedControl
              options={[{ label: "0.5x", value: "0.5" }, { label: "1.0x", value: "1" }, { label: "1.5x", value: "1.5" }]}
              value={String(sessionSettings.playbackSettings.speed)}
              onChange={(value) => updatePlaybackSettings({ speed: Number(value) as 0.5 | 1 | 1.5 })}
            />
          </div>
          <SettingSwitch label="允许重放" checked={sessionSettings.playbackSettings.allowReplay} onChange={(checked) => updatePlaybackSettings({ allowReplay: checked })} />
          <SettingSwitch label="自动播放下一词" checked={sessionSettings.playbackSettings.autoPlayNext} onChange={(checked) => updatePlaybackSettings({ autoPlayNext: checked })} />
        </section>
        <section style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>批改规则</h2>
          <SettingSwitch label="忽略大小写" checked={sessionSettings.gradingRules.ignoreCase} onChange={(checked) => updateGradingRules({ ignoreCase: checked })} />
          <SettingSwitch label="忽略首尾空格" checked={sessionSettings.gradingRules.trimWhitespace} onChange={(checked) => updateGradingRules({ trimWhitespace: checked })} />
          <SettingSwitch label="接受英美拼写差异" checked={sessionSettings.gradingRules.acceptUkUs} onChange={(checked) => updateGradingRules({ acceptUkUs: checked })} />
        </section>
      </div>
      <div className="toolbar-row"><span /><Button variant="primary" size="lg" onClick={() => navigate(closeUrl)}>应用</Button></div>
    </>
  );
}

export function DictationExitConfirmPage() {
  const navigate = useNavigate();
  const { sessionId = "5000" } = useParams();
  const sessions = usePracticeStore((state) => state.sessions);
  const abandonSession = usePracticeStore((state) => state.abandonSession);
  const session = sessions.find((item) => item.id === Number(sessionId));
  const mode = session?.mode ?? "typing";
  return (
    <EmptyState
      title="是否结束听写"
      description="结束听写后当前进度不保存"
      action={
        <div className="page-actions">
          <Button variant="secondary" onClick={() => navigate(`/practice/session/${sessionId}?mode=${mode}`)}>取消</Button>
          <Button
            variant="primary"
            onClick={() => {
              abandonSession(Number(sessionId));
              navigate("/practice/setup");
            }}
          >
            确定
          </Button>
        </div>
      }
    />
  );
}

export function DictationResultTypingPage() {
  const { sessionId = "5000" } = useParams();
  const navigate = useNavigate();
  const allResults = usePracticeStore((state) => state.results);
  const allWords = usePracticeStore((state) => state.words);
  const sessions = usePracticeStore((state) => state.sessions);
  const results = useMemo(() => allResults.filter((row) => row.sessionId === Number(sessionId)), [allResults, sessionId]);
  const session = useMemo(() => sessions.find((item) => item.id === Number(sessionId)), [sessionId, sessions]);
  const words = useMemo(() => allWords.filter((word) => results.some((row) => row.wordId === word.id)), [allWords, results]);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [pendingWrongBookWord, setPendingWrongBookWord] = useState<VocabularyWord | null>(null);
  const summary = summarizeResults(results, session?.durationSec ?? 0);
  const filteredResults = useMemo(() => filterDictationResults(results, filter), [filter, results]);
  const toggleFavorite = usePracticeStore((state) => state.toggleFavorite);
  const toggleWrongBook = usePracticeStore((state) => state.toggleWrongBook);
  const setPracticeSource = usePracticeStore((state) => state.setPracticeSource);
  const completeSession = usePracticeStore((state) => state.completeSession);
  const hasWrongResults = results.some((row) => row.result === "wrong" || row.result === "skipped" || row.result === "unmarked" || row.isAddedToWrongBook);
  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(-1)}>‹ {session?.sourceName ?? "听写记录"} / 听写记录 · 打字模式</button>
      <DictationResultSummary summary={summary} meta={resultSummaryMeta(session?.sourceName ?? "听写", "打字", session?.accent ?? "us", session?.completedAt ?? session?.createdAt)} />
      <div className="toolbar-row">
        <div className="chip-row">
          <Chip selected={filter === "all"} onClick={() => setFilter("all")}>全部</Chip>
          <Chip selected={filter === "correct"} onClick={() => setFilter("correct")}>正确</Chip>
          <Chip selected={filter === "wrong"} onClick={() => setFilter("wrong")}>错误</Chip>
          <Chip selected={filter === "wrong_book"} onClick={() => setFilter("wrong_book")}>已加错题本</Chip>
          <Chip selected={filter === "favorite"} onClick={() => setFilter("favorite")}>已收藏</Chip>
        </div>
        <Button variant="ghost" size="md" iconStart={<Icon name="download" />} onClick={() => void saveTextFile(`dictation-result-${sessionId}.csv`, exportHistoryCsv(results))}>导出结果</Button>
      </div>
      <DictationResultTable
        results={filteredResults}
        words={words}
        onFavorite={(wordId) => toggleFavorite(wordId)}
        onWrongBook={(word) => {
          if (word.inWrongBook) setPendingWrongBookWord(word);
          else toggleWrongBook(word.id);
        }}
      />
      <div className="result-action-bar">
        <p className="page-subtitle">完成听写后返回来源页</p>
        <div className="page-actions">
          <Button variant="secondary" size="lg" onClick={() => {
            setPracticeSource({ sourceType: "history_session", sourceId: Number(sessionId) });
            navigate(`/practice/setup?source_type=history_session&source_id=${sessionId}`);
          }}>重听全部</Button>
          <Button variant="danger" size="lg" disabled={!hasWrongResults} onClick={() => {
            setPracticeSource({ sourceType: "history_session", sourceId: Number(sessionId), filter: "wrong" });
            navigate(`/practice/setup?source_type=history_session&source_id=${sessionId}&filter=wrong`);
          }}>重听错词</Button>
          <Button variant="primary" size="lg" onClick={() => {
            if (session?.status !== "completed") completeSession(Number(sessionId));
            navigate("/history");
          }}>完成听写</Button>
        </div>
      </div>
      <NoticeDialog
        open={Boolean(pendingWrongBookWord)}
        title="是否移出错题本"
        description={pendingWrongBookWord ? `确认将「${pendingWrongBookWord.word}」移出错题本？` : ""}
        confirmText="确定"
        danger
        onConfirm={() => {
          if (pendingWrongBookWord) toggleWrongBook(pendingWrongBookWord.id);
          setPendingWrongBookWord(null);
        }}
        onClose={() => setPendingWrongBookWord(null)}
      />
    </>
  );
}

export function DictationResultPaperPage() {
  const navigate = useNavigate();
  const { sessionId = "5000" } = useParams();
  const allResults = usePracticeStore((state) => state.results);
  const allWords = usePracticeStore((state) => state.words);
  const sessions = usePracticeStore((state) => state.sessions);
  const markResult = usePracticeStore((state) => state.markResult);
  const markAllResults = usePracticeStore((state) => state.markAllResults);
  const completeSession = usePracticeStore((state) => state.completeSession);
  const toggleFavorite = usePracticeStore((state) => state.toggleFavorite);
  const toggleWrongBook = usePracticeStore((state) => state.toggleWrongBook);
  const results = useMemo(() => allResults.filter((row) => row.sessionId === Number(sessionId)), [allResults, sessionId]);
  const words = useMemo(() => allWords.filter((word) => results.some((row) => row.wordId === word.id)), [allWords, results]);
  const session = useMemo(() => sessions.find((item) => item.id === Number(sessionId)), [sessionId, sessions]);
  const summary = summarizeResults(results, session?.durationSec ?? 0);
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [pendingWrongBookWord, setPendingWrongBookWord] = useState<VocabularyWord | null>(null);
  return (
    <>
      <DictationResultSummary summary={summary} meta={resultSummaryMeta(session?.sourceName ?? "听写", "纸笔", session?.accent ?? "us", session?.completedAt ?? session?.createdAt)} />
      <div className="toolbar-row">
        <div className="page-actions">
          <Button variant="primary" size="md" onClick={() => markAllResults(Number(sessionId), "correct")}>全部正确</Button>
          <Button variant="secondary" size="md" onClick={() => markAllResults(Number(sessionId), "wrong")}>全部错误</Button>
          <Button variant="ghost" size="md" onClick={() => markAllResults(Number(sessionId), "unmarked")}>清空</Button>
        </div>
      </div>
      <PaperGradingTable
        results={results}
        words={words}
        onFavorite={(wordId) => toggleFavorite(wordId)}
        onWrongBook={(word) => {
          if (word.inWrongBook) setPendingWrongBookWord(word);
          else toggleWrongBook(word.id);
        }}
        onMark={(resultId, result) => markResult(Number(sessionId), resultId, result)}
      />
      <div className="toolbar-row">
        <span />
        <div className="page-actions">
          <Button variant="secondary" size="lg" onClick={() => setSkipConfirmOpen(true)}>跳过批改</Button>
          <Button variant="primary" size="lg" onClick={() => { completeSession(Number(sessionId)); navigate("/history"); }}>保存批改</Button>
        </div>
      </div>
      <NoticeDialog
        open={skipConfirmOpen}
        title="是否跳出批改"
        description=""
        confirmText="确定"
        onConfirm={() => {
          completeSession(Number(sessionId));
          setSkipConfirmOpen(false);
          navigate("/history");
        }}
        onClose={() => setSkipConfirmOpen(false)}
      />
      <NoticeDialog
        open={Boolean(pendingWrongBookWord)}
        title="是否移出错题本"
        description={pendingWrongBookWord ? `确认将「${pendingWrongBookWord.word}」移出错题本？` : ""}
        confirmText="确定"
        danger
        onConfirm={() => {
          if (pendingWrongBookWord) toggleWrongBook(pendingWrongBookWord.id);
          setPendingWrongBookWord(null);
        }}
        onClose={() => setPendingWrongBookWord(null)}
      />
    </>
  );
}

