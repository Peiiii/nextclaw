#!/usr/bin/env node
import { readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const desktopDir = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const workspaceRoot = resolve(desktopDir, "..", "..");
const desktopPackageJsonPath = resolve(desktopDir, "package.json");
const nextclawPackageJsonPath = resolve(workspaceRoot, "packages", "nextclaw", "package.json");

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
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const desktopPackage = readJson(desktopPackageJsonPath);
  const nextclawPackage = readJson(nextclawPackageJsonPath);
  const platform = args.platform?.trim() || process.platform;
  const arch = args.arch?.trim() || process.arch;
  const bundleVersion = args.version?.trim() || nextclawPackage.version;
  const minimumLauncherVersion = args["minimum-launcher-version"]?.trim() || desktopPackage.version;
  const outputDir = resolve(args["output-dir"]?.trim() || join(desktopDir, "build", "update"));
  const targetPath = resolve(outputDir, "seed-product-bundle.zip");
  const sourcePath = resolve(outputDir, `nextclaw-bundle-${platform}-${arch}-${bundleVersion}.zip`);

  rmSync(targetPath, { force: true });
  runCommand("pnpm", [
    "-C",
    "apps/desktop",
    "bundle:build",
    "--",
    "--platform",
    platform,
    "--arch",
    arch,
    "--version",
    bundleVersion,
    "--minimum-launcher-version",
    minimumLauncherVersion,
    "--output-dir",
    outputDir
  ]);
  renameSync(sourcePath, targetPath);
  process.stdout.write(`${targetPath}\n`);
}

main();
