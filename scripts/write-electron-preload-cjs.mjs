import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const outputPath = path.join(repoRoot, "apps/desktop/dist-electron/preload/preload.cjs");
mkdirSync(path.dirname(outputPath), { recursive: true });

writeFileSync(
  outputPath,
  `const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dictationBridge", {
  app: {
    getAppVersion: () => ipcRenderer.invoke("app:get-version"),
    getPlatform: () => process.platform,
    openExternal: (url) => ipcRenderer.invoke("app:open-external", url),
  },
  database: {
    query: (request) => ipcRenderer.invoke("database:query", request),
  },
  file: {
    selectImportFile: () => ipcRenderer.invoke("file:select-import-file"),
    selectDataBackupFile: () => ipcRenderer.invoke("file:select-data-backup-file"),
    saveTextFile: (request) => ipcRenderer.invoke("file:save-text-file", request),
    exportTatoebaAttributionCsv: () => ipcRenderer.invoke("file:export-tatoeba-attribution-csv"),
    clearCache: () => ipcRenderer.invoke("file:clear-cache"),
  },
  audio: {
    play: (request) => ipcRenderer.invoke("audio:play", request),
    prepare: (request) => ipcRenderer.invoke("audio:prepare", request),
    playFile: (request) => ipcRenderer.invoke("audio:play-file", request),
    pause: () => ipcRenderer.invoke("audio:pause"),
    stop: () => ipcRenderer.invoke("audio:stop"),
  },
});
`,
);
