/* global fetch */
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const appData = process.env.APPDATA || process.env.HOME || process.cwd();
const userData = join(appData, "Ewords Dictation");
const ttsRoot = process.env.DICTATION_TTS_DIR || join(userData, "tts");
const piperDir = join(ttsRoot, "piper");
const voicesDir = join(ttsRoot, "voices");
const tmpDir = join(ttsRoot, "downloads");

const assets = [
  {
    url: "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip",
    target: join(tmpDir, "piper_windows_amd64.zip"),
    extractTo: piperDir,
    skipIf: join(piperDir, "piper.exe"),
  },
  {
    url: "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
    target: join(voicesDir, "en_US-lessac-medium.onnx"),
  },
  {
    url: "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json",
    target: join(voicesDir, "en_US-lessac-medium.onnx.json"),
  },
  {
    url: "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alan/medium/en_GB-alan-medium.onnx",
    target: join(voicesDir, "en_GB-alan-medium.onnx"),
  },
  {
    url: "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json",
    target: join(voicesDir, "en_GB-alan-medium.onnx.json"),
  },
];

mkdirSync(piperDir, { recursive: true });
mkdirSync(voicesDir, { recursive: true });
mkdirSync(tmpDir, { recursive: true });
flattenPiperDir();

for (const asset of assets) {
  if (asset.skipIf && existsSync(asset.skipIf)) {
    console.log(`exists ${asset.skipIf}`);
    continue;
  }
  if (asset.extractTo && existsSync(asset.target)) {
    console.log(`exists ${asset.target}`);
  } else {
    await download(asset.url, asset.target);
  }
  if (asset.extractTo) extractZip(asset.target, asset.extractTo);
  flattenPiperDir();
}

if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });

console.log("Piper TTS assets are ready:");
console.log(`  ${join(piperDir, "piper.exe")}`);
console.log(`  ${join(voicesDir, "en_US-lessac-medium.onnx")}`);
console.log(`  ${join(voicesDir, "en_GB-alan-medium.onnx")}`);

async function download(url, target) {
  if (existsSync(target) && statSync(target).size > 0) {
    console.log(`exists ${target}`);
    return;
  }
  const expectedBytes = await contentLength(url);
  console.log(`download ${basename(target)}`);
  const partial = `${target}.part`;
  if (existsSync(target)) renameSync(target, partial);
  if (process.platform === "win32") {
    const result = spawnSync("curl.exe", ["-L", "--fail", "--retry", "5", "--continue-at", "-", "--output", partial, url], {
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.status !== 0) throw new Error(`Failed to download ${url}`);
  } else {
    await downloadWithFetch(url, partial);
  }
  if (expectedBytes != null && statSync(partial).size !== expectedBytes) {
    throw new Error(`Incomplete download for ${url}: expected ${expectedBytes}, got ${statSync(partial).size}`);
  }
  renameSync(partial, target);
}

async function downloadWithFetch(url, target) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
}

async function contentLength(url) {
  const response = await fetch(url, { method: "HEAD" });
  if (!response.ok) return null;
  const length = response.headers.get("content-length");
  return length ? Number(length) : null;
}

function extractZip(zipPath, targetDir) {
  console.log(`extract ${basename(zipPath)}`);
  if (process.platform !== "win32") throw new Error("Automatic Piper zip extraction is only implemented for Windows.");
  const tarResult = spawnSync("tar.exe", ["-xf", zipPath, "-C", targetDir], { stdio: "inherit", windowsHide: true });
  if (tarResult.status === 0) return;
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", "Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force", zipPath, targetDir],
    { stdio: "inherit", windowsHide: true },
  );
  if (result.status !== 0) throw new Error(`Failed to extract ${zipPath}`);
}

function flattenPiperDir() {
  const directExe = join(piperDir, "piper.exe");
  const nestedDir = join(piperDir, "piper");
  const nestedExe = join(nestedDir, "piper.exe");
  if (existsSync(directExe) || !existsSync(nestedExe)) return;
  for (const name of readdirSync(nestedDir)) {
    renameSync(join(nestedDir, name), join(piperDir, name));
  }
  rmSync(nestedDir, { recursive: true, force: true });
}
