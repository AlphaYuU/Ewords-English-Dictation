import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, type ChildProcess } from "node:child_process";
import { app, ipcMain } from "electron";

type PlayAudioRequest = {
  word?: string;
  accent?: "uk" | "us";
  speed?: 0.5 | 1 | 1.5;
};

let currentSystemPlayer: ChildProcess | null = null;

ipcMain.handle("audio:play", async (_event, request: PlayAudioRequest) => {
  try {
    const prepared = await preparePiperAudio(request);
    if (!prepared.ok) return prepared;
    const outputPath = prepared.filePath;
    const dataUrl = `data:audio/wav;base64,${readFileSync(outputPath).toString("base64")}`;
    return { ok: true, source: "piper", filePath: outputPath, fileUrl: pathToFileURL(outputPath).toString(), dataUrl };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("audio:prepare", async (_event, request: PlayAudioRequest) => {
  try {
    return await preparePiperAudio(request);
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("audio:play-file", async (_event, request: { filePath?: string }) => {
  const filePath = String(request?.filePath ?? "");
  if (!filePath || !existsSync(filePath)) return { ok: false, reason: "AUDIO_FILE_NOT_FOUND" };
  try {
    await playWithSystemPlayer(filePath);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("audio:pause", async () => {
  stopSystemPlayback();
  return true;
});
ipcMain.handle("audio:stop", async () => {
  stopSystemPlayback();
  return true;
});

function resolvePiperConfig(accent: "uk" | "us"): { executable: string; model: string } | null {
  const executableName = process.platform === "win32" ? "piper.exe" : "piper";
  const userExecutable = path.join(app.getPath("userData"), "tts", "piper", executableName);
  const nestedUserExecutable = path.join(app.getPath("userData"), "tts", "piper", "piper", executableName);
  const bundledExecutable = path.join(process.resourcesPath, "tts", "piper", executableName);
  const nestedBundledExecutable = path.join(process.resourcesPath, "tts", "piper", "piper", executableName);
  const executable =
    process.env.DICTATION_PIPER_EXE ||
    [bundledExecutable, nestedBundledExecutable, userExecutable, nestedUserExecutable].find((candidate) => existsSync(candidate)) ||
    userExecutable;
  const modelEnv = accent === "uk" ? process.env.DICTATION_PIPER_UK_MODEL : process.env.DICTATION_PIPER_US_MODEL;
  const modelName = accent === "uk" ? "en_GB-alan-medium.onnx" : "en_US-lessac-medium.onnx";
  const bundledModel = path.join(process.resourcesPath, "tts", "voices", modelName);
  const userModel = path.join(app.getPath("userData"), "tts", "voices", modelName);
  const model = modelEnv || (existsSync(bundledModel) ? bundledModel : userModel);
  if (!existsSync(executable) || !existsSync(model) || !existsSync(`${model}.json`)) return null;
  return { executable, model };
}

async function preparePiperAudio(request: PlayAudioRequest): Promise<{ ok: true; source: "piper"; filePath: string; fileUrl: string } | { ok: false; reason: string }> {
  const word = String(request?.word ?? "").trim();
  if (!word) return { ok: false, reason: "EMPTY_WORD" };
  const accent = request?.accent === "uk" ? "uk" : "us";
  const piper = resolvePiperConfig(accent);
  if (!piper) return { ok: false, reason: "PIPER_NOT_CONFIGURED" };
  const cacheDir = path.join(app.getPath("userData"), "audio-cache");
  mkdirSync(cacheDir, { recursive: true });
  const cacheKey = createHash("sha1").update(`${word}\n${accent}\n${request.speed ?? 1}\n${piper.model}`).digest("hex");
  const outputPath = path.join(cacheDir, `${cacheKey}.wav`);
  if (!existsSync(outputPath)) {
    await synthesizeWithPiper(piper.executable, piper.model, word, outputPath, request.speed ?? 1);
  }
  return { ok: true, source: "piper", filePath: outputPath, fileUrl: pathToFileURL(outputPath).toString() };
}

function synthesizeWithPiper(executable: string, model: string, text: string, outputPath: string, speed: 0.5 | 1 | 1.5): Promise<void> {
  return new Promise((resolve, reject) => {
    const lengthScale = Math.max(0.5, Math.min(2, 1 / speed));
    const child = spawn(executable, ["--model", model, "--output_file", outputPath, "--length_scale", String(lengthScale)], {
      windowsHide: true,
      stdio: ["pipe", "ignore", "pipe"],
    });
    let errorText = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("PIPER_SYNTHESIS_TIMEOUT"));
    }, 15000);
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback();
    };
    child.stderr?.on("data", (chunk: Buffer) => {
      errorText += chunk.toString("utf8");
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => {
      finish(() => {
        if (code === 0) resolve();
        else reject(new Error(errorText.trim() || `Piper exited with code ${code}`));
      });
    });
    child.stdin.end(`${text}\n`);
  });
}

function playWithSystemPlayer(filePath: string): Promise<void> {
  if (process.platform !== "win32") return Promise.reject(new Error("SYSTEM_AUDIO_UNSUPPORTED"));
  stopSystemPlayback();
  const powershell = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const durationMs = Math.max(3000, Math.min(15000, estimateWavDurationMs(filePath) + 3000));
  return new Promise((resolve, reject) => {
    const child = spawn(
      powershell,
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "$player = New-Object System.Media.SoundPlayer -ArgumentList @($env:DICTATION_AUDIO_FILE); $player.Load(); $player.PlaySync()",
      ],
      {
        windowsHide: true,
        stdio: ["ignore", "ignore", "pipe"],
        env: { ...process.env, DICTATION_AUDIO_FILE: filePath },
      },
    );
    currentSystemPlayer = child;
    let errorText = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      if (currentSystemPlayer === child) currentSystemPlayer = null;
      reject(new Error("SYSTEM_AUDIO_PLAYBACK_TIMEOUT"));
    }, durationMs);
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (currentSystemPlayer === child) currentSystemPlayer = null;
      callback();
    };
    child.stderr?.on("data", (chunk: Buffer) => {
      errorText += chunk.toString("utf8");
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code) => {
      finish(() => {
        if (code === 0 || code == null) resolve();
        else reject(new Error(errorText.trim() || `System audio exited with code ${code}`));
      });
    });
  });
}

function stopSystemPlayback(): void {
  if (!currentSystemPlayer) return;
  currentSystemPlayer.kill();
  currentSystemPlayer = null;
}

function estimateWavDurationMs(filePath: string): number {
  try {
    const buffer = readFileSync(filePath);
    if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF") return 3000;
    const channels = buffer.readUInt16LE(22);
    const sampleRate = buffer.readUInt32LE(24);
    const bitsPerSample = buffer.readUInt16LE(34);
    const bytesPerSample = Math.max(1, channels * (bitsPerSample / 8));
    let offset = 12;
    while (offset + 8 <= buffer.length) {
      const chunkId = buffer.toString("ascii", offset, offset + 4);
      const chunkSize = buffer.readUInt32LE(offset + 4);
      if (chunkId === "data") {
        return Math.ceil((chunkSize / bytesPerSample / sampleRate) * 1000);
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
  } catch {
    return 3000;
  }
  return 3000;
}
