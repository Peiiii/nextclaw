#!/usr/bin/env node
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveRepoPath } from "../shared/repo-paths.mjs";

const rootDir = resolveRepoPath(import.meta.url);
const releaseDir = resolve(rootDir, "apps/desktop/release");
const nextclawPackageJsonPath = resolve(rootDir, "packages/nextclaw/package.json");

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
  run(binName("pnpm"), ["-C", "apps/desktop", "bundle:seed"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "lint"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "tsc"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "build:main"], {
    env: { CSC_IDENTITY_AUTO_DISCOVERY: "false" }
  });
}

function readExpectedBundleVersion() {
  const nextclawPackage = JSON.parse(readFileSync(nextclawPackageJsonPath, "utf8"));
  const version = typeof nextclawPackage.version === "string" ? nextclawPackage.version.trim() : "";
  if (!version) {
    throw new Error(`Invalid nextclaw package version: ${nextclawPackageJsonPath}`);
  }
  return version;
}

function readZipBundleVersion(zipPath) {
  const script = [
    "const JSZip=require('jszip');",
    "const fs=require('fs');",
    "const zipPath=process.argv[1];",
    "JSZip.loadAsync(fs.readFileSync(zipPath))",
    "  .then(async (zip) => {",
    "    const manifestEntry = zip.file('bundle/manifest.json');",
    "    if (!manifestEntry) throw new Error(`bundle/manifest.json missing: ${zipPath}`);",
    "    const manifest = JSON.parse(await manifestEntry.async('string'));",
    "    if (!manifest?.bundleVersion || typeof manifest.bundleVersion !== 'string') {",
    "      throw new Error(`bundleVersion missing: ${zipPath}`);",
    "    }",
    "    console.log(manifest.bundleVersion.trim());",
    "  })",
    "  .catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });"
  ].join(" ");
  const result = spawnSync(binName("pnpm"), ["-C", "apps/desktop", "exec", "node", "-e", script, zipPath], {
    cwd: rootDir,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`Failed to read bundleVersion from ${zipPath}: ${result.stderr || result.stdout}`);
  }
  const bundleVersion = result.stdout.trim();
  if (!bundleVersion) {
    throw new Error(`Empty bundleVersion from ${zipPath}`);
  }
  return bundleVersion;
}

function assertSeedBundleVersion(seedBundlePath) {
  const expectedVersion = readExpectedBundleVersion();
  const actualVersion = readZipBundleVersion(seedBundlePath);
  if (actualVersion !== expectedVersion) {
    throw new Error(
      `Packaged seed bundle version mismatch: expected ${expectedVersion} but got ${actualVersion} (${seedBundlePath})`
    );
  }
  console.log(`[desktop-verify] seed bundle version verified: ${actualVersion}`);
}

function verifySeedBundleRuntimeInit(seedBundlePath) {
  const tempRoot = mkdtempSync(join(tmpdir(), "nextclaw-seed-runtime-verify-"));
  const extractRoot = resolve(tempRoot, "extract");
  const runtimeHome = resolve(tempRoot, "home");
  try {
    run("ditto", ["-x", "-k", seedBundlePath, extractRoot]);
    const runtimeScriptPath = resolve(extractRoot, "bundle", "runtime", "dist", "cli", "index.js");
    if (!existsSync(runtimeScriptPath)) {
      throw new Error(`Packaged seed runtime script missing: ${runtimeScriptPath}`);
    }
    run(binName("node"), [runtimeScriptPath, "init"], {
      env: {
        NEXTCLAW_HOME: runtimeHome
      }
    });
    console.log(`[desktop-verify] seed runtime init verified: ${runtimeScriptPath}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
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
  const mountedAppRoot = resolve(releaseDir, `mac-${arch}`, "NextClaw Desktop.app");
  const seedBundlePath = resolve(mountedAppRoot, "Contents/Resources/update/seed-product-bundle.zip");
  if (!existsSync(seedBundlePath)) {
    throw new Error(`Packaged seed bundle missing: ${seedBundlePath}`);
  }
  assertSeedBundleVersion(seedBundlePath);
  verifySeedBundleRuntimeInit(seedBundlePath);
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
