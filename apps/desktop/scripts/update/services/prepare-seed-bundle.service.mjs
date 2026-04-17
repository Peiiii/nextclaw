#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";
import {
  normalizeDesktopUpdateChannel,
  resolveGovernedMinimumLauncherVersion
} from "./launcher-compatibility.service.mjs";

const desktopDir = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const workspaceRoot = resolve(desktopDir, "..", "..");
const nextclawPackageJsonPath = resolve(workspaceRoot, "packages", "nextclaw", "package.json");
const releaseMetadataPath = resolve(desktopDir, "build", "update-release-metadata.json");

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = value;
    index += 1;
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    process.exit(result.status ?? 1);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  return result.stdout;
}

async function buildSeedBundleMetadata(seedBundlePath, bundleVersion) {
  const archiveBytes = readFileSync(seedBundlePath);
  const archive = await JSZip.loadAsync(archiveBytes);
  let fileCount = 0;
  let directoryCount = 0;
  let uncompressedBytes = 0;

  for (const entry of Object.values(archive.files)) {
    if (entry.dir) {
      directoryCount += 1;
      continue;
    }
    fileCount += 1;
    uncompressedBytes += entry._data?.uncompressedSize ?? 0;
  }

  return {
    version: bundleVersion,
    sha256: createHash("sha256").update(archiveBytes).digest("hex"),
    archiveBytes: archiveBytes.length,
    fileCount,
    directoryCount,
    uncompressedBytes
  };
}

function updateReleaseMetadata(seedBundleMetadata) {
  if (!existsSync(releaseMetadataPath)) {
    return;
  }
  const currentMetadata = JSON.parse(readFileSync(releaseMetadataPath, "utf8"));
  writeFileSync(
    releaseMetadataPath,
    `${JSON.stringify({ ...currentMetadata, seedBundle: seedBundleMetadata }, null, 2)}\n`,
    "utf8"
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const nextclawPackage = readJson(nextclawPackageJsonPath);
  const platform = args.platform?.trim() || process.platform;
  const arch = args.arch?.trim() || process.arch;
  const channel = normalizeDesktopUpdateChannel(args.channel);
  const bundleVersion = args.version?.trim() || nextclawPackage.version;
  const minimumLauncherVersion = resolveGovernedMinimumLauncherVersion({
    channel,
    minimumLauncherVersion: args["minimum-launcher-version"],
    allowOverride: args["allow-minimum-launcher-version-override"] === "true"
  });
  const outputDir = resolve(args["output-dir"]?.trim() || join(desktopDir, "build", "update"));
  const targetPath = resolve(outputDir, "seed-product-bundle.zip");
  const sourcePath = resolve(outputDir, `nextclaw-bundle-${platform}-${arch}-${bundleVersion}.zip`);
  const buildArgs = [
    "-C",
    "apps/desktop",
    "bundle:build",
    "--",
    "--platform",
    platform,
    "--arch",
    arch,
    "--channel",
    channel,
    "--version",
    bundleVersion,
    "--minimum-launcher-version",
    minimumLauncherVersion,
    "--output-dir",
    outputDir
  ];
  if (args["allow-minimum-launcher-version-override"] === "true") {
    buildArgs.push("--allow-minimum-launcher-version-override", "true");
  }

  rmSync(targetPath, { force: true });
  const buildResult = runCommand("pnpm", buildArgs);
  if (buildResult.trim()) {
    process.stdout.write(buildResult);
  }
  renameSync(sourcePath, targetPath);
  const seedBundleMetadata = await buildSeedBundleMetadata(targetPath, bundleVersion);
  updateReleaseMetadata(seedBundleMetadata);
  process.stdout.write(`${targetPath}\n`);
}

main().catch((error) => {
  console.error(`[prepare-seed-bundle] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
