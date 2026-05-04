import { app, ipcMain, shell } from "electron";

ipcMain.handle("app:get-version", () => app.getVersion());

ipcMain.handle("app:open-external", async (_event, url: string) => {
  if (!/^https?:\/\//i.test(url)) return false;
  await shell.openExternal(url);
  return true;
});
