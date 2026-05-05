import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import type { DictionaryEntry } from "@dictation/domain";
import { Button, Dialog, Icon, Input, NoticeDialog, SearchBar, Textarea } from "@dictation/ui";
import { buildImportPreview, type ImportPreviewRow } from "@dictation/import-export";
import { useUiStore } from "../stores/ui-store";
import { clearDesktopCache, queryDesktopDatabase, selectDesktopImportFile } from "../services/desktop-bridge";

export function DialogHost() {
  const navigate = useNavigate();
  const dialog = useUiStore((state) => state.dialog);
  const openDialog = useUiStore((state) => state.openDialog);
  const closeDialog = useUiStore((state) => state.closeDialog);
  const createLibrary = useUiStore((state) => state.createLibrary);
  const clearAllData = useUiStore((state) => state.clearAllData);
  const importWords = useUiStore((state) => state.importWords);
  const words = useUiStore((state) => state.words);
  const dictionary = useUiStore((state) => state.dictionary);
  const libraries = useUiStore((state) => state.libraries);
  const selectedLibraryId = useUiStore((state) => state.selectedLibraryId);
  const setSelectedLibraryId = useUiStore((state) => state.setSelectedLibraryId);
  const pendingAddWordId = useUiStore((state) => state.pendingAddWordId);
  const setPendingAddWordId = useUiStore((state) => state.setPendingAddWordId);
  const pendingAddDictionaryEntry = useUiStore((state) => state.pendingAddDictionaryEntry);
  const setPendingAddDictionaryEntry = useUiStore((state) => state.setPendingAddDictionaryEntry);
  const deleteWord = useUiStore((state) => state.deleteWord);
  const [libraryName, setLibraryName] = useState("");
  const [libraryTags, setLibraryTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [coverColor, setCoverColor] = useState<string>(coverColors[1].value);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 80);
  const [candidateState, setCandidateState] = useState<{ query: string; entries: DictionaryEntry[] }>({ query: "", entries: [] });
  const [pendingRemoveFromAdd, setPendingRemoveFromAdd] = useState<{ wordId: number; word: string; libraryName: string } | null>(null);
  const [targetMenuOpen, setTargetMenuOpen] = useState(false);
  const [importTargetMenuOpen, setImportTargetMenuOpen] = useState(false);
  const targetMenuRef = useRef<HTMLDivElement>(null);
  const importTargetMenuRef = useRef<HTMLDivElement>(null);
  const [customWord, setCustomWord] = useState("");
  const [customMeaning, setCustomMeaning] = useState("");
  const [importText, setImportText] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importPreviewRows, setImportPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [importFailureReason, setImportFailureReason] = useState("文件为空、格式不支持或解析错误。");
  const [importTargetLibraryId, setImportTargetLibraryId] = useState<number | null>(null);
  const [lastImportTargetLibraryId, setLastImportTargetLibraryId] = useState<number | null>(null);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [cacheClearResult, setCacheClearResult] = useState<{ removedFiles: number; removedBytes: number } | null>(null);
  const importablePreviewRows = importPreviewRows.filter((row) => row.word && row.action === "add" && row.status !== "error");
  const importTargetLibraries = libraries.filter((library) => library.type === "custom" || library.type === "official");
  const defaultImportTargetLibraryId =
    importTargetLibraries.find((library) => library.id === selectedLibraryId)?.id ??
    importTargetLibraries.find((library) => library.type === "custom")?.id ??
    importTargetLibraries[0]?.id ??
    null;
  const resolvedImportTargetLibraryId = importTargetLibraries.some((library) => library.id === importTargetLibraryId)
    ? importTargetLibraryId
    : defaultImportTargetLibraryId;
  const importTargetLibrary = importTargetLibraries.find((library) => library.id === resolvedImportTargetLibraryId);
  useEffect(() => {
    const needsDictionarySearch = dialog === "add-word-search" || (dialog === "add-word-select-library" && pendingAddWordId == null);
    const trimmedQuery = debouncedQuery.trim();
    if (!needsDictionarySearch || !trimmedQuery) return;
    let cancelled = false;
    const fallbackCandidates = () =>
      uniqueDictionaryEntries(
        dictionary.filter((entry) => entry.word.toLowerCase().includes(trimmedQuery.toLowerCase()) || entry.meaningCn.includes(trimmedQuery)),
      ).slice(0, 20);
    void queryDesktopDatabase<DictionaryEntry[]>({ resource: "dictionary-search", query: trimmedQuery, limit: 20 })
      .then((rows) => {
        if (!cancelled) setCandidateState({ query: trimmedQuery, entries: rows ? uniqueDictionaryEntries(rows) : fallbackCandidates() });
      })
      .catch(() => {
        if (!cancelled) setCandidateState({ query: trimmedQuery, entries: fallbackCandidates() });
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, dialog, pendingAddWordId, dictionary]);
  useEffect(() => {
    if (!targetMenuOpen) return;
    const closeTargetMenu = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && targetMenuRef.current?.contains(target)) return;
      setTargetMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeTargetMenu);
    return () => document.removeEventListener("pointerdown", closeTargetMenu);
  }, [targetMenuOpen]);
  useEffect(() => {
    if (!importTargetMenuOpen) return;
    const closeImportTargetMenu = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && importTargetMenuRef.current?.contains(target)) return;
      setImportTargetMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeImportTargetMenu);
    return () => document.removeEventListener("pointerdown", closeImportTargetMenu);
  }, [importTargetMenuOpen]);
  const addTag = () => {
    const trimmed = tagDraft.trim();
    if (!trimmed || libraryTags.includes(trimmed)) return;
    setLibraryTags((tags) => [...tags, trimmed].slice(0, 8));
    setTagDraft("");
  };
  const handleCreateLibrary = () => {
    createLibrary({ name: libraryName, tags: libraryTags, coverColor });
    setLibraryName("");
    setLibraryTags([]);
    setTagDraft("");
    setCoverColor(coverColors[1].value);
  };
  const showImportFailure = (reason: string) => {
    setImportFailureReason(reason);
    openDialog("import-failed");
  };
  const existingWordsForImportTarget = (targetLibraryId: number | null | undefined) =>
    targetLibraryId == null ? [] : words.filter((word) => word.libraryId === targetLibraryId).map((word) => word.word);
  const buildTargetImportPreview = (text: string, targetLibraryId = resolvedImportTargetLibraryId) =>
    buildImportPreview(text, existingWordsForImportTarget(targetLibraryId));
  const prepareImportPreview = (text: string, fileName = "", targetLibraryId = resolvedImportTargetLibraryId) => {
    const nextRows = buildTargetImportPreview(text, targetLibraryId);
    const hasImportableRows = nextRows.some((row) => row.word && row.status !== "error" && row.action === "add");
    flushSync(() => {
      setImportText(text);
      setImportFileName(fileName);
      setImportPreviewRows(nextRows);
      setImportFailureReason("文件为空、格式不支持或解析错误。");
    });
    if (!text.trim()) {
      showImportFailure("文件为空或没有可读取的文本内容。");
      return false;
    }
    if (!hasImportableRows) {
      showImportFailure("未识别到可导入的单词。请确认第一列是单词，第二列是释义。");
      return false;
    }
    return true;
  };
  const handleSelectImportFile = async () => {
    try {
      const selected = await selectDesktopImportFile();
      if (!selected) return;
      if (!selected.ok) {
        showImportFailure(`文件读取失败：${selected.error}`);
        return;
      }
      if (prepareImportPreview(selected.text, selected.fileName)) openDialog("import-preview");
    } catch (error) {
      console.error("Failed to read import file", error);
      showImportFailure(`文件读取失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const handleManualImportPreview = () => {
    if (prepareImportPreview(importText)) openDialog("import-preview");
  };
  const handleConfirmImport = async () => {
    if (!resolvedImportTargetLibraryId || importSubmitting) return;
    setImportSubmitting(true);
    setLastImportTargetLibraryId(resolvedImportTargetLibraryId);
    const ok = await importWords(importablePreviewRows, resolvedImportTargetLibraryId);
    setImportSubmitting(false);
    if (!ok) showImportFailure("导入写入失败，请重试。");
  };
  const closeAddWordDialog = () => {
    setQuery("");
    setCandidateState({ query: "", entries: [] });
    setPendingRemoveFromAdd(null);
    setTargetMenuOpen(false);
    closeDialog();
  };
  if (dialog === "create-library") {
    return (
      <Dialog
        open
        title="新建词库"
        onClose={closeDialog}
        showClose={false}
        footer={
          <>
            <Button variant="secondary" size="dialog" onClick={closeDialog}>取消</Button>
            <Button variant="primary" size="dialog" disabled={!libraryName.trim()} onClick={handleCreateLibrary}>创建</Button>
          </>
        }
      >
        <div className="form-field"><label htmlFor="create-library-name">词库名称</label><Input id="create-library-name" value={libraryName} onChange={(event) => setLibraryName(event.target.value)} /></div>
        <div className="form-field">
          <label>标签（可选）</label>
          <div className="editable-tag-list">
            {libraryTags.map((tag, index) => (
              <span className="editable-tag" key={`${tag}-${index}`}>
                <input
                  aria-label={`标签 ${index + 1}`}
                  value={tag}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setLibraryTags((tags) => tags.map((item, itemIndex) => (itemIndex === index ? nextValue : item)));
                  }}
                  onBlur={() => setLibraryTags((tags) => tags.map((item) => item.trim()).filter(Boolean))}
                />
                <button type="button" aria-label={`删除标签 ${tag}`} onClick={() => setLibraryTags((tags) => tags.filter((_, itemIndex) => itemIndex !== index))}>
                  ×
                </button>
              </span>
            ))}
            <input
              className="tag-draft-input"
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder="输入标签"
            />
            <button type="button" className="tag-add-button" disabled={!tagDraft.trim()} onClick={addTag}>添加</button>
          </div>
        </div>
        <div className="form-field">
          <label>封面颜色</label>
          <div className="color-swatch-row">
            {coverColors.map((color) => (
              <button
                key={color.value}
                type="button"
                aria-label={color.label}
                className={`color-swatch ${color.value === coverColor ? "is-selected" : ""}`}
                style={{ background: color.value }}
                onClick={() => setCoverColor(color.value)}
              >
                {color.value === coverColor ? "✓" : ""}
              </button>
            ))}
          </div>
        </div>
      </Dialog>
    );
  }
  if (dialog === "add-word-select-library" && (pendingAddWordId != null || pendingAddDictionaryEntry != null)) {
    const pendingWord = words.find((word) => word.id === pendingAddWordId);
    const entry = pendingAddDictionaryEntry;
    const sourceWord = pendingWord
      ? {
          word: pendingWord.word,
          meaning: pendingWord.meaning,
          partOfSpeech: pendingWord.partOfSpeech,
        }
      : entry
        ? {
            word: entry.word,
            meaning: entry.meaningCn,
            partOfSpeech: entry.partOfSpeech,
          }
        : null;
    const candidateLibraries = libraries.filter((library) => library.type === "custom" || library.type === "official");
    const addPendingWord = (libraryId: number) => {
      if (!sourceWord) return;
      setLastImportTargetLibraryId(libraryId);
      void importWords(
        [
          {
            tempId: pendingWord ? `word_${pendingWord.id}` : `entry_${entry?.id ?? sourceWord.word}`,
            rowIndex: 1,
            word: sourceWord.word,
            meaning: sourceWord.meaning,
            partOfSpeech: sourceWord.partOfSpeech,
            status: "matched",
            action: "add",
          },
        ],
        libraryId,
      );
      setPendingAddWordId(null);
      setPendingAddDictionaryEntry(null);
    };
    return (
      <>
        <Dialog open title="加入词库" onClose={closeDialog} large>
          <p className="dialog-subtitle">{sourceWord ? `选择要加入「${sourceWord.word}」的词库。` : "未找到当前单词。"}</p>
          <div className="library-picker-list">
            {candidateLibraries.map((library) => {
              const existingWord = sourceWord
                ? words.find((word) => word.libraryId === library.id && word.word.toLowerCase() === sourceWord.word.toLowerCase())
                : undefined;
              const exists = Boolean(existingWord);
              return (
                <button
                  type="button"
                  className="library-picker-row"
                  key={library.id}
                  disabled={!sourceWord}
                  onClick={() => {
                    if (exists && existingWord) {
                      setPendingRemoveFromAdd({
                        wordId: existingWord.id,
                        word: existingWord.word,
                        libraryName: library.name,
                      });
                      return;
                    }
                    addPendingWord(library.id);
                  }}
                >
                  <span className="library-picker-cover" style={{ background: library.coverColor ?? "var(--accent-primary)" }} />
                  <span>
                    <strong>{library.name}</strong>
                    <span>{library.wordCount.toLocaleString()} 词</span>
                  </span>
                  <em>{exists ? "已在词库" : "加入"}</em>
                </button>
              );
            })}
          </div>
        </Dialog>
        <NoticeDialog
          open={Boolean(pendingRemoveFromAdd)}
          title="是否移出词库"
          description={pendingRemoveFromAdd ? `确认将「${pendingRemoveFromAdd.word}」从「${pendingRemoveFromAdd.libraryName}」中移出？\n该操作不会删除词典中的词条。` : ""}
          danger
          confirmText="确认"
          onConfirm={() => {
            if (pendingRemoveFromAdd) deleteWord(pendingRemoveFromAdd.wordId);
            setPendingRemoveFromAdd(null);
          }}
          onClose={() => setPendingRemoveFromAdd(null)}
        />
      </>
    );
  }
  if (dialog === "add-word-search" || dialog === "add-word-select-library") {
    const activeQuery = query.trim();
    const trimmedQuery = activeQuery.toLowerCase();
    const visibleCandidates = activeQuery && candidateState.query === activeQuery ? candidateState.entries : [];
    const targetLibraries = libraries.filter((library) => library.type === "custom" || library.type === "official");
    const targetLibraryId = selectedLibraryId ?? libraries.find((library) => library.type === "custom")?.id ?? libraries.find((library) => library.type === "official")?.id;
    const targetLibrary = libraries.find((library) => library.id === targetLibraryId);
    const existingWords = new Set(words.filter((word) => word.libraryId === targetLibraryId).map((word) => word.word.toLowerCase()));
    const addCandidate = (entry: DictionaryEntry) =>
      importWords(
        [
          {
            tempId: `entry_${entry.id}`,
            rowIndex: 1,
            word: entry.word,
            meaning: entry.meaningCn,
            partOfSpeech: entry.partOfSpeech,
            status: "matched",
            action: "add",
          },
        ],
        targetLibraryId,
        { silent: true },
      );
    return (
      <>
      <Dialog open title="添加单词到词库" onClose={closeAddWordDialog} large>
        <p className="dialog-subtitle">输入英文或中文关键词，从全局词典导入完整词条信息。</p>
        <div className="add-word-search-row">
          <SearchBar variant="dialog" value={query} onChange={setQuery} placeholder="搜索单词" />
          <div className="library-select-wrap" ref={targetMenuRef}>
            <button type="button" className="library-select-button" onClick={() => setTargetMenuOpen((open) => !open)}>
              <span>{targetLibrary?.name ?? "选择词库"}</span>
              <Icon name="chevronDown" size={14} />
            </button>
            {targetMenuOpen ? (
              <div className="library-select-menu">
                {targetLibraries.map((library) => (
                  <button
                    type="button"
                    key={library.id}
                    className={library.id === targetLibraryId ? "is-selected" : ""}
                    onClick={() => {
                      setSelectedLibraryId(library.id);
                      setTargetMenuOpen(false);
                    }}
                  >
                    <span>{library.name}</span>
                    <small>{library.wordCount.toLocaleString()} 词</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="add-word-status-row">
          <span className="chip is-selected">候选结果 {visibleCandidates.length}</span>
          <span className="chip">目标词库：{targetLibrary?.name ?? "未选择"}</span>
        </div>
        <div className="dictionary-candidate-list">
          {visibleCandidates.length ? (
            visibleCandidates.map((entry) => {
              const existingWord = words.find((word) => word.libraryId === targetLibraryId && word.word.toLowerCase() === entry.word.toLowerCase());
              const exists = existingWords.has(entry.word.toLowerCase());
              return (
                <div className="dictionary-candidate-row" key={entry.id}>
                  <strong>{entry.word}</strong>
                  <span>{entry.partOfSpeech ? `${entry.partOfSpeech} ` : ""}{entry.meaningCn}</span>
                  <Button
                    variant={exists ? "secondary" : "primary"}
                    size="sm"
                    disabled={!targetLibraryId}
                    onClick={() => {
                      if (exists && existingWord) {
                        setPendingRemoveFromAdd({
                          wordId: existingWord.id,
                          word: existingWord.word,
                          libraryName: targetLibrary?.name ?? "目标词库",
                        });
                        return;
                      }
                      addCandidate(entry);
                    }}
                  >
                    {exists ? "已在词库" : "添加"}
                  </Button>
                </div>
              );
            })
          ) : (
            <div className="dictionary-candidate-empty">
              <strong>{trimmedQuery ? "无匹配结果" : "输入单词后显示匹配结果"}</strong>
              {trimmedQuery ? <Button variant="primary" size="sm" onClick={() => openDialog("create-word")}>手动创建词条</Button> : null}
            </div>
          )}
        </div>
      </Dialog>
      <NoticeDialog
        open={Boolean(pendingRemoveFromAdd)}
        title="移出单词"
        description={pendingRemoveFromAdd ? `确认将「${pendingRemoveFromAdd.word}」从「${pendingRemoveFromAdd.libraryName}」中移出？\n该操作不会删除词典中的词条。` : ""}
        danger
        confirmText="移出"
        onConfirm={() => {
          if (pendingRemoveFromAdd) deleteWord(pendingRemoveFromAdd.wordId);
          setPendingRemoveFromAdd(null);
        }}
        onClose={() => setPendingRemoveFromAdd(null)}
      />
      </>
    );
  }
  if (dialog === "create-word" || dialog === "create-word-required") {
    return (
      <Dialog
        open
        title="创建词条"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="secondary" size="dialog" onClick={closeDialog}>取消</Button>
            <Button
              variant="primary"
              size="dialog"
              onClick={() =>
                importWords([
                  {
                    tempId: "custom_word",
                    rowIndex: 1,
                    word: customWord,
                    meaning: customMeaning,
                    status: customWord && customMeaning ? "matched" : "error",
                    errorMessage: customWord && customMeaning ? undefined : "缺少单词或释义",
                    action: "add",
                  },
                ])
              }
            >
              保存
            </Button>
          </>
        }
      >
        <div className="form-field"><label>单词</label><Input value={customWord} onChange={(event) => setCustomWord(event.target.value)} placeholder="custom word" /></div>
        <div className="form-field"><label>释义</label><Textarea value={customMeaning} onChange={(event) => setCustomMeaning(event.target.value)} placeholder="中文释义" /></div>
      </Dialog>
    );
  }
  if (dialog === "import-file") {
    return (
      <Dialog
        open
        title="导入单词"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="secondary" size="dialog" onClick={closeDialog}>取消</Button>
            <Button variant="primary" size="dialog" disabled={!importText.trim() || !resolvedImportTargetLibraryId} onClick={handleManualImportPreview}>预览导入</Button>
          </>
        }
      >
        <div className="import-file-toolbar">
          <Button variant="secondary" size="md" onClick={handleSelectImportFile}>选择文件</Button>
          <div className="library-select-wrap import-target-select" ref={importTargetMenuRef}>
            <button
              type="button"
              className="library-select-button import-target-button"
              disabled={!importTargetLibraries.length}
              onClick={() => setImportTargetMenuOpen((open) => !open)}
            >
              <span>{importTargetLibrary?.name ?? "选择目标词库"}</span>
              <Icon name="chevronDown" size={14} />
            </button>
            {importTargetMenuOpen ? (
              <div className="library-select-menu import-target-menu">
                {importTargetLibraries.map((library) => (
                  <button
                    type="button"
                    key={library.id}
                    className={library.id === resolvedImportTargetLibraryId ? "is-selected" : ""}
                    onClick={() => {
                      setImportTargetLibraryId(library.id);
                      if (importText.trim()) setImportPreviewRows(buildTargetImportPreview(importText, library.id));
                      setImportTargetMenuOpen(false);
                    }}
                  >
                    <span>{library.name}</span>
                    <small>{library.wordCount.toLocaleString()} 词</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <Textarea
          value={importText}
          onChange={(event) => {
            setImportText(event.target.value);
            setImportFileName("");
            setImportPreviewRows([]);
          }}
          placeholder={"word,meaning\napple,苹果\nlearn 学习；认识到；得知"}
        />
        <p className="page-subtitle import-format-hint">
          <span>支持 CSV / TXT / XLSX。</span>
          <span>格式：word,meaning 或 单词,释义；也可用逗号或空格分隔。</span>
        </p>
      </Dialog>
    );
  }
  if (dialog === "import-preview") {
    return (
      <Dialog open title="导入预览" onClose={closeDialog} large footer={<><Button variant="secondary" size="dialog" onClick={closeDialog}>取消</Button><Button variant="primary" size="dialog" disabled={!importablePreviewRows.length || !resolvedImportTargetLibraryId || importSubmitting} onClick={handleConfirmImport}>{importSubmitting ? "导入中" : "确认导入"}</Button></>}>
        <p className="dialog-subtitle">
          导入到 {importTargetLibrary?.name ?? "目标词库"}{importFileName ? ` · ${importFileName}` : ""}
        </p>
        <div className="word-table">
          {importPreviewRows.map((row) => (
            <div className="word-row" key={row.tempId} style={{ gridTemplateColumns: "80px 160px 1fr 120px" }}>
              <span>{row.rowIndex}</span><span>{row.word}</span><span>{row.meaning}</span><span>{row.status}</span>
            </div>
          ))}
        </div>
      </Dialog>
    );
  }
  if (dialog === "clear-cache") {
    return (
      <NoticeDialog
        open
        title="清除缓存"
        description={
          cacheClearResult
            ? `已清除 ${cacheClearResult.removedFiles} 个缓存文件，释放 ${formatBytes(cacheClearResult.removedBytes)}。`
            : "只清除临时文件和音频缓存，不会删除词库、历史和设置。"
        }
        danger={!cacheClearResult}
        confirmText={cacheClearResult ? "完成" : "确认清除"}
        onConfirm={() => {
          if (cacheClearResult) {
            setCacheClearResult(null);
            closeDialog();
            return;
          }
          void clearDesktopCache().then((result) => setCacheClearResult(result ?? { removedFiles: 0, removedBytes: 0 }));
        }}
        onClose={() => {
          setCacheClearResult(null);
          closeDialog();
        }}
      />
    );
  }
  if (dialog === "clear-data") {
    return (
      <NoticeDialog
        open
        title="清空数据"
        description="将删除所有数据，包括词库、错题本、收藏夹、历史记录。"
        danger
        confirmText="确定"
        cancelText="取消"
        onConfirm={clearAllData}
        onClose={closeDialog}
      />
    );
  }
  if (dialog === "delete-confirm" || dialog === "delete-word" || dialog === "delete-history") {
    return <NoticeDialog open title="确认删除" description="删除后不可恢复，请确认是否继续。" danger confirmText="删除" onConfirm={closeDialog} onClose={closeDialog} />;
  }
  if (dialog === "already-in-library") {
    return <NoticeDialog open title="已在词库中" description="该单词已经存在于目标词库。" confirmText="知道了" onConfirm={closeDialog} onClose={closeDialog} />;
  }
  if (dialog === "import-success") {
    return (
      <NoticeDialog
        open
        title="导入成功"
        description="单词已经导入目标词库。"
        cancelText="查看词库"
        confirmText="确定"
        onConfirm={closeDialog}
        onClose={() => {
          closeDialog();
          navigate(lastImportTargetLibraryId ? `/library/${lastImportTargetLibraryId}` : selectedLibraryId ? `/library/${selectedLibraryId}` : "/library");
        }}
      />
    );
  }
  if (dialog === "import-failed") {
    return <NoticeDialog open title="导入失败" description={importFailureReason} danger confirmText="重试" onConfirm={() => openDialog("import-file")} onClose={() => openDialog("import-file")} />;
  }
  if (dialog === "export-failed") {
    return <NoticeDialog open title="导出失败" description="未找到例句署名文件，请确认应用数据完整。" danger confirmText="确定" onConfirm={closeDialog} onClose={closeDialog} />;
  }
  return null;
}

const coverColors = [
  { label: "红色", value: "#C95F52" },
  { label: "橙色", value: "#D4916E" },
  { label: "黄色", value: "#E0B85A" },
  { label: "绿色", value: "#7DA37E" },
  { label: "青色", value: "#6FAFB0" },
  { label: "蓝色", value: "#6E8FB8" },
  { label: "紫色", value: "#9A7BB8" },
] as const;

function uniqueDictionaryEntries(entries: DictionaryEntry[]): DictionaryEntry[] {
  const seen = new Set<string>();
  const unique: DictionaryEntry[] = [];
  for (const entry of entries) {
    const key = entry.word.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(entry);
  }
  return unique;
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);
  return debouncedValue;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
