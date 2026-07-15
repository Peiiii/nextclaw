import { createHash, generateKeyPairSync } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  runUpdateVerificationCommand,
  runUpdateVerificationStage
} from "../utils/update-verification-command.utils.mjs";

const workspaceRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const nextclawPackageRoot = join(workspaceRoot, "packages/nextclaw");
const nextclawUiPackageRoot = join(workspaceRoot, "packages/nextclaw-ui");
const nextclawUiOutputRoot = join(nextclawUiPackageRoot, "dist");
const updateBuilderPath = join(nextclawPackageRoot, "scripts/build-npm-runtime-update-channel.mjs");
const syncUsageResourcePath = join(nextclawPackageRoot, "scripts/sync-usage-resource.mjs");
const copyUiDistPath = join(nextclawPackageRoot, "scripts/copy-ui-dist.mjs");
const fixtureCacheRoot = join(workspaceRoot, "tmp/nextclaw-update-verification-cache");
const runtimeDeployCacheRoot = join(workspaceRoot, "tmp/nextclaw-update-verification-runtime-cache");
const fixtureCacheSchemaVersion = 1;
const runtimeDeployCacheSchemaVersion = 1;
const fingerprintIgnoredDirectoryNames = new Set([
  ".cache",
  ".turbo",
  "__mocks__",
  "__tests__",
  "coverage",
  "dist",
  "dist-npm-runtime-updates",
  "node_modules",
  "release",
  "test",
  "tests",
  "tmp",
  "ui-dist"
]);
const fingerprintIgnoredFilePattern = /(?:\.(?:spec|test)\.[cm]?[jt]sx?|\.snap)$/;
const fingerprintInputPaths = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "tsconfig.base.json",
  "tsconfig.paths.json",
  "docs/USAGE.md",
  "scripts/dev/dev-runtime.tsconfig.json",
  "packages"
];

function updateFingerprintFromPath(hash, targetPath) {
  const relativePath = relative(workspaceRoot, targetPath).replaceAll("\\", "/");
  if (!existsSync(targetPath)) {
    hash.update(`missing:${relativePath}\0`);
    return;
  }

  const targetStat = lstatSync(targetPath);
  if (targetStat.isSymbolicLink()) {
    hash.update(`link:${relativePath}\0${readlinkSync(targetPath)}\0`);
    return;
  }
  if (targetStat.isDirectory()) {
    hash.update(`dir:${relativePath}\0`);
    for (const entry of readdirSync(targetPath, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.isDirectory() && fingerprintIgnoredDirectoryNames.has(entry.name)) {
        continue;
      }
      if (entry.isFile() && fingerprintIgnoredFilePattern.test(entry.name)) {
        continue;
      }
      updateFingerprintFromPath(hash, join(targetPath, entry.name));
    }
    return;
  }
  if (targetStat.isFile()) {
    hash.update(`file:${relativePath}\0`);
    hash.update(readFileSync(targetPath));
    hash.update("\0");
  }
}

function resolveSourceFingerprint() {
  const hash = createHash("sha256");
  hash.update(`fixture-schema:${fixtureCacheSchemaVersion}\0${process.platform}\0${process.arch}\0`);
  for (const inputPath of fingerprintInputPaths) {
    updateFingerprintFromPath(hash, join(workspaceRoot, inputPath));
  }
  return hash.digest("hex");
}

function updatePackageMetadataFingerprint(hash, targetPath) {
  if (!existsSync(targetPath)) {
    return;
  }
  const targetStat = lstatSync(targetPath);
  if (!targetStat.isDirectory()) {
    if (targetPath.replaceAll("\\", "/").endsWith("/package.json")) {
      updateFingerprintFromPath(hash, targetPath);
    }
    return;
  }
  for (const entry of readdirSync(targetPath, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isDirectory() && fingerprintIgnoredDirectoryNames.has(entry.name)) {
      continue;
    }
    updatePackageMetadataFingerprint(hash, join(targetPath, entry.name));
  }
}

function resolveRuntimeDeployFingerprint() {
  const hash = createHash("sha256");
  const nodeMajorVersion = process.versions.node.split(".")[0];
  hash.update(`runtime-deploy-schema:${runtimeDeployCacheSchemaVersion}\0${process.platform}\0${process.arch}\0node-${nodeMajorVersion}\0`);
  for (const inputPath of ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml"]) {
    updateFingerprintFromPath(hash, join(workspaceRoot, inputPath));
  }
  updatePackageMetadataFingerprint(hash, join(workspaceRoot, "packages"));
  return hash.digest("hex");
}

function getLatestInputMtime(targetPath) {
  if (!existsSync(targetPath)) {
    return 0;
  }
  const targetStat = lstatSync(targetPath);
  if (!targetStat.isDirectory()) {
    return targetStat.mtimeMs;
  }
  let latestMtime = 0;
  for (const entry of readdirSync(targetPath, { withFileTypes: true })) {
    if (entry.isDirectory() && fingerprintIgnoredDirectoryNames.has(entry.name)) {
      continue;
    }
    if (entry.isFile() && fingerprintIgnoredFilePattern.test(entry.name)) {
      continue;
    }
    latestMtime = Math.max(latestMtime, getLatestInputMtime(join(targetPath, entry.name)));
  }
  return latestMtime;
}

export class UpdateVerificationFixtureManager {
  constructor({ candidateVersion, channel, rebuild, runRoot }) {
    this.candidateVersion = candidateVersion;
    this.channel = channel;
    this.rebuild = rebuild;
    this.runRoot = runRoot;
  }

  prepare = () => {
    runUpdateVerificationCommand(process.execPath, [syncUsageResourcePath], { cwd: workspaceRoot });
    this.sourceFingerprint = resolveSourceFingerprint();
    if (this.rebuild) {
      const fixtureRoot = join(this.runRoot, "fixture");
      console.log("[dev:verify-update] Cache bypassed by --rebuild.");
      this.buildFixture(fixtureRoot, fixtureRoot);
      return this.resolveFixture(fixtureRoot, false);
    }

    mkdirSync(fixtureCacheRoot, { recursive: true });
    const fixtureRoot = join(fixtureCacheRoot, this.sourceFingerprint);
    const cacheStatus = this.inspectFixture(fixtureRoot);
    if (cacheStatus.valid) {
      console.log(`[dev:verify-update] Reusing prepared fixture ${this.sourceFingerprint.slice(0, 12)}.`);
      return this.resolveFixture(fixtureRoot, true);
    }

    console.log(`[dev:verify-update] Preparing fixture cache (${cacheStatus.reason}).`);
    const stagingRoot = mkdtempSync(join(fixtureCacheRoot, ".building-"));
    try {
      this.buildFixture(stagingRoot, fixtureRoot);
      if (resolveSourceFingerprint() !== this.sourceFingerprint) {
        throw new Error("Build inputs changed while preparing the update fixture. Run the command again.");
      }
      rmSync(fixtureRoot, { recursive: true, force: true });
      renameSync(stagingRoot, fixtureRoot);
    } catch (error) {
      rmSync(stagingRoot, { recursive: true, force: true });
      throw error;
    }
    return this.resolveFixture(fixtureRoot, false);
  };

  inspectFixture = (fixtureRoot) => {
    const metadataPath = join(fixtureRoot, "fixture.json");
    if (!existsSync(metadataPath)) {
      return { valid: false, reason: "cache miss" };
    }
    try {
      const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
      if (
        metadata.schemaVersion !== fixtureCacheSchemaVersion ||
        metadata.sourceFingerprint !== this.sourceFingerprint ||
        metadata.candidateVersion !== this.candidateVersion ||
        metadata.channel !== this.channel ||
        metadata.platform !== process.platform ||
        metadata.arch !== process.arch
      ) {
        return { valid: false, reason: "cache metadata mismatch" };
      }
      this.resolveFixtureBundlePath(fixtureRoot);
      if (!existsSync(join(fixtureRoot, "update-public-key.pem"))) {
        return { valid: false, reason: "cached public key is missing" };
      }
      return { valid: true, reason: "cache hit" };
    } catch (error) {
      return { valid: false, reason: error instanceof Error ? error.message : "cache is unreadable" };
    }
  };

  buildFixture = (outputRoot, finalFixtureRoot) => {
    mkdirSync(outputRoot, { recursive: true });
    if (this.rebuild) {
      runUpdateVerificationStage(`Rebuilding all source artifacts for ${this.candidateVersion}`, () => {
        runUpdateVerificationCommand("pnpm", ["--filter", "nextclaw...", "build"], { cwd: workspaceRoot });
      });
    } else {
      runUpdateVerificationStage(`Refreshing changed source artifacts for ${this.candidateVersion}`, () => {
        this.ensureFreshUiArtifacts();
        runUpdateVerificationCommand("pnpm", ["dev:packages:build"], { cwd: workspaceRoot });
        runUpdateVerificationCommand(process.execPath, [copyUiDistPath], { cwd: workspaceRoot });
      });
    }

    const { privateKey } = generateKeyPairSync("ed25519");
    const privateKeyPath = join(outputRoot, "update-private-key.pem");
    const publicKeyPath = join(outputRoot, "update-public-key.pem");
    const updateRoot = join(outputRoot, "updates");
    const finalChannelDir = join(finalFixtureRoot, "updates", this.channel);
    writeFileSync(privateKeyPath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });

    runUpdateVerificationStage("Building signed local update channel", () => {
      const builderArgs = [
        updateBuilderPath,
        "--channel",
        this.channel,
        "--private-key-file",
        privateKeyPath,
        "--public-key-output",
        publicKeyPath,
        "--output-dir",
        updateRoot,
        "--bundle-base-url",
        pathToFileURL(finalChannelDir).toString(),
        "--offline",
        "true",
        "--compression-level",
        "1",
        "--skip-build",
        "true"
      ];
      if (!this.rebuild) {
        builderArgs.push(
          "--runtime-cache-dir",
          join(runtimeDeployCacheRoot, resolveRuntimeDeployFingerprint())
        );
      }
      runUpdateVerificationCommand(process.execPath, builderArgs, { cwd: workspaceRoot });
    });
    rmSync(privateKeyPath, { force: true });
    writeFileSync(join(outputRoot, "fixture.json"), `${JSON.stringify({
      schemaVersion: fixtureCacheSchemaVersion,
      sourceFingerprint: this.sourceFingerprint,
      candidateVersion: this.candidateVersion,
      channel: this.channel,
      platform: process.platform,
      arch: process.arch,
      createdAt: new Date().toISOString()
    }, null, 2)}\n`, "utf8");
  };

  ensureFreshUiArtifacts = () => {
    const uiIndexPath = join(nextclawUiOutputRoot, "index.html");
    const outputMtime = existsSync(uiIndexPath) ? lstatSync(uiIndexPath).mtimeMs : 0;
    if (getLatestInputMtime(nextclawUiPackageRoot) <= outputMtime) {
      console.log("[dev:verify-update] Reusing fresh @nextclaw/ui build.");
      return;
    }
    runUpdateVerificationCommand("pnpm", ["-C", nextclawUiPackageRoot, "build"], { cwd: workspaceRoot });
  };

  resolveFixture = (fixtureRoot, cacheHit) => {
    const fixtureBundle = this.resolveFixtureBundlePath(fixtureRoot);
    return {
      bundlePath: fixtureBundle.bundlePath,
      cacheHit,
      manifestPath: fixtureBundle.manifestPath,
      publicKeyPath: join(fixtureRoot, "update-public-key.pem")
    };
  };

  resolveFixtureBundlePath = (fixtureRoot) => {
    const manifestPath = join(
      fixtureRoot,
      "updates",
      this.channel,
      `manifest-${this.channel}-${process.platform}-${process.arch}.json`
    );
    if (!existsSync(manifestPath)) {
      throw new Error("cached update manifest is missing");
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    if (manifest.latestVersion !== this.candidateVersion) {
      throw new Error("cached update manifest has the wrong candidate version");
    }
    const bundleUrl = new URL(String(manifest.bundleUrl ?? ""));
    if (bundleUrl.protocol !== "file:") {
      throw new Error("cached update manifest does not use a local file URL");
    }
    const bundlePath = fileURLToPath(bundleUrl);
    const bundleRelativePath = relative(fixtureRoot, bundlePath);
    if (bundleRelativePath.startsWith("..") || resolve(fixtureRoot, bundleRelativePath) !== resolve(bundlePath)) {
      throw new Error("cached update bundle points outside its fixture");
    }
    if (!existsSync(bundlePath)) {
      throw new Error("cached update bundle is missing");
    }
    return { manifestPath, bundlePath };
  };
}
