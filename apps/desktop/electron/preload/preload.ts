import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("dictationBridge", {
  app: {
    getAppVersion: () => ipcRenderer.invoke("app:get-version"),
    getPlatform: () => process.platform,
    openExternal: (url: string) => ipcRenderer.invoke("app:open-external", url),
  },
  database: {
    query: (request: unknown) => ipcRenderer.invoke("database:query", request),
  },
  file: {
    selectImportFile: () => ipcRenderer.invoke("file:select-import-file"),
    selectDataBackupFile: () => ipcRenderer.invoke("file:select-data-backup-file"),
    saveTextFile: (request: unknown) => ipcRenderer.invoke("file:save-text-file", request),
    exportTatoebaAttributionCsv: () => ipcRenderer.invoke("file:export-tatoeba-attribution-csv"),
    clearCache: () => ipcRenderer.invoke("file:clear-cache"),
  },
  audio: {
    play: (request: unknown) => ipcRenderer.invoke("audio:play", request),
    prepare: (request: unknown) => ipcRenderer.invoke("audio:prepare", request),
    playFile: (request: unknown) => ipcRenderer.invoke("audio:play-file", request),
    pause: () => ipcRenderer.invoke("audio:pause"),
    stop: () => ipcRenderer.invoke("audio:stop"),
  },
});
