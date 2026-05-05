import { spawn } from "node:child_process";
import http from "node:http";
import { setTimeout as delay } from "node:timers/promises";

const isWindows = process.platform === "win32";
const corepack = "corepack";
const devUrl = process.env.VITE_DEV_SERVER_URL ?? "http://127.0.0.1:5173";

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: options.shell ?? isWindows,
    ...options,
    env: {
      ...process.env,
      ...options.env,
    },
  });
  return child;
}

function runBlocking(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = run(command, args, options);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
}

async function waitForUrl(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canReach(url)) return;
    await delay(350);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function canReach(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode ? response.statusCode < 500 : true);
    });
    request.on("error", () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

const children = new Set();
function track(child) {
  children.add(child);
  child.on("exit", () => children.delete(child));
  return child;
}

function stopChildren() {
  for (const child of children) child.kill();
}

process.on("SIGINT", () => {
  stopChildren();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopChildren();
  process.exit(143);
});

await runBlocking(corepack, ["pnpm", "--filter", "@dictation/desktop", "exec", "vite", "build", "--config", "electron/vite.config.ts"]);
await runBlocking(process.execPath, ["scripts/write-electron-preload-cjs.mjs"], { shell: false });

if (!(await canReach(devUrl))) {
  track(run(corepack, ["pnpm", "--filter", "@dictation/desktop", "dev"]));
}
await waitForUrl(devUrl);

const electron = track(
  run(corepack, ["pnpm", "exec", "electron", "apps/desktop/dist-electron/main/main.js"], {
    env: {
      VITE_DEV_SERVER_URL: devUrl,
    },
  }),
);

electron.on("exit", (code) => {
  stopChildren();
  process.exit(code ?? 0);
});
