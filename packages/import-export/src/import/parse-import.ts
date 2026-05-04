export type ImportPreviewRow = {
  tempId: string;
  rowIndex: number;
  word: string;
  meaning?: string;
  partOfSpeech?: string;
  matchedEntryId?: number;
  status: "matched" | "duplicate" | "unmatched" | "error";
  errorMessage?: string;
  action: "add" | "skip" | "merge" | "manual";
};

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
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
  return rows;
}

export function buildImportPreview(text: string, existingWords: string[] = []): ImportPreviewRow[] {
  const existing = new Set(existingWords.map((word) => word.toLowerCase()));
  const rows = parseCsvText(text).filter((row) => row.some(Boolean));
  const header = rows[0]?.map((cell) => cell.toLowerCase()) ?? [];
  const hasHeader = header.includes("word") || header.includes("单词");
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const wordIndex = hasHeader ? Math.max(header.indexOf("word"), header.indexOf("单词")) : 0;
  const meaningIndex = hasHeader ? Math.max(header.indexOf("meaning"), header.indexOf("释义")) : 1;
  return dataRows.map((cells, index) => {
    const word = cells[wordIndex] ?? cells[0] ?? "";
    const meaning = cells[meaningIndex] ?? cells[1] ?? "";
    const duplicate = existing.has(word.toLowerCase());
    return {
      tempId: `row_${index + 1}`,
      rowIndex: index + 1,
      word,
      meaning,
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
