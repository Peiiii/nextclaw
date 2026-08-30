#!/usr/bin/env node
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { gzipSync } from "node:zlib";

const DEFAULT_OUTPUT_DIR = "dist/linux-apt-repo";
const APT_PACKAGE_NAME = "nextclaw-desktop";
const APT_ARCH = "amd64";
const APT_DIST = "stable";
const APT_COMPONENT = "main";
const GITHUB_PAGES_FILE_LIMIT = 100 * 1024 * 1024;

function parseArgs(argv) {
  const options = {
    inputDirs: [],
    outputDir: DEFAULT_OUTPUT_DIR,
    signingMode: "env",
    githubPagesCompatible: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === "--input-dir") {
      if (!value) {
        throw new Error("--input-dir requires a value");
      }
      options.inputDirs.push(value);
      index += 1;
      continue;
    }
    if (arg === "--output-dir") {
      if (!value) {
        throw new Error("--output-dir requires a value");
      }
      options.outputDir = value;
      index += 1;
      continue;
    }
    if (arg === "--signing-mode") {
      if (!value || (value !== "env" && value !== "test")) {
        throw new Error("--signing-mode must be env or test");
      }
      options.signingMode = value;
      index += 1;
      continue;
    }
    if (arg === "--github-pages-compatible") {
      options.githubPagesCompatible = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.inputDirs.length === 0) {
    throw new Error("At least one --input-dir is required");
  }

  return {
    inputDirs: options.inputDirs.map((dir) => resolve(dir)),
    outputDir: resolve(options.outputDir),
    signingMode: options.signingMode,
    githubPagesCompatible: options.githubPagesCompatible
  };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: options.env ? { ...process.env, ...options.env } : process.env
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr.toString("utf8")}`);
  }
  return result.stdout.toString("utf8");
}

function ensureCommand(command, versionArgs = ["--version"]) {
  const result = spawnSync(command, versionArgs, { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    throw new Error(`Required command not found or not runnable: ${command}`);
  }
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function collectDebFiles(inputDirs) {
  const files = [];
  for (const inputDir of inputDirs) {
    if (!existsSync(inputDir)) {
      throw new Error(`Input directory does not exist: ${inputDir}`);
    }
    for (const filePath of walk(inputDir)) {
      if (filePath.endsWith(".deb")) {
        files.push(filePath);
      }
    }
  }
  if (files.length === 0) {
    throw new Error(`No .deb files found under: ${inputDirs.join(", ")}`);
  }
  return files;
}

function readDebField(debPath, field) {
  return run("dpkg-deb", ["-f", debPath, field]).trim();
}

function createRepoLayout(outputDir) {
  rmSync(outputDir, { recursive: true, force: true });
  const repoRoot = resolve(outputDir, "apt");
  const poolDir = resolve(repoRoot, "pool", APT_COMPONENT, "n", APT_PACKAGE_NAME);
  const binaryDir = resolve(repoRoot, "dists", APT_DIST, APT_COMPONENT, `binary-${APT_ARCH}`);
  mkdirSync(poolDir, { recursive: true });
  mkdirSync(binaryDir, { recursive: true });
  return { repoRoot, poolDir, binaryDir };
}

function removeAptMirrorOnlyFiles(packageRoot) {
  const appRoot = resolve(packageRoot, "opt", "NextClaw Desktop");
  if (!existsSync(appRoot)) {
    throw new Error(`Desktop application root is missing from Debian package: ${appRoot}`);
  }

  for (const relativePath of [
    "LICENSES.chromium.html",
    "LICENSE.electron.txt",
    "chrome_crashpad_handler",
    "libvk_swiftshader.so",
    "vk_swiftshader_icd.json",
    "chrome_200_percent.pak",
    "locales/zh-TW.pak",
    // The normal desktop installers keep this local first-boot cache. The APT
    // mirror is size-bound by GitHub Pages, and the bootstrap service already
    // fetches the signed stable bundle when no seed archive is packaged.
    "resources/update/seed-product-bundle.zip"
  ]) {
    rmSync(resolve(appRoot, relativePath), { force: true, recursive: true });
  }

  const updateMetadataPath = resolve(appRoot, "resources", "update", "update-release-metadata.json");
  if (existsSync(updateMetadataPath)) {
    const metadata = JSON.parse(readFileSync(updateMetadataPath, "utf8"));
    writeFileSync(updateMetadataPath, `${JSON.stringify({ ...metadata, seedBundle: null }, null, 2)}\n`);
  }

  const unpackedModules = resolve(appRoot, "resources", "app.asar.unpacked", "node_modules");
  if (!existsSync(unpackedModules)) {
    return;
  }
  for (const filePath of walk(unpackedModules)) {
    const relativePath = relative(unpackedModules, filePath).replaceAll("\\", "/");
    const basename = filePath.split(/[/\\]/).at(-1) ?? "";
    if (
      basename.endsWith(".md") ||
      basename.endsWith(".markdown") ||
      basename.endsWith(".svg") ||
      basename === ".jekyll-metadata" ||
      relativePath.includes("/fsevents/") ||
      basename === "fsevents.node" ||
      basename === "jszip.min.js" ||
      relativePath.endsWith("/jszip/dist/jszip.js") ||
      relativePath.endsWith("/jszip/vendor/FileSaver.js")
    ) {
      rmSync(filePath, { force: true });
    }
  }

  const betterSqlite3Root = resolve(unpackedModules, "better-sqlite3");
  if (existsSync(betterSqlite3Root)) {
    rmSync(resolve(betterSqlite3Root, "deps"), { force: true, recursive: true });
    rmSync(resolve(betterSqlite3Root, "src"), { force: true, recursive: true });
    rmSync(resolve(betterSqlite3Root, "binding.gyp"), { force: true });
    rmSync(resolve(betterSqlite3Root, "Makefile"), { force: true });
    if (!existsSync(resolve(betterSqlite3Root, "build", "Release", "better_sqlite3.node"))) {
      throw new Error("APT mirror pruning removed the required better-sqlite3 native addon");
    }
  }
}

function repackForGitHubPages(debPath) {
  const originalSize = statSync(debPath).size;
  if (originalSize < GITHUB_PAGES_FILE_LIMIT) {
    console.log(`[linux-apt-repo] keeping ${debPath} at ${originalSize} bytes; below GitHub Pages limit`);
    return;
  }

  const packageRoot = mkdtempSync(join(tmpdir(), "nextclaw-apt-package-"));
  const repackedPath = `${debPath}.repacked`;
  try {
    run("dpkg-deb", ["--raw-extract", debPath, packageRoot]);
    removeAptMirrorOnlyFiles(packageRoot);
    run("dpkg-deb", ["--root-owner-group", "--build", "-Zxz", "-z9", "-Sextreme", packageRoot, repackedPath]);
    const repackedSize = statSync(repackedPath).size;
    console.log(`[linux-apt-repo] repacked ${debPath} from ${originalSize} to ${repackedSize} bytes`);
    if (repackedSize >= GITHUB_PAGES_FILE_LIMIT) {
      throw new Error(
        `Repacked Linux package still exceeds the GitHub Pages 100 MiB file limit: ${repackedSize} bytes`
      );
    }
    renameSync(repackedPath, debPath);
  } finally {
    rmSync(packageRoot, { recursive: true, force: true });
    rmSync(repackedPath, { force: true });
  }
}

function copyDebFiles(debPaths, poolDir, options = {}) {
  const copied = [];
  for (const debPath of debPaths) {
    const packageName = readDebField(debPath, "Package");
    if (packageName !== APT_PACKAGE_NAME) {
      throw new Error(`Unexpected package name in ${debPath}: ${packageName}`);
    }
    const version = readDebField(debPath, "Version");
    const targetName = `${APT_PACKAGE_NAME}_${version}_${APT_ARCH}.deb`;
    const targetPath = resolve(poolDir, targetName);
    copyFileSync(debPath, targetPath);
    if (options.githubPagesCompatible) {
      repackForGitHubPages(targetPath);
    }
    copied.push({
      packageName,
      version,
      targetPath
    });
  }
  copied.sort((left, right) => left.version.localeCompare(right.version));
  return copied;
}

function writePackagesFiles(repoRoot, binaryDir) {
  const packagesPath = resolve(binaryDir, "Packages");
  const packagesGzipPath = resolve(binaryDir, "Packages.gz");
  const packagesContent = run(
    "dpkg-scanpackages",
    ["--multiversion", "pool", "/dev/null"],
    { cwd: repoRoot }
  );
  writeFileSync(packagesPath, packagesContent);
  writeFileSync(packagesGzipPath, gzipSync(packagesContent));
}

function writeReleaseFile(repoRoot) {
  const releasePath = resolve(repoRoot, "dists", APT_DIST, "Release");
  const releaseContent = run(
    "apt-ftparchive",
    [
      "-o",
      "APT::FTPArchive::Release::Origin=NextClaw",
      "-o",
      "APT::FTPArchive::Release::Label=NextClaw",
      "-o",
      `APT::FTPArchive::Release::Suite=${APT_DIST}`,
      "-o",
      `APT::FTPArchive::Release::Codename=${APT_DIST}`,
      "-o",
      `APT::FTPArchive::Release::Architectures=${APT_ARCH}`,
      "-o",
      `APT::FTPArchive::Release::Components=${APT_COMPONENT}`,
      "-o",
      "APT::FTPArchive::Release::Description=NextClaw Linux APT Repository",
      "release",
      resolve(repoRoot, "dists", APT_DIST)
    ],
    { cwd: repoRoot }
  );
  writeFileSync(releasePath, releaseContent);
  return releasePath;
}

function createTestKey(gpgHome) {
  const batchPath = resolve(gpgHome, "test-key.batch");
  writeFileSync(
    batchPath,
    [
      "%no-protection",
      "Key-Type: RSA",
      "Key-Length: 2048",
      "Subkey-Type: RSA",
      "Subkey-Length: 2048",
      "Name-Real: NextClaw APT Test Repo",
      "Name-Email: apt-test@nextclaw.local",
      "Expire-Date: 0",
      "%commit",
      ""
    ].join("\n")
  );
  run("gpg", ["--homedir", gpgHome, "--batch", "--generate-key", batchPath]);
  return resolveKeyId(gpgHome);
}

function resolveKeyId(gpgHome) {
  const output = run("gpg", ["--homedir", gpgHome, "--batch", "--with-colons", "--list-secret-keys"]);
  const lines = output.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const parts = lines[index].split(":");
    if (parts[0] === "fpr" && parts[9]) {
      return parts[9];
    }
  }
  throw new Error("Unable to resolve GPG key fingerprint");
}

function importEnvKey(gpgHome) {
  const privateKey = process.env.NEXTCLAW_APT_GPG_PRIVATE_KEY;
  const passphrase = process.env.NEXTCLAW_APT_GPG_PASSPHRASE;
  if (!privateKey || !passphrase) {
    throw new Error("NEXTCLAW_APT_GPG_PRIVATE_KEY and NEXTCLAW_APT_GPG_PASSPHRASE are required for --signing-mode env");
  }
  const keyPath = resolve(gpgHome, "signing-key.asc");
  writeFileSync(keyPath, privateKey);
  run(
    "gpg",
    [
      "--homedir",
      gpgHome,
      "--batch",
      "--yes",
      "--pinentry-mode",
      "loopback",
      "--passphrase",
      passphrase,
      "--import",
      keyPath
    ]
  );
  return process.env.NEXTCLAW_APT_GPG_KEY_ID || resolveKeyId(gpgHome);
}

function signRelease(repoRoot, releasePath, signingMode) {
  const gpgHome = mkdtempSync(join(tmpdir(), "nextclaw-apt-gpg-"));
  mkdirSync(gpgHome, { recursive: true });
  let keyId = "";
  let passphrase = "";

  try {
    if (signingMode === "test") {
      keyId = createTestKey(gpgHome);
    } else {
      keyId = importEnvKey(gpgHome);
      passphrase = process.env.NEXTCLAW_APT_GPG_PASSPHRASE ?? "";
    }

    const sharedArgs = ["--homedir", gpgHome, "--batch", "--yes", "--local-user", keyId];
    const passphraseArgs = passphrase
      ? ["--pinentry-mode", "loopback", "--passphrase", passphrase]
      : [];

    run("gpg", [
      ...sharedArgs,
      ...passphraseArgs,
      "--clearsign",
      "--output",
      resolve(dirname(releasePath), "InRelease"),
      releasePath
    ]);

    run("gpg", [
      ...sharedArgs,
      ...passphraseArgs,
      "--detach-sign",
      "--output",
      resolve(dirname(releasePath), "Release.gpg"),
      releasePath
    ]);

    run("node", [
      resolve("scripts", "desktop", "export-linux-apt-public-key.mjs"),
      "--gpg-home",
      gpgHome,
      "--key-id",
      keyId,
      "--output",
      resolve(repoRoot, "nextclaw-archive-keyring.gpg")
    ]);

    return keyId;
  } finally {
    rmSync(gpgHome, { recursive: true, force: true });
  }
}

function printRepoTree(repoRoot) {
  const files = walk(repoRoot)
    .filter((filePath) => statSync(filePath).isFile())
    .map((filePath) => relative(repoRoot, filePath))
    .sort();
  console.log("[linux-apt-repo] files:");
  for (const relativePath of files) {
    console.log(`- ${relativePath}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  ensureCommand("dpkg-deb");
  ensureCommand("dpkg-scanpackages");
  ensureCommand("apt-ftparchive");
  ensureCommand("gpg");

  const debPaths = collectDebFiles(options.inputDirs);
  const { repoRoot, poolDir, binaryDir } = createRepoLayout(options.outputDir);
  const copied = copyDebFiles(debPaths, poolDir, options);
  writePackagesFiles(repoRoot, binaryDir);
  const releasePath = writeReleaseFile(repoRoot);
  const keyId = signRelease(repoRoot, releasePath, options.signingMode);

  writeFileSync(
    resolve(options.outputDir, "summary.json"),
    JSON.stringify(
      {
        packageName: APT_PACKAGE_NAME,
        arch: APT_ARCH,
        dist: APT_DIST,
        component: APT_COMPONENT,
        signingMode: options.signingMode,
        keyId,
        packages: copied.map((entry) => ({
          packageName: entry.packageName,
          version: entry.version,
          file: relative(repoRoot, entry.targetPath)
        }))
      },
      null,
      2
    )
  );

  console.log(`[linux-apt-repo] built ${repoRoot}`);
  for (const entry of copied) {
    console.log(`[linux-apt-repo] package ${entry.packageName}@${entry.version}`);
  }
  printRepoTree(repoRoot);
}

main();
