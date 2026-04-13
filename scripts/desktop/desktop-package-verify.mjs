#!/usr/bin/env node
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseDir = resolve(rootDir, "apps/desktop/release");

function binName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(command, args, options = {}) {
  console.log(`[desktop-verify] run: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, ...(options.env ?? {}) }
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, { stdio: "ignore" });
  if (result.error) {
    return false;
  }
  return result.status === 0;
}

function findLatestReleaseFile(matcher) {
  if (!existsSync(releaseDir)) {
    return "";
  }
  const entries = readdirSync(releaseDir)
    .map((name) => {
      const fullPath = resolve(releaseDir, name);
      return {
        name,
        fullPath,
        mtimeMs: statSync(fullPath).mtimeMs
      };
    })
    .filter((entry) => matcher(entry.name))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries[0]?.fullPath ?? "";
}

function cleanReleaseDir() {
  rmSync(releaseDir, { recursive: true, force: true });
}

function runCommonBuildSteps() {
  run(binName("pnpm"), ["-C", "packages/nextclaw-core", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw-runtime", "build"]);
  run(binName("pnpm"), ["-C", "packages/extensions/nextclaw-channel-runtime", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw-ui", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw-openclaw-compat", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw-server", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw", "build"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "lint"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "tsc"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "build:main"], {
    env: { CSC_IDENTITY_AUTO_DISCOVERY: "false" }
  });
}

function verifyMacDesktopPackage() {
  cleanReleaseDir();
  const arch = process.arch === "x64" ? "x64" : "arm64";
  run(binName("pnpm"), [
    "-C",
    "apps/desktop",
    "exec",
    "electron-builder",
    "--mac",
    "dmg",
    `--${arch}`,
    "--publish",
    "never"
  ], {
    env: { CSC_IDENTITY_AUTO_DISCOVERY: "false" }
  });
  const dmgPath = findLatestReleaseFile((name) => name.endsWith(".dmg"));
  if (!dmgPath) {
    throw new Error("No dmg artifact found in apps/desktop/release");
  }
  run("bash", ["apps/desktop/scripts/smoke-macos-dmg.sh", dmgPath, "120"]);
  console.log(`[desktop-verify] macOS package verified: ${dmgPath}`);
}

function verifyWindowsDesktopPackage() {
  cleanReleaseDir();
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  run(binName("pnpm"), [
    "-C",
    "apps/desktop",
    "exec",
    "electron-builder",
    "--win",
    "dir",
    `--${arch}`,
    "--publish",
    "never"
  ], {
    env: { CSC_IDENTITY_AUTO_DISCOVERY: "false" }
  });
  const desktopExePath = resolve(releaseDir, "win-unpacked", "NextClaw Desktop.exe");
  if (!existsSync(desktopExePath)) {
    throw new Error(`No Windows desktop executable found: ${desktopExePath}`);
  }

  const psArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "apps/desktop/scripts/smoke-windows-desktop.ps1",
    "-DesktopExePath",
    desktopExePath,
    "-StartupTimeoutSec",
    "120"
  ];
  if (commandExists("pwsh")) {
    run("pwsh", psArgs);
  } else {
    run("powershell", psArgs);
  }
  console.log(`[desktop-verify] Windows desktop executable verified: ${desktopExePath}`);
}

function verifyLinuxDesktopPackage() {
  cleanReleaseDir();
  if (process.arch !== "x64") {
    throw new Error("Linux package verification currently supports x64 only.");
  }
  run(binName("pnpm"), [
    "-C",
    "apps/desktop",
    "exec",
    "electron-builder",
    "--linux",
    "AppImage",
    "deb",
    "--x64",
    "--publish",
    "never"
  ], {
    env: { CSC_IDENTITY_AUTO_DISCOVERY: "false" }
  });

  const appImagePath = findLatestReleaseFile((name) => name.endsWith(".AppImage"));
  if (!appImagePath) {
    throw new Error("No Linux AppImage artifact found in apps/desktop/release");
  }
  run("bash", ["apps/desktop/scripts/smoke-linux-appimage.sh", appImagePath, "120"]);

  const debPath = findLatestReleaseFile((name) => name.endsWith(".deb"));
  if (!debPath) {
    throw new Error("No Linux deb artifact found in apps/desktop/release");
  }
  run("bash", ["apps/desktop/scripts/smoke-linux-deb.sh", debPath]);
  run(
    binName("node"),
    [
      "scripts/desktop/build-linux-apt-repo.mjs",
      "--input-dir",
      releaseDir,
      "--output-dir",
      resolve(rootDir, "dist/linux-apt-repo-local"),
      "--signing-mode",
      "test"
    ]
  );
  run("bash", ["apps/desktop/scripts/smoke-linux-apt-repo.sh", resolve(rootDir, "dist/linux-apt-repo-local", "apt")]);
  console.log(`[desktop-verify] Linux AppImage verified: ${appImagePath}`);
  console.log(`[desktop-verify] Linux deb verified: ${debPath}`);
}

function main() {
  console.log(`[desktop-verify] platform=${process.platform} arch=${process.arch}`);
  runCommonBuildSteps();

  if (process.platform === "darwin") {
    verifyMacDesktopPackage();
    return;
  }
  if (process.platform === "win32") {
    verifyWindowsDesktopPackage();
    return;
  }
  if (process.platform === "linux") {
    verifyLinuxDesktopPackage();
    return;
  }

  throw new Error(
    "Unsupported platform for local desktop package verification. Use macOS, Windows, or Linux."
  );
}

main();
