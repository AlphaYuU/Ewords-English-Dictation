import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BrowserWindow, app } from "electron";

const mainDir = path.dirname(fileURLToPath(import.meta.url));

export function createMainWindow(): BrowserWindow {
  const runtimeRoot = findRuntimeRoot();
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1440,
    minHeight: 900,
    maxWidth: 1440,
    maxHeight: 900,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    useContentSize: true,
    autoHideMenuBar: true,
    backgroundColor: "#FBF6EF",
    title: "Ewords Dictation",
    icon: findAppIcon(runtimeRoot),
    webPreferences: {
      preload: path.join(runtimeRoot, "apps/desktop/dist-electron/preload/preload.cjs"),
      contextIsolation: true,
      backgroundThrottling: false,
      nodeIntegration: false,
    },
  });
  window.setMenuBarVisibility(false);
  window.webContents.setAudioMuted(false);

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
    if (process.env.ELECTRON_OPEN_DEVTOOLS === "1") {
      window.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    void window.loadFile(path.join(runtimeRoot, "apps/desktop/dist/index.html"));
  }

  if (process.env.DICTATION_DEV_SMOKE === "1") {
    window.webContents.once("did-finish-load", () => {
      console.log("DICTATION_DEV_SMOKE_READY");
      setTimeout(() => window.close(), 250);
    });
  }

  return window;
}

function findAppIcon(runtimeRoot: string): string | undefined {
  const candidates = [
    path.join(process.resourcesPath, "build", "icon.ico"),
    path.join(runtimeRoot, "build", "icon.ico"),
    path.join(app.getAppPath(), "build", "icon.ico"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

function findRuntimeRoot(): string {
  const candidates = [process.cwd(), app.getAppPath(), mainDir];
  for (const start of candidates) {
    let current = path.resolve(start);
    for (let depth = 0; depth < 8; depth += 1) {
      if (
        existsSync(path.join(current, "pnpm-workspace.yaml")) ||
        existsSync(path.join(current, "apps", "desktop", "dist", "index.html"))
      ) {
        return current;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return app.getAppPath();
}
