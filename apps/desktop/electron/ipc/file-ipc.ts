import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { app, dialog, ipcMain } from "electron";
import * as XLSX from "xlsx";

type ImportFileResult =
  | { ok: true; filePath: string; fileName: string; text: string }
  | { ok: false; filePath?: string; fileName?: string; error: string };

ipcMain.handle("file:select-import-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Word lists", extensions: ["csv", "txt", "xlsx"] }],
  });
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);
  try {
    return {
      ok: true,
      filePath,
      fileName,
      text: readImportFile(filePath),
    } satisfies ImportFileResult;
  } catch (error) {
    console.error("Failed to read import file", { filePath, error });
    return {
      ok: false,
      filePath,
      fileName,
      error: error instanceof Error ? error.message : String(error),
    } satisfies ImportFileResult;
  }
});

ipcMain.handle("file:select-data-backup-file", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile"],
    filters: [{ name: "Dictation backup", extensions: ["json"] }],
  });
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  return {
    filePath,
    fileName: path.basename(filePath),
    text: readFileSync(filePath, "utf8"),
  };
});

ipcMain.handle("file:save-text-file", async (_event, request: { defaultPath?: string; content?: string; filters?: Electron.FileFilter[] }) => {
  const result = await dialog.showSaveDialog({
    defaultPath: request.defaultPath,
    filters: request.filters ?? [{ name: "CSV", extensions: ["csv"] }],
  });
  if (result.canceled || !result.filePath) return null;
  writeFileSync(result.filePath, request.content ?? "", "utf8");
  return result.filePath;
});

ipcMain.handle("file:export-tatoeba-attribution-csv", async () => {
  const sourcePath = findBundledFile("data/export/tatoeba_examples_and_attribution.csv");
  if (!sourcePath) throw new Error("Tatoeba attribution CSV not found.");
  const result = await dialog.showSaveDialog({
    defaultPath: "tatoeba_examples_and_attribution.csv",
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (result.canceled || !result.filePath) return null;
  writeFileSync(result.filePath, readFileSync(sourcePath));
  return result.filePath;
});

ipcMain.handle("file:clear-cache", async () => {
  const cacheDirs = [
    path.join(app.getPath("userData"), "audio-cache"),
    path.join(app.getPath("userData"), "tmp"),
  ];
  let removedFiles = 0;
  let removedBytes = 0;
  for (const cacheDir of cacheDirs) {
    if (!existsSync(cacheDir)) continue;
    const stats = collectDirectoryStats(cacheDir);
    removedFiles += stats.files;
    removedBytes += stats.bytes;
    rmSync(cacheDir, { recursive: true, force: true });
  }
  return { removedFiles, removedBytes };
});

function readImportFile(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".xlsx") {
    const workbook = XLSX.read(readFileSync(filePath), { type: "buffer" });
    if (!workbook.SheetNames.length) return "";
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) return "";
    return XLSX.utils.sheet_to_csv(firstSheet, { blankrows: false });
  }
  return readFileSync(filePath, "utf8");
}

function collectDirectoryStats(directory: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, item.name);
    if (item.isDirectory()) {
      const child = collectDirectoryStats(fullPath);
      files += child.files;
      bytes += child.bytes;
      continue;
    }
    const stats = statSync(fullPath);
    files += 1;
    bytes += stats.size;
  }
  return { files, bytes };
}

function findBundledFile(relativePath: string): string | null {
  const directCandidates = [process.resourcesPath, app.getAppPath(), path.dirname(app.getPath("exe")), process.cwd()];
  for (const base of directCandidates) {
    const candidate = path.join(base, relativePath);
    if (existsSync(candidate)) return candidate;
  }
  const candidates = [process.cwd(), app.getAppPath(), path.dirname(app.getPath("exe"))];
  for (const start of candidates) {
    let current = path.resolve(start);
    for (let depth = 0; depth < 8; depth += 1) {
      const candidate = path.join(current, relativePath);
      if (existsSync(candidate)) return candidate;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}
