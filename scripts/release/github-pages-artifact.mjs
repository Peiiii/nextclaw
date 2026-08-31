import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const APT_PACKAGE_SOURCE_SCHEMA = "nextclaw.github-pages-apt-source/v1";
export const DEFAULT_MAX_STATE_FILE_BYTES = 20 * 1024 * 1024;
export const APT_PACKAGES_RELATIVE_PATH =
  "apt/dists/stable/main/binary-amd64/Packages";
export const APT_PACKAGE_SOURCE_RELATIVE_PATH = "apt/package-source.json";
export const GITHUB_PAGES_ENTRY_FILES = ["index.html", "index.md", "README.md"];

function assertSafeRelativePath(value, label) {
  if (!value || isAbsolute(value)) {
    throw new Error(`${label} must be a non-empty relative path: ${value ?? "<missing>"}`);
  }
  const normalized = value.replaceAll("\\", "/");
  if (normalized.split("/").some((segment) => segment === ".." || segment === "")) {
    throw new Error(`${label} must not escape its owner directory: ${value}`);
  }
  return normalized;
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function walkFiles(rootDirectory) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const entryPath = join(directory, entry.name);
      const entryStat = await lstat(entryPath);
      if (entryStat.isSymbolicLink()) {
        throw new Error(`GitHub Pages state must not contain symlinks: ${relative(rootDirectory, entryPath)}`);
      }
      if (entryStat.isDirectory()) {
        await visit(entryPath);
        continue;
      }
      if (!entryStat.isFile()) {
        throw new Error(`GitHub Pages state contains an unsupported entry: ${relative(rootDirectory, entryPath)}`);
      }
      if (entryStat.nlink > 1) {
        throw new Error(`GitHub Pages state must not contain hard links: ${relative(rootDirectory, entryPath)}`);
      }
      files.push({ absolutePath: entryPath, relativePath: relative(rootDirectory, entryPath), size: entryStat.size });
    }
  }
  await visit(rootDirectory);
  return files;
}

async function assertGitHubPagesEntryFile(stateDirectory) {
  for (const entryFile of GITHUB_PAGES_ENTRY_FILES) {
    if (await pathExists(join(stateDirectory, entryFile))) return entryFile;
  }
  throw new Error(
    `GitHub Pages state must contain a top-level entry file: ${GITHUB_PAGES_ENTRY_FILES.join(", ")}`
  );
}

export async function assertCompactGitHubPagesState(
  stateDirectory,
  { maxFileBytes = DEFAULT_MAX_STATE_FILE_BYTES } = {}
) {
  const files = await walkFiles(resolve(stateDirectory));
  for (const file of files) {
    if (file.relativePath.endsWith(".deb")) {
      throw new Error(`GitHub Pages state must not contain Debian packages: ${file.relativePath}`);
    }
    if (file.size >= maxFileBytes) {
      throw new Error(
        `GitHub Pages state file exceeds ${maxFileBytes} bytes: ${file.relativePath} (${file.size})`
      );
    }
  }
  return { fileCount: files.length, maxFileBytes };
}

export function parseAptPackages(content) {
  const paragraphs = content
    .replaceAll("\r\n", "\n")
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    const fields = new Map();
    for (const line of paragraph.split("\n")) {
      const separator = line.indexOf(":");
      if (separator <= 0) continue;
      fields.set(line.slice(0, separator), line.slice(separator + 1).trim());
    }
    if (fields.get("Package") !== "nextclaw-desktop") continue;

    const packagePath = assertSafeRelativePath(fields.get("Filename"), "APT Filename");
    const packageSize = Number(fields.get("Size"));
    const packageSha256 = fields.get("SHA256")?.toLowerCase();
    if (!Number.isSafeInteger(packageSize) || packageSize <= 0) {
      throw new Error(`APT Size must be a positive integer: ${fields.get("Size") ?? "<missing>"}`);
    }
    if (!/^[a-f0-9]{64}$/u.test(packageSha256 ?? "")) {
      throw new Error(`APT SHA256 must be a lowercase 64-character digest: ${packageSha256 ?? "<missing>"}`);
    }
    return {
      assetName: basename(packagePath),
      packagePath,
      sha256: packageSha256,
      size: packageSize,
      version: fields.get("Version")
    };
  }
  throw new Error("APT Packages does not contain nextclaw-desktop metadata");
}

export async function readAptPackageSource(sourcePath) {
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  if (source.schema !== APT_PACKAGE_SOURCE_SCHEMA) {
    throw new Error(`Unsupported APT package source schema: ${source.schema ?? "<missing>"}`);
  }
  if (!source.releaseTag || typeof source.releaseTag !== "string") {
    throw new Error("APT package source releaseTag is required");
  }
  if (!source.assetName || basename(source.assetName) !== source.assetName) {
    throw new Error(`APT package source assetName must be a file name: ${source.assetName ?? "<missing>"}`);
  }
  source.packagePath = assertSafeRelativePath(source.packagePath, "APT package source packagePath");
  if (!Number.isSafeInteger(source.size) || source.size <= 0) {
    throw new Error(`APT package source size must be a positive integer: ${source.size ?? "<missing>"}`);
  }
  if (!/^[a-f0-9]{64}$/u.test(source.sha256 ?? "")) {
    throw new Error(`APT package source sha256 is invalid: ${source.sha256 ?? "<missing>"}`);
  }
  return source;
}

async function sha256File(filePath) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

async function readAptMetadata(stateDirectory) {
  return parseAptPackages(
    await readFile(join(stateDirectory, APT_PACKAGES_RELATIVE_PATH), "utf8")
  );
}

async function assertPackageMatches(packagePath, expected) {
  const packageStat = await stat(packagePath);
  if (packageStat.size !== expected.size) {
    throw new Error(`APT package size mismatch: expected ${expected.size}, got ${packageStat.size}`);
  }
  const packageSha256 = await sha256File(packagePath);
  if (packageSha256 !== expected.sha256) {
    throw new Error(`APT package SHA256 mismatch: expected ${expected.sha256}, got ${packageSha256}`);
  }
}

function assertSourceMatchesMetadata(source, metadata) {
  for (const field of ["packagePath", "size", "sha256"]) {
    if (source[field] !== metadata[field]) {
      throw new Error(
        `APT package source ${field} mismatch: Packages=${metadata[field]} source=${source[field]}`
      );
    }
  }
}

export async function createAptPackageSource({
  aptPackagePath,
  outputPath,
  packagesPath,
  releaseAssetName,
  releaseTag
}) {
  if (!releaseTag) throw new Error("releaseTag is required");
  if (!releaseAssetName || basename(releaseAssetName) !== releaseAssetName) {
    throw new Error(`releaseAssetName must be a file name: ${releaseAssetName ?? "<missing>"}`);
  }
  const metadata = parseAptPackages(await readFile(packagesPath, "utf8"));
  if (basename(aptPackagePath) !== metadata.assetName) {
    throw new Error(
      `APT package name mismatch: Packages=${metadata.assetName} file=${basename(aptPackagePath)}`
    );
  }
  await assertPackageMatches(aptPackagePath, metadata);
  const source = {
    schema: APT_PACKAGE_SOURCE_SCHEMA,
    releaseTag,
    assetName: releaseAssetName,
    packagePath: metadata.packagePath,
    size: metadata.size,
    sha256: metadata.sha256
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(source, null, 2)}\n`);
  return source;
}

export async function materializeGitHubPagesArtifact({
  aptPackagePath,
  outputDirectory,
  stateDirectory
}) {
  const stateRoot = resolve(stateDirectory);
  const outputRoot = resolve(outputDirectory);
  const outputWithinState = relative(stateRoot, outputRoot);
  if (outputWithinState === "" || (!outputWithinState.startsWith(`..${sep}`) && outputWithinState !== "..")) {
    throw new Error("Pages artifact output directory must not be inside the state directory");
  }

  await walkFiles(stateRoot);
  await assertGitHubPagesEntryFile(stateRoot);
  const metadata = await readAptMetadata(stateRoot);
  const source = await readAptPackageSource(join(stateRoot, APT_PACKAGE_SOURCE_RELATIVE_PATH));
  assertSourceMatchesMetadata(source, metadata);

  const statePackagePath = join(stateRoot, "apt", metadata.packagePath);
  const resolvedPackagePath = aptPackagePath
    ? resolve(aptPackagePath)
    : (await pathExists(statePackagePath))
      ? statePackagePath
      : undefined;
  if (!resolvedPackagePath) {
    throw new Error(`APT package must be supplied for ${source.releaseTag}/${source.assetName}`);
  }
  if (basename(resolvedPackagePath) !== source.assetName) {
    throw new Error(
      `APT package file name mismatch: expected ${source.assetName}, got ${basename(resolvedPackagePath)}`
    );
  }
  await assertPackageMatches(resolvedPackagePath, source);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await cp(stateRoot, outputRoot, {
    recursive: true,
    filter: (sourcePath) => basename(sourcePath) !== ".git"
  });
  const outputPackagePath = join(outputRoot, "apt", metadata.packagePath);
  await mkdir(dirname(outputPackagePath), { recursive: true });
  await copyFile(resolvedPackagePath, outputPackagePath);
  await assertPackageMatches(outputPackagePath, source);

  return {
    assetName: source.assetName,
    outputPackagePath,
    releaseTag: source.releaseTag,
    sha256: source.sha256,
    size: source.size
  };
}

function parseArguments(argv) {
  const [command, ...tokens] = argv;
  const options = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument sequence near ${key ?? "<end>"}`);
    }
    options[key.slice(2)] = value;
  }
  return { command, options };
}

function requireOption(options, name) {
  const value = options[name];
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

export async function runCli(argv = process.argv.slice(2)) {
  const { command, options } = parseArguments(argv);
  if (command === "verify-state") {
    const result = await assertCompactGitHubPagesState(requireOption(options, "state-dir"));
    console.log(`[github-pages] compact state OK (${result.fileCount} files)`);
    return;
  }
  if (command === "create-apt-source") {
    const source = await createAptPackageSource({
      aptPackagePath: requireOption(options, "apt-package"),
      outputPath: requireOption(options, "output"),
      packagesPath: requireOption(options, "packages"),
      releaseAssetName: requireOption(options, "release-asset-name"),
      releaseTag: requireOption(options, "release-tag")
    });
    console.log(`[github-pages] recorded ${source.releaseTag}/${source.assetName}`);
    return;
  }
  if (command === "materialize") {
    const result = await materializeGitHubPagesArtifact({
      aptPackagePath: options["apt-package"],
      outputDirectory: requireOption(options, "output-dir"),
      stateDirectory: requireOption(options, "state-dir")
    });
    console.log(
      `[github-pages] materialized ${result.releaseTag}/${result.assetName} (${result.size} bytes)`
    );
    return;
  }
  throw new Error(`Unknown command: ${command ?? "<missing>"}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
