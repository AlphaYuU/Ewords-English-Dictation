export type ImportPreviewRow = {
  tempId: string;
  rowIndex: number;
  word: string;
  meaning?: string;
  phonetic?: string;
  partOfSpeech?: string;
  matchedEntryId?: number;
  status: "matched" | "duplicate" | "unmatched" | "error";
  errorMessage?: string;
  action: "add" | "skip" | "merge" | "manual";
};

function isLooseDelimiter(char: string): boolean {
  return char === "," || char === "，";
}

function expandWhitespaceRow(row: string[]): string[] {
  if (row.length !== 1) return row;
  const value = row[0].trim();
  if (!value) return row;
  const match = value.match(/^(\S+)\s+(.+)$/);
  return match ? [match[1], match[2].trim()] : row;
}

function normalizeHeaderName(value: string): string {
  return value.trim().replace(/^\uFEFF/, "").toLowerCase();
}

function findHeaderIndex(header: string[], names: string[]): number {
  return names.reduce((found, name) => (found >= 0 ? found : header.indexOf(name)), -1);
}

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;
  const normalizedText = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index];
    const next = normalizedText[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (isLooseDelimiter(char) && !inQuotes) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }
  if (value.length || row.length) {
    row.push(value.trim());
    if (row.some(Boolean)) rows.push(row);
  }
  return rows.map(expandWhitespaceRow);
}

export function buildImportPreview(text: string, existingWords: string[] = []): ImportPreviewRow[] {
  const existing = new Set(existingWords.map((word) => word.toLowerCase()));
  const rows = parseCsvText(text).filter((row) => row.some(Boolean));
  const header = rows[0]?.map(normalizeHeaderName) ?? [];
  const wordHeaderIndex = findHeaderIndex(header, ["word", "单词", "词条"]);
  const hasHeader = wordHeaderIndex >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const wordIndex = hasHeader ? wordHeaderIndex : 0;
  const meaningIndex = hasHeader ? findHeaderIndex(header, ["meaning", "meaning_cn", "释义", "中文", "中文释义"]) : 1;
  const phoneticIndex = hasHeader ? findHeaderIndex(header, ["phonetic", "音标", "us_phonetic", "uk_phonetic"]) : -1;
  const partOfSpeechIndex = hasHeader ? findHeaderIndex(header, ["partofspeech", "part_of_speech", "pos", "词性"]) : -1;
  return dataRows.map((cells, index) => {
    const word = cells[wordIndex] ?? cells[0] ?? "";
    const meaning = hasHeader
      ? meaningIndex >= 0
        ? (cells[meaningIndex] ?? "")
        : ""
      : cells.length > 2
        ? cells.slice(1).filter(Boolean).join("，")
        : (cells[meaningIndex] ?? cells[1] ?? "");
    const phonetic = phoneticIndex >= 0 ? cells[phoneticIndex] : undefined;
    const partOfSpeech = partOfSpeechIndex >= 0 ? cells[partOfSpeechIndex] : undefined;
    const duplicate = existing.has(word.toLowerCase());
    return {
      tempId: `row_${index + 1}`,
      rowIndex: index + 1,
      word,
      meaning,
      phonetic,
      partOfSpeech,
      status: word ? (duplicate ? "duplicate" : meaning ? "matched" : "unmatched") : "error",
      errorMessage: word ? undefined : "缺少单词",
      action: duplicate ? "skip" : "add",
    };
  });
}

export function parseTxtText(text: string, existingWords: string[] = []): ImportPreviewRow[] {
  return buildImportPreview(
    text
      .split(/\r?\n/)
      .map((line) => line.replace(/\t/g, ","))
      .join("\n"),
    existingWords,
  );
}
