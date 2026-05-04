const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;

  const projectDir = context.packager.projectDir;
  const productFilename = context.packager.appInfo.productFilename;
  const appExe = path.join(context.appOutDir, `${productFilename}.exe`);
  const iconPath = path.join(projectDir, "build", "icon.ico");
  const rceditPath = findRcedit();

  if (!existsSync(appExe)) throw new Error(`Cannot set app icon, exe not found: ${appExe}`);
  if (!existsSync(iconPath)) throw new Error(`Cannot set app icon, icon not found: ${iconPath}`);

  console.log(`  • setting Windows app icon  path=${appExe} icon=${iconPath}`);
  const result = spawnSync(rceditPath, [appExe, "--set-icon", iconPath], {
    cwd: projectDir,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`rcedit failed with exit code ${result.status ?? "unknown"}`);
  }
};

function findRcedit() {
  const packageDir = path.resolve(path.dirname(require.resolve("rcedit")), "..");
  const executable = process.arch === "ia32" ? "rcedit.exe" : "rcedit-x64.exe";
  const rceditPath = path.join(packageDir, "bin", executable);
  if (!existsSync(rceditPath)) throw new Error(`rcedit executable not found: ${rceditPath}`);
  return rceditPath;
}
