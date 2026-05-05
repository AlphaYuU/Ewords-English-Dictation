import { memo, useEffect, useMemo, useState } from "react";
import { BrowserRouter, HashRouter, useLocation, useNavigate } from "react-router-dom";
import { DesktopAppShell } from "@dictation/ui";
import { searchDictionary } from "@dictation/dictionary-engine";
import type { DictionaryEntry, VocabularyWord } from "@dictation/domain";
import { AppRoutes } from "./router";
import { DialogHost } from "../pages/dialog-host";
import { useUiStore } from "../stores/ui-store";
import { useAppStore } from "../stores/app-store";
import { queryDesktopDatabase } from "../services/desktop-bridge";

const MemoizedAppRoutes = memo(AppRoutes);
const MemoizedDialogHost = memo(DialogHost);

function ShellContent() {
  const [searchValue, setSearchValue] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const openDialog = useUiStore((state) => state.openDialog);
  const words = useAppStore((state) => state.words);
  const libraries = useAppStore((state) => state.libraries);
  const dictionary = useAppStore((state) => state.dictionary);
  const sessions = useAppStore((state) => state.sessions);
  const recordDictionarySearch = useAppStore((state) => state.recordDictionarySearch);
  const [shellDictionaryState, setShellDictionaryState] = useState<{ query: string; entries: DictionaryEntry[] }>({ query: "", entries: [] });
  const debouncedSearchValue = useDebouncedValue(searchValue, 80);
  const wrongBookCount = useMemo(
    () => countUniqueWordsByIdentity(words, (word) => Boolean(word.inWrongBook) || word.wrongCount > 0),
    [words],
  );
  const favoriteCount = useMemo(
    () => countUniqueWordsByIdentity(words, (word) => word.isFavorite),
    [words],
  );
  const activeRoute = location.pathname.startsWith("/practice") ? "/practice" : location.pathname;
  const sessionSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const sidebarDisabled =
    location.pathname.startsWith("/practice/session/") && sessionSearchParams.get("paused") !== "1";
  const pausedSession = useMemo(
    () =>
      sessions
        .filter((session) => session.status === "paused" || session.status === "active")
        .sort((left, right) => (right.pausedAt ?? right.createdAt) - (left.pausedAt ?? left.createdAt))[0],
    [sessions],
  );
  const navigateFromShell = (route: string) => {
    if (sidebarDisabled) return;
    if (route === "/practice" && pausedSession) {
      navigate(`/practice/session/${pausedSession.id}?paused=1`);
      return;
    }
    navigate(route);
  };
  const shellSearchResults = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return { libraries: [], entries: [] };
    return {
      libraries: libraries.filter((library) => library.name.toLowerCase().includes(query)).slice(0, 3),
      entries: shellDictionaryState.query === debouncedSearchValue.trim() ? shellDictionaryState.entries : [],
    };
  }, [debouncedSearchValue, libraries, searchValue, shellDictionaryState]);
  const submitShellSearch = () => {
    const query = searchValue.trim();
    if (!query) return;
    const firstEntry = shellSearchResults.entries[0];
    const firstLibrary = shellSearchResults.libraries[0];
    if (firstEntry) {
      recordDictionarySearch(query, firstEntry);
      setSearchValue("");
      navigate(`/dictionary/entry/${firstEntry.id}`);
      return;
    }
    if (firstLibrary) {
      setSearchValue("");
      navigate(`/library/${firstLibrary.id}`);
    }
  };
  useEffect(() => {
    const query = debouncedSearchValue.trim();
    if (!query) return;
    let cancelled = false;
    const fallbackEntries = () => uniqueEntries(searchDictionary(dictionary, query, "all", 30));
    void queryDesktopDatabase<DictionaryEntry[]>({ resource: "dictionary-search", query, limit: 30 })
      .then((entries) => {
        if (!cancelled) setShellDictionaryState({ query, entries: entries ? uniqueEntries(entries) : fallbackEntries() });
      })
      .catch(() => {
        if (!cancelled) setShellDictionaryState({ query, entries: fallbackEntries() });
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearchValue, dictionary]);
  useEffect(() => {
    if (!searchValue.trim()) return;
    const closeSearchPanel = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(".sidebar-search")) return;
      setSearchValue("");
    };
    document.addEventListener("pointerdown", closeSearchPanel);
    return () => document.removeEventListener("pointerdown", closeSearchPanel);
  }, [searchValue]);
  useEffect(() => {
    const dialog = new URLSearchParams(location.search).get("dialog");
    if (dialog === "create-library") openDialog("create-library");
  }, [location.search, openDialog]);
  return (
    <DesktopAppShell
      activeRoute={activeRoute}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      onSearchFocus={() => undefined}
      onSearchSubmit={submitShellSearch}
      searchPanel={
        searchValue.trim() ? (
          <div className="search-suggest-panel sidebar-suggest-panel">
            {shellSearchResults.libraries.length || shellSearchResults.entries.length ? (
              <>
                {shellSearchResults.libraries.map((library) => (
                  <button key={`library-${library.id}`} type="button" onClick={() => {
                    setSearchValue("");
                    navigate(`/library/${library.id}`);
                  }}>
                    <strong>{library.name}</strong>
                    <span>{library.wordCount.toLocaleString()} 词</span>
                  </button>
                ))}
                {shellSearchResults.entries.map((entry) => (
                  <button key={`entry-${entry.id}`} type="button" onClick={() => {
                    recordDictionarySearch(searchValue, entry);
                    setSearchValue("");
                    navigate(`/dictionary/entry/${entry.id}`);
                  }}>
                    <strong>{entry.word}</strong>
                    <span>{entry.meaningCn}</span>
                  </button>
                ))}
              </>
            ) : (
              <p>没有找到结果</p>
            )}
          </div>
        ) : null
      }
      onNavigate={navigateFromShell}
      wrongBookCount={wrongBookCount}
      favoriteCount={favoriteCount}
      sidebarDisabled={sidebarDisabled}
    >
      <MemoizedAppRoutes />
      <MemoizedDialogHost />
    </DesktopAppShell>
  );
}

function uniqueEntries(entries: DictionaryEntry[]): DictionaryEntry[] {
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

function countUniqueWordsByIdentity(words: VocabularyWord[], predicate: (word: VocabularyWord) => boolean): number {
  const seen = new Set<string>();
  for (const word of words) {
    if (!predicate(word)) continue;
    const key = (word.wordKey ?? word.word).trim().toLowerCase();
    if (key) seen.add(key);
  }
  return seen.size;
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);
  return debouncedValue;
}

export function App() {
  const Router = typeof window !== "undefined" && window.location.protocol === "file:" ? HashRouter : BrowserRouter;
  return (
    <Router>
      <ShellContent />
    </Router>
  );
}
