import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, EmptyState, Icon, SearchBar } from "@dictation/ui";
import { searchDictionary } from "@dictation/dictionary-engine";
import type { DictionaryEntry } from "@dictation/domain";
import { useDictionaryStore } from "../stores/dictionary-store";
import { queryDesktopDatabase } from "../services/desktop-bridge";

export function DictionaryPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 80);
  const dictionary = useDictionaryStore((state) => state.dictionary);
  const recordDictionarySearch = useDictionaryStore((state) => state.recordDictionarySearch);
  const searchHistory = useDictionaryStore((state) => state.searchHistory);
  const [liveResultState, setLiveResultState] = useState<{ query: string; results: DictionaryEntry[] }>({ query: "", results: [] });
  const activeLiveResults = query.trim() && liveResultState.query === debouncedQuery.trim() ? liveResultState.results : [];
  const recentSearches = useMemo(() => searchHistory.slice(0, 10), [searchHistory]);
  const recentSearchColumns = useMemo(() => [recentSearches.slice(0, 5), recentSearches.slice(5, 10)], [recentSearches]);
  const openEntry = (entry: DictionaryEntry, searchTerm = query) => {
    recordDictionarySearch(searchTerm || entry.word, entry);
    navigate(`/dictionary/entry/${entry.id}`);
  };
  useEffect(() => {
    const trimmedQuery = debouncedQuery.trim();
    if (!trimmedQuery) return;
    let cancelled = false;
    const fallbackResults = () => uniqueDictionaryEntries(searchDictionary(dictionary, trimmedQuery, "all", 30));
    void queryDesktopDatabase<DictionaryEntry[]>({ resource: "dictionary-search", query: trimmedQuery, limit: 30 })
      .then((rows) => {
        if (!cancelled) setLiveResultState({ query: trimmedQuery, results: rows ? uniqueDictionaryEntries(rows) : fallbackResults() });
      })
      .catch(() => {
        if (!cancelled) setLiveResultState({ query: trimmedQuery, results: fallbackResults() });
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, dictionary]);
  return (
    <>
      <header className="page-topbar">
        <div>
          <h1 className="page-title">词典</h1>
          {dictionary.length ? <p className="page-subtitle">{dictionary.length.toLocaleString()} 个词条</p> : null}
        </div>
      </header>
      <main className="dictionary-home-page">
        <section className="dictionary-home-card">
          <div className="dictionary-home-hero">
            <div className="dictionary-home-mark">
              <Icon name="book" size={42} />
            </div>
            <div className="inline-search-wrap dictionary-home-search">
              <SearchBar
                variant="desktop"
                value={query}
                onChange={setQuery}
                onSubmit={() => {
                  const firstEntry = activeLiveResults[0];
                  if (firstEntry) openEntry(firstEntry);
                }}
                placeholder="搜索单词和中文释义"
              />
              {query.trim() ? (
                <div className="search-suggest-panel page-suggest-panel">
                  {activeLiveResults.length ? activeLiveResults.map((result) => (
                    <button type="button" key={result.id} onClick={() => openEntry(result)}>
                      <strong>{result.word}</strong>
                      <span>{result.meaningCn}</span>
                    </button>
                  )) : <p>没有找到结果</p>}
                </div>
              ) : null}
            </div>
          </div>
          <section className="dictionary-recent-board" aria-label="最近搜索">
            <div className="dictionary-recent-board-header">
              <h2>最近搜索</h2>
              {recentSearches.length ? <span>{recentSearches.length} / 10</span> : null}
            </div>
            {recentSearches.length ? (
              <div className="dictionary-recent-columns">
                {recentSearchColumns.map((column, columnIndex) => (
                  <div className="dictionary-recent-column" key={columnIndex === 0 ? "recent-left" : "recent-right"}>
                    {column.map((item) => (
                      <button
                        type="button"
                        className="dictionary-recent-item"
                        key={item.id}
                        onClick={() => {
                          if (item.entryId) navigate(`/dictionary/entry/${item.entryId}`);
                          else setQuery(item.query);
                        }}
                      >
                        <strong>{item.word ?? item.query}</strong>
                        <span>{item.meaningCn ?? "再次搜索"}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="dictionary-recent-empty">暂无最近搜索。</div>
            )}
          </section>
        </section>
      </main>
    </>
  );
}

export function DictionaryEmptyPage() {
  const navigate = useNavigate();
  const openDialog = useDictionaryStore((state) => state.openDialog);
  return (
    <EmptyState
      title="没有找到词条"
      description="你可以换一个关键词，或手动创建自定义词条。"
      action={
        <div className="page-actions">
          <Button variant="secondary" onClick={() => navigate("/dictionary")}>返回词典</Button>
          <Button variant="primary" onClick={() => openDialog("create-word")}>手动创建</Button>
        </div>
      }
    />
  );
}

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
