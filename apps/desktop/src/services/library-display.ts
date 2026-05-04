import type { VocabularyLibrary } from "@dictation/domain";

export const BUILT_IN_LIBRARY_COLOR = "#D4916E";

export function normalizeLibraryForDisplay(library: VocabularyLibrary): VocabularyLibrary {
  if (library.type === "official") {
    return {
      ...library,
      name: normalizeOfficialLibraryName(library.name),
      coverColor: BUILT_IN_LIBRARY_COLOR,
    };
  }
  if (library.type === "wrong_book" || library.type === "favorite") {
    return {
      ...library,
      coverColor: BUILT_IN_LIBRARY_COLOR,
    };
  }
  return library;
}

export function normalizeLibrariesForDisplay(libraries: VocabularyLibrary[]): VocabularyLibrary[] {
  return libraries.map(normalizeLibraryForDisplay);
}

export function officialLibraryLabel(): string {
  return "内置词库";
}

function normalizeOfficialLibraryName(name: string): string {
  const compact = name.toLowerCase().replace(/[\s_-]/g, "");
  if (compact.includes("ielts") || name.includes("雅思")) return "IELTS";
  if (compact.includes("toefl") || name.includes("托福")) return "TOEFL";
  if (compact.includes("gre")) return "GRE";
  if (compact.includes("cet4") || name.includes("四级")) return "CET4";
  if (compact.includes("cet6") || name.includes("六级")) return "CET6";
  if (name.includes("考研")) return "考研英语";
  if (name.includes("高考")) return "高考英语";
  if (name.includes("中考")) return "中考英语";
  return name;
}
