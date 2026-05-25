#!/usr/bin/env node
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { resolveRepoPath } from "../shared/repo-paths.mjs";

const rootDir = resolveRepoPath(import.meta.url);
const releaseDir = resolve(rootDir, "apps/desktop/release");
const channelExtensionPackages = [
  "nextclaw-channel-extension-feishu",
  "nextclaw-channel-extension-weixin",
  "nextclaw-channel-extension-qq",
  "nextclaw-channel-extension-dingtalk",
  "nextclaw-channel-extension-telegram",
  "nextclaw-channel-extension-discord",
  "nextclaw-channel-extension-email",
  "nextclaw-channel-extension-slack",
  "nextclaw-channel-extension-wecom",
  "nextclaw-channel-extension-whatsapp"
];

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

function buildWindowsArtifacts(arch, env) {
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
  run(
    binName("pnpm"),
    [
      "-C",
      "apps/desktop",
      "exec",
      "electron-builder",
      "--win",
      "nsis",
      `--${arch}`,
      "--publish",
      "never"
    ],
    { env }
  );
  run(binName("pnpm"), ["-C", "apps/desktop", "package:windows-portable", "--", "--arch", arch], { env });
}

function runSharedBuildSteps(env) {
  run(binName("pnpm"), ["-C", "packages/nextclaw-core", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw-runtime", "build"]);
  for (const packageName of channelExtensionPackages) {
    run(binName("pnpm"), ["-C", `packages/extensions/${packageName}`, "build"]);
  }
  run(binName("pnpm"), ["-C", "packages/nextclaw-ui", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw-server", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw", "build"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "bundle:public-key:ensure"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "bundle:seed", "--", "--channel", "stable"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "build:main"], { env });
}

function packageForCurrentPlatform() {
  const arch = process.arch === "x64" ? "x64" : "arm64";
  const env = { CSC_IDENTITY_AUTO_DISCOVERY: "false" };

  rmSync(releaseDir, { recursive: true, force: true });
  runSharedBuildSteps(env);

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
    buildWindowsArtifacts(arch, env);
    const unpackedDirName = arch === "arm64" ? "win-arm64-unpacked" : "win-unpacked";
    const unpackedExe = resolve(releaseDir, unpackedDirName, "NextClaw Desktop.exe");
    printArtifacts(
      [
        unpackedExe,
        ...readArtifacts().filter((path) => {
          const name = basename(path);
          return (
            path.endsWith(unpackedDirName) ||
            name.startsWith("NextClaw-Portable-") ||
            (name.endsWith(".exe") && name.includes("Setup")) ||
            name === "latest.yml" ||
            name.endsWith(".exe.blockmap")
          );
        })
      ]
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
        "deb",
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
        path.endsWith(".deb") ||
        path.endsWith("latest-linux.yml")
      )
    );
    return;
  }

  throw new Error("Unsupported platform. Run this command on macOS, Windows, or Linux.");
}

packageForCurrentPlatform();
