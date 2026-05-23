#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { resolveRepoPath } from "../shared/repo-paths.mjs";

const rootDir = resolveRepoPath(import.meta.url);
const releaseDir = resolve(rootDir, "apps/desktop/release");
const desktopPackageJson = JSON.parse(readFileSync(resolve(rootDir, "apps/desktop/package.json"), "utf8"));
const version = String(desktopPackageJson.version ?? "").trim();

function run(command, args, options = {}) {
  console.log(`[desktop-portable-verify] run: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, ...(options.env ?? {}) }
  });
  if (result.status !== 0) {
    const details = [
      `status=${String(result.status)}`,
      `signal=${String(result.signal)}`,
      result.error ? `error=${result.error.message}` : ""
    ].filter(Boolean);
    throw new Error(`Command failed (${details.join(", ")}): ${command} ${args.join(" ")}`);
  }
}

function quotePowerShellString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function extractZip(zipPath, outputDir) {
  run("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    `Expand-Archive -LiteralPath ${quotePowerShellString(zipPath)} -DestinationPath ${quotePowerShellString(outputDir)} -Force`
  ]);
}

function ensurePortableZip(arch) {
  const zipPath = resolve(releaseDir, `NextClaw-Portable-${version}-win-${arch}.zip`);
  if (existsSync(zipPath)) {
    return zipPath;
  }
  run(process.execPath, [resolve(rootDir, "apps/desktop/scripts/package-windows-portable.mjs"), "--arch", arch]);
  if (!existsSync(zipPath)) {
    throw new Error(`Portable zip was not created: ${zipPath}`);
  }
  return zipPath;
}

async function verifyPortableZip(arch) {
  if (!version) {
    throw new Error("Desktop package version is missing.");
  }
  const zipPath = ensurePortableZip(arch);
  const tempRoot = mkdtempSync(join(tmpdir(), `nextclaw-portable-${arch}-`));
  try {
    extractZip(zipPath, tempRoot);
    const portableRoot = resolve(tempRoot, "NextClaw-Portable");
    const markerPath = resolve(portableRoot, "nextclaw-portable.json");
    const exePath = resolve(portableRoot, "NextClaw Desktop.exe");
    if (!existsSync(markerPath)) {
      throw new Error(`Portable marker missing after extraction: ${markerPath}`);
    }
    if (!existsSync(exePath)) {
      throw new Error(`Portable executable missing after extraction: ${exePath}`);
    }
    console.log(`[desktop-portable-verify] extracted ${basename(zipPath)} to ${portableRoot}`);
    if (process.platform === "win32" && arch === "x64") {
      run("powershell", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        "apps/desktop/scripts/smoke-windows-desktop.ps1",
        "-DesktopExePath",
        exePath,
        "-PortableRoot",
        portableRoot,
        "-StartupTimeoutSec",
        "180",
        "-MaxReadySec",
        "20"
      ]);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

if (process.platform !== "win32") {
  throw new Error("desktop:portable:verify must run on Windows so the portable executable can be smoke-tested.");
}

await verifyPortableZip("x64");
