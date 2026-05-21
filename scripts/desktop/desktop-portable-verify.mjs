#!/usr/bin/env node
import JSZip from "jszip";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve, sep } from "node:path";
import { resolveRepoPath } from "../shared/repo-paths.mjs";

const rootDir = resolveRepoPath(import.meta.url);
const releaseDir = resolve(rootDir, "apps/desktop/release");
const desktopPackageJson = JSON.parse(readFileSync(resolve(rootDir, "apps/desktop/package.json"), "utf8"));
const version = String(desktopPackageJson.version ?? "").trim();

function binName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(command, args, options = {}) {
  console.log(`[desktop-portable-verify] run: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, ...(options.env ?? {}) }
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

async function extractZip(zipPath, outputDir) {
  const resolvedOutputDir = resolve(outputDir);
  const zip = await JSZip.loadAsync(readFileSync(zipPath));
  for (const [name, entry] of Object.entries(zip.files)) {
    const target = resolve(resolvedOutputDir, name);
    const targetRelativePath = relative(resolvedOutputDir, target);
    if (targetRelativePath === ".." || targetRelativePath.startsWith(`..${sep}`) || targetRelativePath === "") {
      throw new Error(`Refusing to extract zip entry outside output dir: ${name}`);
    }
    if (entry.dir) {
      await mkdir(target, { recursive: true });
      continue;
    }
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, await entry.async("nodebuffer"));
  }
}

async function verifyPortableZip(arch) {
  if (!version) {
    throw new Error("Desktop package version is missing.");
  }
  run(binName("pnpm"), ["-C", "apps/desktop", "exec", "node", "scripts/package-windows-portable.mjs", "--arch", arch]);
  const zipPath = resolve(releaseDir, `NextClaw-Portable-${version}-win-${arch}.zip`);
  if (!existsSync(zipPath)) {
    throw new Error(`Portable zip was not created: ${zipPath}`);
  }
  const tempRoot = mkdtempSync(join(tmpdir(), `nextclaw-portable-${arch}-`));
  try {
    await extractZip(zipPath, tempRoot);
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
