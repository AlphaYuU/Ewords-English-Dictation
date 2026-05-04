import { mkdirSync } from "node:fs";
import path from "node:path";
import { app } from "electron";
import { createMainWindow } from "./window.js";
import "../ipc/app-ipc.js";
import "../ipc/database-ipc.js";
import "../ipc/file-ipc.js";
import "../ipc/audio-ipc.js";

app.setName("Ewords Dictation");
app.setAppUserModelId("com.ewords.dictation");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
configureUserDataPath();

app.whenReady().then(() => {
  createMainWindow();
  app.on("activate", () => {
    if (process.platform === "darwin") createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function configureUserDataPath(): void {
  const overridePath = process.env.DICTATION_USER_DATA_DIR;
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  const userDataPath = overridePath
    ? path.resolve(overridePath)
    : process.platform === "win32" && portableDir
      ? path.join(portableDir, "Ewords Dictation Data")
      : null;

  if (!userDataPath) return;
  mkdirSync(userDataPath, { recursive: true });
  app.setPath("userData", userDataPath);
}
