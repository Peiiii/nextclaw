#!/usr/bin/env node
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { cp, lstat, mkdir, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";

const desktopDir = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const workspaceRoot = resolve(desktopDir, "..", "..");
const nextclawPackageRoot = resolve(workspaceRoot, "packages", "nextclaw");
const desktopPackageJsonPath = resolve(desktopDir, "package.json");
const nextclawPackageJsonPath = resolve(nextclawPackageRoot, "package.json");
const RUNTIME_NODE_MODULES_PRUNE_SUFFIXES = [
  ".d.ts",
  ".d.mts",
  ".d.cts",
  ".map",
  ".md",
  ".markdown",
  ".mdx",
  ".mkd",
  ".tsbuildinfo"
];
const RUNTIME_NODE_MODULES_PRUNE_BASENAMES = new Set([
  ".editorconfig",
  ".eslintignore",
  ".eslintrc",
  ".eslintrc.cjs",
  ".eslintrc.js",
  ".eslintrc.json",
  ".gitattributes",
  ".gitignore",
  ".npmignore",
  ".nycrc",
  ".prettierignore",
  ".prettierrc",
  ".prettierrc.cjs",
  ".prettierrc.js",
  ".prettierrc.json",
  "changes.md",
  "changelog.md",
  "contributing.md",
  "history.md",
  "readme.md"
]);
const RUNTIME_NODE_MODULES_PRUNE_DIR_NAMES = new Set([
  "__tests__",
  "__mocks__",
  "benchmark",
  "benchmarks",
  "coverage",
  "docs",
  "doc",
  "example",
  "examples",
  "test",
  "tests",
  "website"
]);

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

function createWorkspaceTempRoot() {
  const tempParent = resolve(workspaceRoot, "tmp");
  mkdirSync(tempParent, { recursive: true });
  return mkdtempSync(join(tempParent, "nextclaw-product-bundle-"));
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

function shouldPruneRuntimeNodeModulesEntry(relativePath, entry) {
  const normalizedRelativePath = relativePath.replaceAll("\\", "/").toLowerCase();
  const pathSegments = normalizedRelativePath.split("/").filter(Boolean);
  const basename = entry.name.toLowerCase();
  if (entry.isDirectory()) {
    if (!RUNTIME_NODE_MODULES_PRUNE_DIR_NAMES.has(basename)) {
      return false;
    }
    if (pathSegments[0]?.startsWith("@")) {
      return pathSegments.length === 3;
    }
    return pathSegments.length === 2;
  }
  if (RUNTIME_NODE_MODULES_PRUNE_BASENAMES.has(basename)) {
    return true;
  }
  if (RUNTIME_NODE_MODULES_PRUNE_SUFFIXES.some((suffix) => basename.endsWith(suffix))) {
    return true;
  }
  return false;
}

async function pruneRuntimeNodeModules(runtimeRoot) {
  const nodeModulesRoot = join(runtimeRoot, "node_modules");
  try {
    const nodeModulesStat = await stat(nodeModulesRoot);
    if (!nodeModulesStat.isDirectory()) {
      return { removedEntries: 0 };
    }
  } catch {
    return { removedEntries: 0 };
  }

  let removedEntries = 0;
  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(currentDir, entry.name);
      const relativePath = relative(nodeModulesRoot, entryPath);
      if (shouldPruneRuntimeNodeModulesEntry(relativePath, entry)) {
        await rm(entryPath, { recursive: true, force: true });
        removedEntries += 1;
        continue;
      }
      if (entry.isDirectory()) {
        await walk(entryPath);
      }
    }
  }

  await walk(nodeModulesRoot);
  return { removedEntries };
}

function resolveBundleBuildOptions(args) {
  const nextclawPackage = readJson(nextclawPackageJsonPath);
  const desktopPackage = readJson(desktopPackageJsonPath);
  return {
    bundleVersion: readRequiredOption(args, "version", nextclawPackage.version),
    platform: readRequiredOption(args, "platform", process.platform),
    arch: readRequiredOption(args, "arch", process.arch),
    minimumLauncherVersion: readRequiredOption(args, "minimum-launcher-version", desktopPackage.version),
    outputDir: resolve(args["output-dir"]?.trim() || join(desktopDir, "dist-bundles"))
  };
}

function createBundleWorkspace(tempRoot) {
  const bundleRoot = join(tempRoot, "bundle");
  const runtimeRoot = join(bundleRoot, "runtime");
  const uiRoot = join(bundleRoot, "ui");
  const pluginsRoot = join(bundleRoot, "plugins");
  return {
    bundleRoot,
    runtimeRoot,
    uiRoot,
    pluginsRoot,
    runtimeDeployPath: relative(workspaceRoot, runtimeRoot)
  };
}

async function prepareBundleWorkspace(workspace) {
  ensureFreshRuntimeArtifacts();
  runCommand("node", [resolve(desktopDir, "scripts", "ensure-runtime.mjs")], workspaceRoot);
  await mkdir(workspace.bundleRoot, { recursive: true });
  runCommand(
    "pnpm",
    ["--config.node-linker=hoisted", "--filter", "nextclaw", "--prod", "deploy", workspace.runtimeDeployPath],
    workspaceRoot
  );
  const pruneResult = await pruneRuntimeNodeModules(workspace.runtimeRoot);
  await cp(join(workspace.runtimeRoot, "ui-dist"), workspace.uiRoot, { recursive: true });
  await mkdir(workspace.pluginsRoot, { recursive: true });
  await writeFile(join(workspace.pluginsRoot, ".keep"), "\n", "utf8");
  return pruneResult;
}

async function writeBundleManifest(bundleRoot, options) {
  const { bundleVersion, platform, arch, minimumLauncherVersion } = options;
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
}

async function writeBundleArchive(bundleRoot, options) {
  const { platform, arch, bundleVersion, outputDir } = options;
  const zip = new JSZip();
  await addDirectoryToZip(zip, bundleRoot, basename(bundleRoot));
  const archiveName = `nextclaw-bundle-${platform}-${arch}-${bundleVersion}.zip`;
  const archivePath = resolve(outputDir, archiveName);
  await mkdir(dirname(archivePath), { recursive: true });
  await writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return archivePath;
}

function reportBundleBuildResult(archivePath, options, workspace, pruneResult) {
  process.stdout.write(
    `${JSON.stringify(
      {
        archivePath,
        bundleVersion: options.bundleVersion,
        platform: options.platform,
        arch: options.arch,
        prunedNodeModulesEntries: pruneResult.removedEntries,
        runtimeRoot: relative(workspaceRoot, workspace.runtimeRoot),
        uiRoot: relative(workspaceRoot, workspace.uiRoot)
      },
      null,
      2
    )}\n`
  );
}

async function buildBundleArchive(args) {
  const options = resolveBundleBuildOptions(args);
  const tempRoot = createWorkspaceTempRoot();
  const workspace = createBundleWorkspace(tempRoot);

  try {
    const pruneResult = await prepareBundleWorkspace(workspace);
    await writeBundleManifest(workspace.bundleRoot, options);
    const archivePath = await writeBundleArchive(workspace.bundleRoot, options);
    reportBundleBuildResult(archivePath, options, workspace, pruneResult);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

buildBundleArchive(parseArgs(process.argv.slice(2))).catch((error) => {
  console.error(`[build-product-bundle] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
