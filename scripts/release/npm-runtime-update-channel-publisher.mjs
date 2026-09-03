#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST_FILE_PATTERN = /^manifest-(stable|beta)-([^-]+)-(.+)\.json$/;
const REQUIRED_STRING_FIELDS = [
  "channel",
  "platform",
  "arch",
  "hostKind",
  "latestVersion",
  "minimumLauncherVersion",
  "bundleUrl",
  "bundleSha256",
  "bundleSignature",
  "manifestSignature"
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${token}.`);
    args[token.slice(2)] = value;
    index += 1;
  }
  return args;
}

function readRequiredOption(args, key) {
  const value = args[key]?.trim();
  if (!value) throw new Error(`Missing required option --${key}.`);
  return value;
}

function normalizeChannel(value) {
  if (value !== "stable" && value !== "beta") throw new Error("releaseChannel must be stable or beta.");
  return value;
}

function parseVersion(version) {
  const [core = "", prerelease = ""] = version.split("+")[0]?.split("-", 2) ?? [];
  return {
    core: core.split(".").map((part) => Number.parseInt(part, 10) || 0),
    prerelease
  };
}

export function compareNpmRuntimeVersions(left, right) {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  const length = Math.max(leftVersion.core.length, rightVersion.core.length);
  for (let index = 0; index < length; index += 1) {
    const compared = (leftVersion.core[index] ?? 0) - (rightVersion.core[index] ?? 0);
    if (compared !== 0) return compared;
  }
  if (!leftVersion.prerelease || !rightVersion.prerelease) {
    return Number(!leftVersion.prerelease) - Number(!rightVersion.prerelease);
  }
  return leftVersion.prerelease.localeCompare(rightVersion.prerelease, undefined, { numeric: true });
}

function findManifestPaths(rootDir) {
  if (!existsSync(rootDir)) throw new Error(`NPM runtime artifact directory does not exist: ${rootDir}`);
  const paths = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && MANIFEST_FILE_PATTERN.test(entry.name)) paths.push(entryPath);
    }
  };
  visit(rootDir);
  return paths.sort();
}

function readManifest(filePath) {
  const fileName = basename(filePath);
  const match = fileName.match(MANIFEST_FILE_PATTERN);
  if (!match) throw new Error(`Invalid NPM runtime manifest filename: ${filePath}`);
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof parsed[field] !== "string" || !parsed[field].trim()) {
      throw new Error(`${fileName} missing required string field: ${field}`);
    }
  }
  const [, fileChannel, filePlatform, fileArch] = match;
  if (parsed.channel !== fileChannel) throw new Error(`${fileName} channel mismatch.`);
  if (parsed.platform !== filePlatform || parsed.arch !== fileArch) throw new Error(`${fileName} target mismatch.`);
  if (parsed.hostKind !== "npm-runtime-bundle") throw new Error(`${fileName} hostKind mismatch.`);
  return { fileName, filePath, channel: fileChannel, target: `${filePlatform}/${fileArch}`, manifest: parsed };
}

function copyManifest(entry, stateDir) {
  const targetPath = join(stateDir, "npm-runtime-updates", entry.channel, entry.fileName);
  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(entry.filePath, targetPath);
  return targetPath;
}

function assertUniqueTargets(entries, label) {
  const targets = new Set();
  for (const entry of entries) {
    if (targets.has(entry.target)) throw new Error(`Duplicate ${label} manifest for ${entry.target}.`);
    targets.add(entry.target);
  }
}

function assertCompatibilityPair(stable, beta) {
  if (!beta) throw new Error(`Stable NPM runtime release requires a beta compatibility manifest for ${stable.target}.`);
  for (const field of ["latestVersion", "minimumLauncherVersion", "bundleUrl", "bundleSha256", "bundleSignature", "releaseNotesUrl"]) {
    if (stable.manifest[field] !== beta.manifest[field]) {
      throw new Error(`Stable/beta compatibility manifests disagree on ${field} for ${stable.target}.`);
    }
  }
}

function stageCompatibilityManifest(entry, stateDir) {
  const targetPath = join(stateDir, "npm-runtime-updates", "beta", entry.fileName);
  if (existsSync(targetPath)) {
    const current = readManifest(targetPath);
    if (compareNpmRuntimeVersions(entry.manifest.latestVersion, current.manifest.latestVersion) <= 0) {
      return { action: "preserved-newer-beta-manifest", target: entry.target, version: current.manifest.latestVersion };
    }
  }
  copyManifest(entry, stateDir);
  return { action: "published-compatibility-projection", target: entry.target, version: entry.manifest.latestVersion };
}

export function stageNpmRuntimeUpdateChannelFiles(options) {
  const artifactsDir = resolve(options.artifactsDir);
  const stateDir = resolve(options.stateDir);
  const releaseChannel = normalizeChannel(options.releaseChannel);
  const manifests = findManifestPaths(artifactsDir).map(readManifest);
  const nativeManifests = manifests.filter((entry) => entry.channel === releaseChannel);
  const compatibilityManifests = manifests.filter((entry) => entry.channel !== releaseChannel);
  if (nativeManifests.length === 0) throw new Error(`No native ${releaseChannel} NPM runtime manifests found.`);
  assertUniqueTargets(nativeManifests, releaseChannel);
  assertUniqueTargets(compatibilityManifests, "compatibility");
  if (releaseChannel === "beta" && compatibilityManifests.length > 0) {
    throw new Error("Beta NPM runtime releases must not contain compatibility manifests.");
  }

  const events = nativeManifests.map((entry) => {
    copyManifest(entry, stateDir);
    return { action: "published-native-manifest", channel: entry.channel, target: entry.target, version: entry.manifest.latestVersion };
  });
  if (releaseChannel === "stable") {
    const compatibilityByTarget = new Map(compatibilityManifests.map((entry) => [entry.target, entry]));
    if (compatibilityManifests.length !== nativeManifests.length) {
      throw new Error("Stable NPM runtime release requires one beta compatibility manifest per target.");
    }
    for (const stable of nativeManifests) {
      const beta = compatibilityByTarget.get(stable.target);
      assertCompatibilityPair(stable, beta);
      events.push(stageCompatibilityManifest(beta, stateDir));
    }
  }

  const publicKeyPath = join(artifactsDir, "update-bundle-public.pem");
  if (existsSync(publicKeyPath)) {
    const targetPath = join(stateDir, "npm-runtime-updates", "update-bundle-public.pem");
    mkdirSync(dirname(targetPath), { recursive: true });
    cpSync(publicKeyPath, targetPath);
  }
  return events;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const events = stageNpmRuntimeUpdateChannelFiles({
    artifactsDir: readRequiredOption(args, "artifacts-dir"),
    stateDir: readRequiredOption(args, "state-dir"),
    releaseChannel: readRequiredOption(args, "release-channel")
  });
  for (const event of events) process.stdout.write(`[npm-runtime:update-channel] ${JSON.stringify(event)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
