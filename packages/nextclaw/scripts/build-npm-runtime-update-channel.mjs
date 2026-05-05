#!/usr/bin/env node

import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { lstat, mkdir, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";

const packageRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = resolve(packageRoot, "../..");
const packageJsonPath = resolve(packageRoot, "package.json");
const compatibilityPath = resolve(packageRoot, "npm-runtime-compatibility.json");
const DEFAULT_BASE_URL = "https://Peiiii.github.io/nextclaw/npm-runtime-updates";

const PRUNE_SUFFIXES = [".d.ts", ".d.mts", ".d.cts", ".map", ".md", ".markdown", ".mdx", ".mkd", ".tsbuildinfo"];
const PRUNE_BASENAMES = new Set([
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
const PRUNE_DIR_NAMES = new Set(["__tests__", "__mocks__", "benchmark", "benchmarks", "coverage", "docs", "doc", "example", "examples", "test", "tests", "website"]);

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

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    env: options.env ?? process.env,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${String(result.status ?? 1)}`);
  }
}

function normalizeChannel(channel) {
  return channel?.trim() === "beta" ? "beta" : "stable";
}

function readRequiredString(record, key, context) {
  const value = record?.[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${context} missing required string field: ${key}`);
  }
  return value.trim();
}

function readCompatibilityFloor(channel) {
  const contract = readJson(compatibilityPath);
  return readRequiredString(contract[normalizeChannel(channel)], "minimumLauncherVersion", normalizeChannel(channel));
}

function resolveMinimumLauncherVersion(options) {
  const contractFloor = readCompatibilityFloor(options.channel);
  const explicitFloor = options.minimumLauncherVersion?.trim() || "";
  if (!explicitFloor || explicitFloor === contractFloor) {
    return contractFloor;
  }
  if (options.allowOverride) {
    return explicitFloor;
  }
  throw new Error(
    [
      `minimum launcher version ${explicitFloor} does not match the ${options.channel} NPM runtime contract floor ${contractFloor}.`,
      `Update ${compatibilityPath} only when a launcher-side contract break is explicitly approved.`
    ].join(" ")
  );
}

function normalizePem(value) {
  return value.replaceAll("\\n", "\n");
}

function resolvePrivateKey(args) {
  const inlineKey =
    args["private-key"]?.trim() ||
    process.env.NEXTCLAW_UPDATE_BUNDLE_PRIVATE_KEY?.trim() ||
    process.env.NEXTCLAW_DESKTOP_BUNDLE_PRIVATE_KEY?.trim();
  if (inlineKey) {
    return createPrivateKey(normalizePem(inlineKey));
  }

  const privateKeyPath =
    args["private-key-file"]?.trim() ||
    process.env.NEXTCLAW_UPDATE_BUNDLE_PRIVATE_KEY_FILE?.trim() ||
    process.env.NEXTCLAW_DESKTOP_BUNDLE_PRIVATE_KEY_FILE?.trim();
  if (privateKeyPath) {
    return createPrivateKey(readFileSync(resolve(privateKeyPath), "utf8"));
  }

  throw new Error(
    "Missing runtime update signing key. Provide --private-key, --private-key-file, NEXTCLAW_UPDATE_BUNDLE_PRIVATE_KEY, or NEXTCLAW_UPDATE_BUNDLE_PRIVATE_KEY_FILE."
  );
}

function serializeUnsignedManifest(manifest) {
  return JSON.stringify({
    channel: manifest.channel,
    platform: manifest.platform,
    arch: manifest.arch,
    hostKind: manifest.hostKind,
    latestVersion: manifest.latestVersion,
    minimumLauncherVersion: manifest.minimumLauncherVersion,
    bundleUrl: manifest.bundleUrl,
    bundleSha256: manifest.bundleSha256,
    bundleSignature: manifest.bundleSignature,
    releaseNotesUrl: manifest.releaseNotesUrl
  });
}

async function addDirectoryToZip(zip, sourceDir, zipRoot) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
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
  }));
}

function shouldPruneRuntimeNodeModulesEntry(relativePath, entry) {
  const normalizedRelativePath = relativePath.replaceAll("\\", "/").toLowerCase();
  const pathSegments = normalizedRelativePath.split("/").filter(Boolean);
  const entryName = entry.name.toLowerCase();
  if (entry.isDirectory()) {
    if (!PRUNE_DIR_NAMES.has(entryName)) {
      return false;
    }
    if (pathSegments[0]?.startsWith("@")) {
      return pathSegments.length === 3;
    }
    return pathSegments.length === 2;
  }
  if (PRUNE_BASENAMES.has(entryName)) {
    return true;
  }
  return PRUNE_SUFFIXES.some((suffix) => entryName.endsWith(suffix));
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

class NpmRuntimeUpdateChannelBuilder {
  constructor(args) {
    this.args = args;
    this.channel = normalizeChannel(args.channel);
    this.packageJson = readJson(packageJsonPath);
    this.version = args.version?.trim() || this.packageJson.version;
    this.platform = args.platform?.trim() || process.platform;
    this.arch = args.arch?.trim() || process.arch;
    this.minimumLauncherVersion = resolveMinimumLauncherVersion({
      channel: this.channel,
      minimumLauncherVersion: args["minimum-launcher-version"],
      allowOverride: args["allow-minimum-launcher-version-override"] === "true"
    });
    this.outputRoot = resolve(args["output-dir"]?.trim() || resolve(packageRoot, "dist-npm-runtime-updates"));
    this.baseUrl = args["base-url"]?.trim() || DEFAULT_BASE_URL;
    this.releaseNotesUrl = args["release-notes-url"]?.trim() || null;
  }

  run = async () => {
    const privateKey = resolvePrivateKey(this.args);
    this.writePublicKey(privateKey);
    if (this.args["skip-build"] !== "true") {
      this.ensureFreshRuntimeArtifacts();
    }
    const tempRoot = this.createWorkspaceTempRoot();
    try {
      const workspace = this.createBundleWorkspace(tempRoot);
      const pruneResult = await this.prepareBundleWorkspace(workspace);
      await this.writeBundleManifest(workspace.bundleRoot);
      const bundlePath = await this.writeBundleArchive(workspace.bundleRoot);
      const manifestPath = this.writeUpdateManifest(bundlePath, privateKey);
      this.printResult({ bundlePath, manifestPath, pruneResult });
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  };

  ensureFreshRuntimeArtifacts = () => {
    runCommand("pnpm", ["--filter", "@nextclaw/ui...", "build"]);
    runCommand("pnpm", ["-C", "packages/nextclaw", "build"]);
  };

  writePublicKey = (privateKey) => {
    const outputPath = resolve(this.args["public-key-output"]?.trim() || join(packageRoot, "resources", "update-bundle-public.pem"));
    const channelOutputPath = resolve(this.outputRoot, "update-bundle-public.pem");
    const publicKeyPem = createPublicKey(privateKey).export({ type: "spki", format: "pem" }).toString();
    mkdirSync(dirname(outputPath), { recursive: true });
    mkdirSync(dirname(channelOutputPath), { recursive: true });
    writeFileSync(outputPath, publicKeyPem, "utf8");
    writeFileSync(channelOutputPath, publicKeyPem, "utf8");
  };

  createWorkspaceTempRoot = () => {
    const tempParent = resolve(workspaceRoot, "tmp");
    mkdirSync(tempParent, { recursive: true });
    return mkdtempSync(join(tempParent, "nextclaw-npm-runtime-bundle-"));
  };

  createBundleWorkspace = (tempRoot) => {
    const bundleRoot = join(tempRoot, "bundle");
    return {
      bundleRoot,
      runtimeRoot: join(bundleRoot, "runtime"),
      runtimeDeployPath: relative(workspaceRoot, join(bundleRoot, "runtime"))
    };
  };

  prepareBundleWorkspace = async (workspace) => {
    await mkdir(workspace.bundleRoot, { recursive: true });
    runCommand(
      "pnpm",
      ["--config.node-linker=hoisted", "--filter", "nextclaw", "--prod", "deploy", workspace.runtimeDeployPath],
      { cwd: workspaceRoot }
    );
    return await pruneRuntimeNodeModules(workspace.runtimeRoot);
  };

  writeBundleManifest = async (bundleRoot) => {
    const manifest = {
      bundleVersion: this.version,
      platform: this.platform,
      arch: this.arch,
      uiVersion: this.version,
      runtimeVersion: this.version,
      builtInPluginSetVersion: this.version,
      launcherCompatibility: {
        minVersion: this.minimumLauncherVersion
      },
      entrypoints: {
        runtimeScript: "runtime/dist/cli/app/index.js"
      },
      migrationVersion: 1
    };
    await writeFile(join(bundleRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  };

  writeBundleArchive = async (bundleRoot) => {
    const zip = new JSZip();
    await addDirectoryToZip(zip, bundleRoot, basename(bundleRoot));
    const channelDir = join(this.outputRoot, this.channel);
    const archivePath = resolve(channelDir, `nextclaw-runtime-${this.platform}-${this.arch}-${this.version}.zip`);
    await mkdir(dirname(archivePath), { recursive: true });
    await writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
    return archivePath;
  };

  writeUpdateManifest = (bundlePath, privateKey) => {
    const bundleBytes = readFileSync(bundlePath);
    const manifest = {
      channel: this.channel,
      platform: this.platform,
      arch: this.arch,
      hostKind: "npm-runtime-bundle",
      latestVersion: this.version,
      minimumLauncherVersion: this.minimumLauncherVersion,
      bundleUrl: `${this.baseUrl.replace(/\/+$/, "")}/${this.channel}/${basename(bundlePath)}`,
      bundleSha256: createHash("sha256").update(bundleBytes).digest("hex"),
      bundleSignature: sign(null, bundleBytes, privateKey).toString("base64"),
      releaseNotesUrl: this.releaseNotesUrl
    };
    const signedManifest = {
      ...manifest,
      manifestSignature: sign(null, Buffer.from(serializeUnsignedManifest(manifest)), privateKey).toString("base64")
    };
    const manifestPath = resolve(this.outputRoot, this.channel, `manifest-${this.channel}-${this.platform}-${this.arch}.json`);
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, `${JSON.stringify(signedManifest, null, 2)}\n`, "utf8");
    return manifestPath;
  };

  printResult = ({ bundlePath, manifestPath, pruneResult }) => {
    process.stdout.write(`${JSON.stringify({
      bundlePath,
      manifestPath,
      channel: this.channel,
      version: this.version,
      platform: this.platform,
      arch: this.arch,
      minimumLauncherVersion: this.minimumLauncherVersion,
      prunedNodeModulesEntries: pruneResult.removedEntries
    }, null, 2)}\n`);
  };
}

new NpmRuntimeUpdateChannelBuilder(parseArgs(process.argv.slice(2))).run().catch((error) => {
  console.error(`[build-npm-runtime-update-channel] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
