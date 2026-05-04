import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const releaseResources = path.resolve(root, "release", "resources");
const ttsDir = path.join(releaseResources, "tts");
const licensesDir = path.join(releaseResources, "licenses");
const noticePath = path.join(licensesDir, "THIRD_PARTY_NOTICES.txt");

mkdirSync(releaseResources, { recursive: true });
mkdirSync(licensesDir, { recursive: true });

run(process.execPath, ["--import", "tsx", "scripts/db/seed.ts"]);
run(process.execPath, ["scripts/setup-piper.mjs"], {
  DICTATION_TTS_DIR: ttsDir,
});

writeFileSync(
  noticePath,
  [
    "Ewords Dictation - Third-party notices",
    "",
    "Piper TTS",
    "- Project: rhasspy/piper",
    "- License: MIT",
    "- Source: https://github.com/rhasspy/piper",
    "",
    "Piper voice models",
    "- Repository: rhasspy/piper-voices",
    "- Voices: en_US-lessac-medium, en_GB-alan-medium",
    "- License: MIT as marked by the Hugging Face repository metadata",
    "- Source: https://huggingface.co/rhasspy/piper-voices",
    "",
    "Tatoeba example text",
    "- License: CC BY / CC0 depending on source sentence metadata",
    "- Source: https://tatoeba.org/",
    "- The packaged attribution export is available from Settings.",
    "",
  ].join("\n"),
  "utf8",
);

assertFile("data/processed/dictation.sqlite");
assertFile("data/export/tatoeba_examples_and_attribution.csv");
assertFile("data/migrations/0001_init.sql");
assertFile("release/resources/tts/piper/piper.exe");
assertFile("release/resources/tts/voices/en_US-lessac-medium.onnx");
assertFile("release/resources/tts/voices/en_US-lessac-medium.onnx.json");
assertFile("release/resources/tts/voices/en_GB-alan-medium.onnx");
assertFile("release/resources/tts/voices/en_GB-alan-medium.onnx.json");
assertFile("release/resources/licenses/THIRD_PARTY_NOTICES.txt");

console.log("Package assets are ready:");
console.log(`  ${describe("data/processed/dictation.sqlite")}`);
console.log(`  ${describe("release/resources/tts/piper/piper.exe")}`);
console.log(`  ${describe("release/resources/tts/voices/en_US-lessac-medium.onnx")}`);
console.log(`  ${describe("release/resources/tts/voices/en_GB-alan-medium.onnx")}`);

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: {
      ...process.env,
      ...extraEnv,
    },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

function assertFile(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  if (!existsSync(absolutePath)) throw new Error(`Missing required package asset: ${relativePath}`);
}

function describe(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  const sizeMb = statSync(absolutePath).size / 1024 / 1024;
  return `${relativePath} (${sizeMb.toFixed(1)} MB)`;
}
