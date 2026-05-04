import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  FavoriteLibraryEmptyPage,
  FavoriteLibraryPage,
  LibraryDetailEmptyPage,
  LibraryDetailPage,
  LibraryEditPage,
  LibraryShelfPage,
  WrongBookEmptyPage,
  WrongBookPage,
} from "../pages/library-pages";
import { DictionaryEmptyPage, DictionaryPage } from "../pages/dictionary-pages";
import { DictionaryEntryDetailPage, WordDetailFavoritePage, WordDetailPage, WordDetailWrongPage } from "../pages/word-pages";
import {
  DictationExitConfirmPage,
  DictationResultPaperPage,
  DictationResultTypingPage,
  DictationSessionPaperPage,
  DictationSessionPausedPage,
  DictationSessionSettingsPage,
  DictationSessionTypingPage,
  PracticeEmptyPage,
  PracticeSetupListPage,
  PracticeSetupPage,
  PracticeSourcePickerPage,
} from "../pages/practice-pages";
import { HistoryDetailPage, HistoryEmptyPage, HistoryPage } from "../pages/history-pages";
import { AboutDictionaryPage, AboutExamplesPage, AboutTtsPage, SettingsPage } from "../pages/settings-pages";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/library" replace />} />
      <Route path="/library" element={<LibraryShelfPage />} />
      <Route path="/library/edit" element={<LibraryEditPage />} />
      <Route path="/library/:libraryId" element={<LibraryDetailPage />} />
      <Route path="/library/:libraryId/empty" element={<LibraryDetailEmptyPage />} />
      <Route path="/dictionary" element={<DictionaryPage />} />
      <Route path="/dictionary/entry/:entryId" element={<DictionaryEntryDetailPage />} />
      <Route path="/dictionary/empty" element={<DictionaryEmptyPage />} />
      <Route path="/words/:wordId" element={<WordDetailPage />} />
      <Route path="/words/:wordId/favorite" element={<WordDetailFavoritePage />} />
      <Route path="/words/:wordId/wrong" element={<WordDetailWrongPage />} />
      <Route path="/favorites" element={<FavoriteLibraryPage />} />
      <Route path="/favorites/empty" element={<FavoriteLibraryEmptyPage />} />
      <Route path="/wrong-book" element={<WrongBookPage />} />
      <Route path="/wrong-book/empty" element={<WrongBookEmptyPage />} />
      <Route path="/practice" element={<PracticeSetupPage />} />
      <Route path="/practice/empty" element={<PracticeEmptyPage />} />
      <Route path="/practice/setup" element={<PracticeSetupPage />} />
      <Route path="/practice/source-picker" element={<PracticeSourcePickerPage />} />
      <Route path="/practice/list" element={<PracticeSetupListPage />} />
      <Route path="/practice/session/:sessionId" element={<SessionRoute />} />
      <Route path="/practice/result/:sessionId" element={<ResultRoute />} />
      <Route path="/practice/exit-confirm" element={<DictationExitConfirmPage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/history/empty" element={<HistoryEmptyPage />} />
      <Route path="/history/:sessionId" element={<HistoryDetailPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/about-dictionary" element={<AboutDictionaryPage />} />
      <Route path="/settings/about-examples" element={<AboutExamplesPage />} />
      <Route path="/settings/about-tts" element={<AboutTtsPage />} />
    </Routes>
  );
}

function SessionRoute() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  if (params.get("exit") === "1") return <DictationExitConfirmPage />;
  if (params.get("paused") === "1") return <DictationSessionPausedPage />;
  if (params.get("settings") === "1") return <DictationSessionSettingsPage />;
  if (params.get("mode") === "paper") return <DictationSessionPaperPage />;
  return <DictationSessionTypingPage />;
}

function ResultRoute() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  if (params.get("mode") === "paper") return <DictationResultPaperPage />;
  return <DictationResultTypingPage />;
}
