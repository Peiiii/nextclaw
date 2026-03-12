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
  console.log(`[desktop-package] run: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, ...(options.env ?? {}) }
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
  return result;
}

function readArtifacts() {
  if (!existsSync(releaseDir)) {
    return [];
  }
  return readdirSync(releaseDir)
    .map((name) => {
      const path = resolve(releaseDir, name);
      return { name, path, mtimeMs: statSync(path).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .map((entry) => entry.path);
}

function printArtifacts(paths) {
  if (paths.length === 0) {
    throw new Error(`No artifacts found in ${releaseDir}`);
  }
  console.log("[desktop-package] artifacts:");
  for (const artifactPath of paths) {
    console.log(`- ${artifactPath}`);
  }
}

function packageForCurrentPlatform() {
  const arch = process.arch === "x64" ? "x64" : "arm64";
  const env = { CSC_IDENTITY_AUTO_DISCOVERY: "false" };

  rmSync(releaseDir, { recursive: true, force: true });

  run(binName("pnpm"), ["-C", "packages/nextclaw-core", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw-runtime", "build"]);
  run(binName("pnpm"), ["-C", "packages/extensions/nextclaw-channel-runtime", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw-ui", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw-openclaw-compat", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw-server", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw", "build"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "build:main"], { env });

  if (process.platform === "darwin") {
    run(
      binName("pnpm"),
      [
        "-C",
        "apps/desktop",
        "exec",
        "electron-builder",
        "--mac",
        "dmg",
        "zip",
        `--${arch}`,
        "--publish",
        "never"
      ],
      { env }
    );
    printArtifacts(
      readArtifacts().filter((path) =>
        path.endsWith(".dmg") || path.endsWith(".zip") || path.endsWith(".yml") || path.endsWith(".blockmap")
      )
    );
    return;
  }

  if (process.platform === "win32") {
    run(
      binName("pnpm"),
      [
        "-C",
        "apps/desktop",
        "exec",
        "electron-builder",
        "--win",
        "dir",
        `--${arch}`,
        "--publish",
        "never"
      ],
      { env }
    );
    const unpackedExe = resolve(releaseDir, "win-unpacked", "NextClaw Desktop.exe");
    printArtifacts(
      [unpackedExe, ...readArtifacts().filter((path) => path.endsWith("win-unpacked"))]
    );
    return;
  }

  if (process.platform === "linux") {
    if (arch !== "x64") {
      throw new Error("Linux packaging currently supports x64 only.");
    }
    run(
      binName("pnpm"),
      [
        "-C",
        "apps/desktop",
        "exec",
        "electron-builder",
        "--linux",
        "AppImage",
        "--x64",
        "--publish",
        "never"
      ],
      { env }
    );
    printArtifacts(
      readArtifacts().filter((path) =>
        path.endsWith(".AppImage") ||
        path.endsWith(".AppImage.blockmap") ||
        path.endsWith("latest-linux.yml")
      )
    );
    return;
  }

  throw new Error("Unsupported platform. Run this command on macOS, Windows, or Linux.");
}

packageForCurrentPlatform();
