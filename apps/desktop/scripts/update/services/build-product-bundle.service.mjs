#!/usr/bin/env node
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { cp, lstat, mkdir, readdir, realpath, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";

const desktopDir = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const workspaceRoot = resolve(desktopDir, "..", "..");
const nextclawPackageRoot = resolve(workspaceRoot, "packages", "nextclaw");
const desktopPackageJsonPath = resolve(desktopDir, "package.json");
const nextclawPackageJsonPath = resolve(nextclawPackageRoot, "package.json");

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

function readRequiredOption(args, key, fallback) {
  const value = args[key]?.trim() || fallback;
  if (!value) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "pipe",
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    if (result.stdout) {
      process.stderr.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
  }
}

function ensureFreshRuntimeArtifacts() {
  runCommand("pnpm", ["-C", "packages/nextclaw-ui", "build"], workspaceRoot);
  runCommand("pnpm", ["-C", "packages/nextclaw", "build"], workspaceRoot);
}

async function addDirectoryToZip(zip, sourceDir, zipRoot) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = join(sourceDir, entry.name);
      const targetPath = join(zipRoot, entry.name).replaceAll("\\", "/");
      let sourceStat;
      try {
        sourceStat = entry.isSymbolicLink() ? await stat(sourcePath) : await lstat(sourcePath);
      } catch {
        return;
      }
      if (sourceStat.isDirectory()) {
        const directoryPath = entry.isSymbolicLink() ? await realpath(sourcePath) : sourcePath;
        await addDirectoryToZip(zip, directoryPath, targetPath);
        return;
      }
      const filePath = entry.isSymbolicLink() ? await realpath(sourcePath) : sourcePath;
      zip.file(targetPath, readFileSync(filePath));
    })
  );
}

async function buildBundleArchive(args) {
  const nextclawPackage = readJson(nextclawPackageJsonPath);
  const desktopPackage = readJson(desktopPackageJsonPath);
  const bundleVersion = readRequiredOption(args, "version", nextclawPackage.version);
  const platform = readRequiredOption(args, "platform", process.platform);
  const arch = readRequiredOption(args, "arch", process.arch);
  const minimumLauncherVersion = readRequiredOption(args, "minimum-launcher-version", desktopPackage.version);
  const outputDir = resolve(args["output-dir"]?.trim() || join(desktopDir, "dist-bundles"));

  ensureFreshRuntimeArtifacts();
  runCommand("node", [resolve(desktopDir, "scripts", "ensure-runtime.mjs")], workspaceRoot);

  const tempRoot = mkdtempSync(join(tmpdir(), "nextclaw-product-bundle-"));
  const bundleRoot = join(tempRoot, "bundle");
  const runtimeRoot = join(bundleRoot, "runtime");
  const uiRoot = join(bundleRoot, "ui");
  const pluginsRoot = join(bundleRoot, "plugins");

  try {
    await mkdir(bundleRoot, { recursive: true });
    runCommand(
      "pnpm",
      ["--config.node-linker=hoisted", "--filter", "nextclaw", "--prod", "deploy", runtimeRoot],
      workspaceRoot
    );
    await cp(join(runtimeRoot, "ui-dist"), uiRoot, { recursive: true });
    await mkdir(pluginsRoot, { recursive: true });
    await writeFile(join(pluginsRoot, ".keep"), "\n", "utf8");

    const manifest = {
      bundleVersion,
      platform,
      arch,
      uiVersion: bundleVersion,
      runtimeVersion: bundleVersion,
      builtInPluginSetVersion: bundleVersion,
      launcherCompatibility: {
        minVersion: minimumLauncherVersion
      },
      entrypoints: {
        runtimeScript: "runtime/dist/cli/index.js"
      },
      migrationVersion: 1
    };
    await writeFile(join(bundleRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const zip = new JSZip();
    await addDirectoryToZip(zip, bundleRoot, basename(bundleRoot));
    const archiveName = `nextclaw-bundle-${platform}-${arch}-${bundleVersion}.zip`;
    const archivePath = resolve(outputDir, archiveName);
    await mkdir(dirname(archivePath), { recursive: true });
    await writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));

    process.stdout.write(
      `${JSON.stringify(
        {
          archivePath,
          bundleVersion,
          platform,
          arch,
          runtimeRoot: relative(workspaceRoot, runtimeRoot),
          uiRoot: relative(workspaceRoot, uiRoot)
        },
        null,
        2
      )}\n`
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

buildBundleArchive(parseArgs(process.argv.slice(2))).catch((error) => {
  console.error(`[build-product-bundle] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
