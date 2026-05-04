import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { VocabularyWord } from "@dictation/domain";
import { Button, Chip, EmptyLibraryCard, EmptyState, Icon, LibraryCard, NoticeDialog, SearchBar, WordTable } from "@dictation/ui";
import { useLibraryStore } from "../stores/library-store";
import { officialLibraryLabel } from "../services/library-display";

export function LibraryShelfPage() {
  const navigate = useNavigate();
  const [shelfFilter, setShelfFilter] = useState<"all" | "custom">("all");
  const libraries = useLibraryStore((state) => state.libraries);
  const words = useLibraryStore((state) => state.words);
  const openDialog = useLibraryStore((state) => state.openDialog);
  const system = libraries.filter((library) => library.type === "wrong_book" || library.type === "favorite");
  const shelf = libraries.filter((library) => library.type === "official" || library.type === "custom");
  const visibleShelf = shelfFilter === "custom" ? shelf.filter((library) => library.type === "custom") : shelf;
  const totalWords = shelf.reduce((sum, library) => sum + library.wordCount, 0);
  const wrongBookCount = dedupeWordsByIdentity(words.filter((word) => word.inWrongBook || word.wrongCount > 0)).length;
  const favoriteCount = dedupeWordsByIdentity(words.filter((word) => word.isFavorite)).length;
  return (
    <>
      <header className="page-topbar">
        <div>
          <h1 className="page-title">我的词库</h1>
          <p className="page-subtitle">{shelf.length} 个词库 · {totalWords.toLocaleString()} 个单词</p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" size="sm" onClick={() => navigate("/library/edit")}>编辑</Button>
          <Button variant="ghost" size="sm" iconStart={<Icon name="upload" />} onClick={() => openDialog("import-file")}>导入词库</Button>
          <Button variant="primary" size="sm" iconStart={<Icon name="plus" />} onClick={() => openDialog("create-library")}>新建词库</Button>
        </div>
      </header>
      <section className="system-card-row">
        {system.map((library) => (
          <LibraryCard
            key={library.id}
            action={<Button variant="primary" size="sm">{library.type === "favorite" ? "查看" : "去复习 →"}</Button>}
            library={{
              id: library.id,
              type: library.type,
              title: library.name,
              subtitle: `${library.type === "favorite" ? favoriteCount : wrongBookCount} 词 · ${library.description}`,
              wordCount: library.type === "favorite" ? favoriteCount : wrongBookCount,
              coverColor: library.coverColor,
            }}
            onClick={() => navigate(library.type === "favorite" ? "/favorites" : "/wrong-book")}
          />
        ))}
      </section>
      <div className="toolbar-row">
        <h2 style={{ margin: 0, fontSize: 22 }}>我的书架 <span style={{ color: "var(--foreground-tertiary)", fontSize: 13 }}>{visibleShelf.length} 个词库</span></h2>
        <div className="chip-row">
          <Chip selected={shelfFilter === "all"} onClick={() => setShelfFilter("all")}>全部</Chip>
          <Chip selected={shelfFilter === "custom"} onClick={() => setShelfFilter("custom")}>自建</Chip>
        </div>
      </div>
      <section className="library-grid">
        {visibleShelf.map((library) => (
          <LibraryCard
            key={library.id}
            library={{
              id: library.id,
              type: library.type,
              label: library.type === "official" ? officialLibraryLabel() : "MY LIST · 自建",
              title: library.name,
              subtitle: library.description,
              wordCount: library.wordCount,
              progress: library.progress,
              coverColor: library.coverColor,
            }}
            onClick={() => navigate(`/library/${library.id}`)}
          />
        ))}
        <EmptyLibraryCard onClick={() => openDialog("create-library")} />
      </section>
    </>
  );
}

export function LibraryEditPage() {
  const navigate = useNavigate();
  const libraries = useLibraryStore((state) => state.libraries);
  const deleteCustomLibrary = useLibraryStore((state) => state.deleteCustomLibrary);
  const reorderLibraries = useLibraryStore((state) => state.reorderLibraries);
  const openDialog = useLibraryStore((state) => state.openDialog);
  const editableLibraries = libraries.filter((library) => library.type === "official" || library.type === "custom");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const selectedCustomIds = selectedIds.filter((id) => libraries.find((library) => library.id === id)?.type === "custom");
  const pendingDeleteNames = pendingDeleteIds
    .map((id) => libraries.find((library) => library.id === id)?.name)
    .filter(Boolean)
    .join("、");
  const moveLibrary = (targetId: number) => {
    if (draggingId == null || draggingId === targetId) return;
    const ids = editableLibraries.map((library) => library.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const nextIds = ids.slice();
    const [moved] = nextIds.splice(from, 1);
    nextIds.splice(to, 0, moved);
    reorderLibraries(nextIds);
  };
  return (
    <>
      <div className="library-edit-page">
        <header className="library-edit-header">
          <div>
            <h1 className="page-title">我的词库</h1>
            <p className="page-subtitle">编辑模式</p>
          </div>
          <Button variant="primary" size="md" onClick={() => navigate("/library")}>完成</Button>
        </header>
        <section className="library-edit-batch-bar">
          <span>已选择 {selectedIds.length} 个词库 · 拖动卡片可调整顺序</span>
          <Button
            variant="danger"
            size="md"
            iconStart={<Icon name="trash" />}
            disabled={!selectedCustomIds.length}
            onClick={() => setPendingDeleteIds(selectedCustomIds)}
          >
            删除
          </Button>
        </section>
        <section className="library-edit-grid">
          {editableLibraries.map((library) => (
            <button
              type="button"
              key={library.id}
              draggable
              className={`library-edit-card ${selectedIds.includes(library.id) ? "is-selected" : ""} ${draggingId === library.id ? "is-dragging" : ""}`}
              onDragStart={(event) => {
                setDraggingId(library.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(library.id));
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                moveLibrary(library.id);
                setDraggingId(null);
              }}
              onDragEnd={() => setDraggingId(null)}
              onClick={() => setSelectedIds((ids) => (ids.includes(library.id) ? ids.filter((id) => id !== library.id) : [...ids, library.id]))}
            >
              <Icon name="list" size={20} />
              <span className="library-edit-check">{selectedIds.includes(library.id) ? <Icon name="check" size={16} /> : null}</span>
              <span className="library-label">{library.type === "custom" ? "自定义" : officialLibraryLabel()}</span>
              <strong>{library.name}</strong>
              <small>{library.description ?? `${library.wordCount.toLocaleString()} 词`}</small>
            </button>
          ))}
          <button type="button" className="library-edit-card library-edit-create" onClick={() => openDialog("create-library")}>
            <Icon name="plus" size={34} />
            <strong>新建词库</strong>
          </button>
        </section>
      </div>
      <NoticeDialog
        open={pendingDeleteIds.length > 0}
        title="删除词库？"
        description={pendingDeleteNames ? `确认删除「${pendingDeleteNames}」？\n删除后不可恢复，词库内单词也会被移除。` : "确认删除选中的自建词库？"}
        danger
        confirmText="删除"
        onConfirm={() => {
          pendingDeleteIds.forEach((id) => deleteCustomLibrary(id));
          setSelectedIds((ids) => ids.filter((id) => !pendingDeleteIds.includes(id)));
          setPendingDeleteIds([]);
        }}
        onClose={() => setPendingDeleteIds([])}
      />
    </>
  );
}

export function LibraryDetailPage() {
  const { libraryId = "10" } = useParams();
  const navigate = useNavigate();
  const [wordFilter, setWordFilter] = useState<"all" | "mastered" | "wrong">("all");
  const [sortField, setSortField] = useState<"word" | "added" | "mastery" | "wrong">("word");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [openMenu, setOpenMenu] = useState<"field" | "order" | null>(null);
  const [detailSearch, setDetailSearch] = useState("");
  const debouncedDetailSearch = useDebouncedValue(detailSearch, 80);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [detailSearchOpen, setDetailSearchOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<VocabularyWord | null>(null);
  const sortControlsRef = useRef<HTMLDivElement>(null);
  const detailSearchRef = useRef<HTMLDivElement>(null);
  const library = useLibraryStore((state) => state.libraries.find((item) => item.id === Number(libraryId)));
  const allWords = useLibraryStore((state) => state.words);
  const setSelectedLibraryId = useLibraryStore((state) => state.setSelectedLibraryId);
  const deleteWord = useLibraryStore((state) => state.deleteWord);
  const words = useMemo(() => allWords.filter((word) => word.libraryId === Number(libraryId)), [allWords, libraryId]);
  const masteredCount = words.filter((word) => word.masteryLevel >= 10).length;
  const wrongCount = words.filter((word) => word.inWrongBook || word.wrongCount > 0).length;
  const visibleWords = useMemo(
    () => sortWords(searchWords(filterWords(words, wordFilter), appliedSearch), sortField, sortOrder),
    [appliedSearch, sortField, sortOrder, wordFilter, words],
  );
  const detailSearchResults = useMemo(() => {
    const query = debouncedDetailSearch.trim().toLowerCase();
    if (!query) return [];
    return uniqueWords(words.filter((word) => word.word.toLowerCase().includes(query) || word.meaning.includes(debouncedDetailSearch.trim()))).slice(0, 30);
  }, [debouncedDetailSearch, words]);
  const setPracticeSource = useLibraryStore((state) => state.setPracticeSource);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const openDialog = useLibraryStore((state) => state.openDialog);
  useEffect(() => {
    if (!openMenu && !detailSearchOpen) return;
    const closeMenu = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && sortControlsRef.current?.contains(target)) return;
      if (target && detailSearchRef.current?.contains(target)) return;
      setOpenMenu(null);
      setDetailSearchOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [detailSearchOpen, openMenu]);
  if (!library) return <EmptyState title="未找到词库" description="这个词库可能已经被删除。" action={<Button onClick={() => navigate("/library")}>返回书架</Button>} />;
  if (!words.length) return <LibraryDetailEmptyPage />;
  return (
    <>
      <button type="button" className="back-link" onClick={() => navigate(-1)}>‹ 我的词库 / {library.name}</button>
      <section style={{ display: "flex", alignItems: "center", gap: 22, minHeight: 160, padding: 22, borderRadius: 14, background: library.coverColor ?? "var(--accent-primary)", color: "var(--foreground-inverse)", marginBottom: 22 }}>
        <div style={{ width: 116, height: 116, borderRadius: 12, background: "rgba(0,0,0,.12)" }} />
        <div>
          <h1 className="page-title">{library.name}</h1>
          <p>{library.wordCount.toLocaleString()} 词 · 已掌握 {masteredCount.toLocaleString()} · 错词 {wrongCount.toLocaleString()}</p>
        </div>
        <Button
          variant="secondary"
          size="lg"
          style={{ marginLeft: "auto" }}
          iconStart={<Icon name="headphones" />}
          onClick={() => {
            setPracticeSource({ sourceType: "library", sourceId: library.id });
            navigate(`/practice/setup?source_type=library&source_id=${library.id}`);
          }}
        >
          开始听写
        </Button>
      </section>
      <div className="toolbar-row">
        <div className="chip-row">
          <Chip selected={wordFilter === "all"} onClick={() => setWordFilter("all")}>全部 ({words.length.toLocaleString()})</Chip>
          <Chip selected={wordFilter === "mastered"} onClick={() => setWordFilter("mastered")}>已掌握 ({masteredCount.toLocaleString()})</Chip>
          <Chip selected={wordFilter === "wrong"} onClick={() => setWordFilter("wrong")}>错词 ({wrongCount.toLocaleString()})</Chip>
        </div>
        <div className="page-actions">
          <div className="sort-controls" ref={sortControlsRef}>
            <div className="sort-menu-wrap">
              <Button variant="ghost" size="sm" iconStart={<Icon name="list" />} iconEnd={<Icon name="chevronDown" size={14} />} onClick={() => setOpenMenu(openMenu === "field" ? null : "field")}>
                {sortFieldLabel(sortField)}
              </Button>
              {openMenu === "field" ? (
                <div className="sort-menu">
                  {(["word", "added", "mastery", "wrong"] as const).map((field) => (
                    <button type="button" key={field} onClick={() => {
                      setSortField(field);
                      setOpenMenu(null);
                    }}>{sortFieldLabel(field)}</button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="sort-menu-wrap">
              <Button variant="ghost" size="sm" iconEnd={<Icon name="chevronDown" size={14} />} onClick={() => setOpenMenu(openMenu === "order" ? null : "order")}>
                {sortOrder === "asc" ? "升序" : "降序"}
              </Button>
              {openMenu === "order" ? (
                <div className="sort-menu">
                  <button type="button" onClick={() => {
                    setSortOrder("asc");
                    setOpenMenu(null);
                  }}>升序</button>
                  <button type="button" onClick={() => {
                    setSortOrder("desc");
                    setOpenMenu(null);
                  }}>降序</button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="inline-search-wrap" ref={detailSearchRef}>
            <SearchBar
              variant="desktop"
              value={detailSearch}
              onFocus={() => setDetailSearchOpen(true)}
              onChange={(value) => {
                setDetailSearch(value);
                setDetailSearchOpen(true);
                if (!value.trim()) setAppliedSearch("");
              }}
              onSubmit={() => {
                setAppliedSearch(detailSearch.trim());
                setDetailSearchOpen(false);
              }}
              placeholder="在该词库中搜索..."
            />
            {detailSearchOpen && detailSearch.trim() ? (
              <div className="search-suggest-panel page-suggest-panel">
                {detailSearchResults.length ? detailSearchResults.map((word) => (
                  <button type="button" key={word.id} onClick={() => navigate(`/words/${word.id}`)}>
                    <strong>{word.word}</strong>
                    <span>{word.meaning}</span>
                  </button>
                )) : <p>没有找到结果</p>}
              </div>
            ) : null}
          </div>
          <Button variant="secondary" size="sm" iconStart={<Icon name="plus" />} onClick={() => {
            setSelectedLibraryId(library.id);
            openDialog("add-word-search");
          }}>新增单词</Button>
        </div>
      </div>
      <WordTable
        words={visibleWords}
        onWordClick={(word) => navigate(`/words/${word.id}`)}
        onFavorite={(word) => toggleFavorite(word.id)}
        onAction={(word) => setPendingRemove(word)}
        actionLabel="移出"
      />
      <NoticeDialog
        open={Boolean(pendingRemove)}
        title="移出单词"
        description={pendingRemove ? `确认将「${pendingRemove.word}」从「${library.name}」中移出？\n该操作不会删除词典中的词条。` : ""}
        danger
        confirmText="移出"
        onConfirm={() => {
          if (pendingRemove) deleteWord(pendingRemove.id);
          setPendingRemove(null);
        }}
        onClose={() => setPendingRemove(null)}
      />
    </>
  );
}

export function LibraryDetailEmptyPage() {
  const openDialog = useLibraryStore((state) => state.openDialog);
  return (
    <EmptyState
      title="词库还是空的"
      description="添加单词或导入词表后，就可以从这里开始听写。"
      action={
        <div className="page-actions">
          <Button variant="primary" size="lg" iconStart={<Icon name="plus" />} onClick={() => openDialog("add-word-search")}>添加单词</Button>
          <Button variant="secondary" size="lg" iconStart={<Icon name="upload" />} onClick={() => openDialog("import-file")}>导入词表</Button>
        </div>
      }
    />
  );
}

export function FavoriteLibraryPage() {
  const navigate = useNavigate();
  const [pendingRemove, setPendingRemove] = useState<VocabularyWord | null>(null);
  const allWords = useLibraryStore((state) => state.words);
  const words = useMemo(() => dedupeWordsByIdentity(allWords.filter((word) => word.isFavorite)), [allWords]);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const setPracticeSource = useLibraryStore((state) => state.setPracticeSource);
  if (!words.length) return <FavoriteLibraryEmptyPage />;
  return (
    <>
      <header className="page-topbar">
        <div><h1 className="page-title">收藏夹</h1><p className="page-subtitle">{words.length} 词{words[0] ? ` · 最近添加 ${words[0].word}` : ""}</p></div>
        <Button
          variant="secondary"
          size="sm"
          iconStart={<Icon name="headphones" />}
          onClick={() => {
            setPracticeSource({ sourceType: "favorite" });
            navigate("/practice/setup?source_type=favorite");
          }}
        >开始听写</Button>
      </header>
      <WordTable words={words} visibleRows={15} onWordClick={(word) => navigate(word.libraryId === 0 && word.dictionaryEntryId ? `/dictionary/entry/${word.dictionaryEntryId}` : `/words/${word.id}`)} onFavorite={(word) => toggleFavorite(word.id)} onAction={setPendingRemove} actionLabel="移出" />
      <NoticeDialog
        open={Boolean(pendingRemove)}
        title="移出收藏"
        description={pendingRemove ? `确认将「${pendingRemove.word}」从收藏夹中移出？` : ""}
        danger
        confirmText="移出"
        onConfirm={() => {
          if (pendingRemove) toggleFavorite(pendingRemove.id);
          setPendingRemove(null);
        }}
        onClose={() => setPendingRemove(null)}
      />
    </>
  );
}

export function WrongBookPage() {
  const navigate = useNavigate();
  const [pendingRemove, setPendingRemove] = useState<VocabularyWord | null>(null);
  const allWords = useLibraryStore((state) => state.words);
  const words = useMemo(() => dedupeWordsByIdentity(allWords.filter((word) => word.inWrongBook)), [allWords]);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const toggleWrongBook = useLibraryStore((state) => state.toggleWrongBook);
  const setPracticeSource = useLibraryStore((state) => state.setPracticeSource);
  if (!words.length) return <WrongBookEmptyPage />;
  return (
    <>
      <header className="page-topbar">
        <div><h1 className="page-title">错题本</h1><p className="page-subtitle">{words.length}词</p></div>
        <Button
          variant="danger"
          size="sm"
          iconStart={<Icon name="headphones" />}
          onClick={() => {
            setPracticeSource({ sourceType: "wrong_book" });
            navigate("/practice/setup?source_type=wrong_book");
          }}
        >开始听写</Button>
      </header>
      <WordTable
        words={words}
        onWordClick={(word) => navigate(word.libraryId === 0 && word.dictionaryEntryId ? `/dictionary/entry/${word.dictionaryEntryId}` : `/words/${word.id}`)}
        onFavorite={(word) => toggleFavorite(word.id)}
        onAction={setPendingRemove}
        actionLabel="移出"
        visibleRows={15}
      />
      <NoticeDialog
        open={Boolean(pendingRemove)}
        title="移出错题本"
        description={pendingRemove ? `确认将「${pendingRemove.word}」从错题本中移出？` : ""}
        danger
        confirmText="移出"
        onConfirm={() => {
          if (pendingRemove) toggleWrongBook(pendingRemove.id);
          setPendingRemove(null);
        }}
        onClose={() => setPendingRemove(null)}
      />
    </>
  );
}

function filterWords(words: VocabularyWord[], filter: "all" | "mastered" | "wrong"): VocabularyWord[] {
  if (filter === "mastered") return words.filter((word) => word.masteryLevel >= 10);
  if (filter === "wrong") return words.filter((word) => word.inWrongBook || word.wrongCount > 0);
  return words;
}

function searchWords(words: VocabularyWord[], query: string): VocabularyWord[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return words;
  return words.filter((word) => word.word.toLowerCase().includes(normalizedQuery) || word.meaning.includes(query.trim()));
}

function sortWords(words: VocabularyWord[], field: "word" | "added" | "mastery" | "wrong", order: "asc" | "desc"): VocabularyWord[] {
  const direction = order === "asc" ? 1 : -1;
  return [...words].sort((left, right) => {
    let result = 0;
    if (field === "word") result = left.word.localeCompare(right.word, "en", { sensitivity: "base" });
    if (field === "added") result = left.addedAt - right.addedAt;
    if (field === "mastery") result = left.masteryLevel - right.masteryLevel;
    if (field === "wrong") result = left.wrongCount - right.wrongCount;
    return result * direction;
  });
}

function sortFieldLabel(field: "word" | "added" | "mastery" | "wrong"): string {
  if (field === "word") return "首字母";
  if (field === "added") return "添加时间";
  if (field === "mastery") return "掌握度";
  return "错次";
}

function uniqueWords(words: VocabularyWord[]): VocabularyWord[] {
  const seen = new Set<string>();
  const unique: VocabularyWord[] = [];
  for (const word of words) {
    const key = word.word.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(word);
  }
  return unique;
}

function dedupeWordsByIdentity(words: VocabularyWord[]): VocabularyWord[] {
  const seen = new Set<string>();
  const unique: VocabularyWord[] = [];
  for (const word of words) {
    const key = word.word.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(word);
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

export function FavoriteLibraryEmptyPage() {
  const navigate = useNavigate();
  return <EmptyState title="还没有收藏" description="在词典或单词详情中点亮星标后，会出现在这里。" action={<Button onClick={() => navigate("/dictionary")}>去词典查词</Button>} />;
}

export function WrongBookEmptyPage() {
  const navigate = useNavigate();
  return <EmptyState title="错题本为空" description="答错或手动加入错题本的单词会出现在这里。" action={<Button variant="danger" onClick={() => navigate("/practice")}>开始听写</Button>} />;
}
