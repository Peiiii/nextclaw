import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { cp, lstat, mkdir, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

const runtimeCacheSchemaVersion = 2;
const coreRuntimeSkillsPath = "@nextclaw/core/dist/skills";
const workspaceScanIgnoredDirectories = new Set(["coverage", "dist", "node_modules", "release", "tmp", "ui-dist"]);
const pruneSuffixes = [".d.ts", ".d.mts", ".d.cts", ".map", ".md", ".markdown", ".mdx", ".mkd", ".tsbuildinfo"];
const pruneBasenames = new Set([
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
const pruneDirectoryNames = new Set([
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
const prunePackageNames = new Set(["electron"]);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function shouldPruneRuntimeNodeModulesEntry(relativePath, entry) {
  const normalizedRelativePath = relativePath.replaceAll("\\", "/").toLowerCase();
  const pathSegments = normalizedRelativePath.split("/").filter(Boolean);
  const entryName = entry.name.toLowerCase();
  if (normalizedRelativePath === coreRuntimeSkillsPath || normalizedRelativePath.startsWith(`${coreRuntimeSkillsPath}/`)) {
    return false;
  }
  if (entry.isDirectory()) {
    if (pathSegments.length === 1 && prunePackageNames.has(entryName)) {
      return true;
    }
    if (!pruneDirectoryNames.has(entryName)) {
      return false;
    }
    if (pathSegments[0]?.startsWith("@")) {
      return pathSegments.length === 3;
    }
    return pathSegments.length === 2;
  }
  if (pruneBasenames.has(entryName)) {
    return true;
  }
  if (pathSegments[0] === ".bin" && entryName.startsWith("electron")) {
    return true;
  }
  return pruneSuffixes.some((suffix) => entryName.endsWith(suffix));
}

async function discoverWorkspacePackages(directory) {
  const packages = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || workspaceScanIgnoredDirectories.has(entry.name)) {
      continue;
    }
    const packageDir = join(directory, entry.name);
    const packageJsonPath = join(packageDir, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = readJson(packageJsonPath);
      if (typeof packageJson.name === "string" && packageJson.name.trim()) {
        packages.set(packageJson.name, { packageDir, packageJson });
      }
      continue;
    }
    const nestedPackages = await discoverWorkspacePackages(packageDir);
    for (const [packageName, workspacePackage] of nestedPackages) {
      packages.set(packageName, workspacePackage);
    }
  }
  return packages;
}

function resolveRuntimePackagePath(runtimeRoot, packageName) {
  if (packageName === "nextclaw") {
    return runtimeRoot;
  }
  return join(runtimeRoot, "node_modules", ...packageName.split("/"));
}

function assertSafePackageFile(packageDir, fileEntry) {
  const sourcePath = resolve(packageDir, fileEntry);
  const relativePath = relative(packageDir, sourcePath);
  if (!fileEntry || relativePath.startsWith("..") || resolve(packageDir, relativePath) !== sourcePath) {
    throw new Error(`Unsafe package files entry ${JSON.stringify(fileEntry)} in ${packageDir}.`);
  }
  if (!existsSync(sourcePath)) {
    throw new Error(`Package artifact ${fileEntry} is missing in ${packageDir}. Build the workspace artifacts before packaging.`);
  }
  return { sourcePath, relativePath };
}

async function refreshWorkspacePackage(workspacePackage, targetPackageRoot) {
  const fileEntries = workspacePackage.packageJson.files;
  if (!Array.isArray(fileEntries) || fileEntries.some((entry) => typeof entry !== "string")) {
    throw new Error(`Workspace runtime package ${workspacePackage.packageJson.name} must declare a literal files array.`);
  }
  await cp(join(workspacePackage.packageDir, "package.json"), join(targetPackageRoot, "package.json"), { force: true });
  for (const fileEntry of fileEntries) {
    const { sourcePath, relativePath } = assertSafePackageFile(workspacePackage.packageDir, fileEntry);
    const targetPath = join(targetPackageRoot, relativePath);
    await rm(targetPath, { recursive: true, force: true });
    await cp(sourcePath, targetPath, { recursive: true, force: true });
  }
}

async function updatePackageArtifactFingerprint(hash, targetPath, logicalPath, deployedPackagePath) {
  const sourceStat = await lstat(targetPath);
  const deployedRelativePath = deployedPackagePath ? join(deployedPackagePath, logicalPath) : logicalPath;
  const entry = {
    name: basename(targetPath),
    isDirectory: () => sourceStat.isDirectory()
  };
  if (deployedPackagePath && shouldPruneRuntimeNodeModulesEntry(deployedRelativePath, entry)) {
    return;
  }
  if (sourceStat.isDirectory()) {
    for (const child of (await readdir(targetPath, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      await updatePackageArtifactFingerprint(
        hash,
        join(targetPath, child.name),
        join(logicalPath, child.name),
        deployedPackagePath
      );
    }
    return;
  }
  const filePath = sourceStat.isSymbolicLink() ? await realpath(targetPath) : targetPath;
  hash.update(`file:${logicalPath}\0`);
  hash.update(readFileSync(filePath));
  hash.update("\0");
}

async function resolvePackageArtifactFingerprint(packageRoot, fileEntries, deployedPackagePath) {
  const hash = createHash("sha256");
  for (const fileEntry of [...fileEntries].sort()) {
    const unresolvedPath = resolve(packageRoot, fileEntry);
    if (!existsSync(unresolvedPath) && deployedPackagePath && shouldPruneRuntimeNodeModulesEntry(join(deployedPackagePath, fileEntry), {
      name: basename(fileEntry),
      isDirectory: () => false
    })) {
      continue;
    }
    const { sourcePath, relativePath } = assertSafePackageFile(packageRoot, fileEntry);
    await updatePackageArtifactFingerprint(hash, sourcePath, relativePath, deployedPackagePath);
  }
  return hash.digest("hex");
}

export class NpmRuntimeDeploymentCacheManager {
  constructor({ arch, cacheDir, platform, runtimeRoot, workspacePackagesRoot }) {
    this.arch = arch;
    this.cacheDir = cacheDir;
    this.platform = platform;
    this.runtimeRoot = runtimeRoot;
    this.workspacePackagesRoot = workspacePackagesRoot;
  }

  restore = async () => {
    if (!this.cacheDir) {
      return null;
    }
    const cachedRuntimeRoot = join(this.cacheDir, "runtime");
    const cacheMetadataPath = join(this.cacheDir, "runtime-cache.json");
    if (!existsSync(join(cachedRuntimeRoot, "package.json")) || !existsSync(cacheMetadataPath)) {
      return null;
    }
    const cacheMetadata = readJson(cacheMetadataPath);
    if (
      cacheMetadata.schemaVersion !== runtimeCacheSchemaVersion ||
      cacheMetadata.platform !== this.platform ||
      cacheMetadata.arch !== this.arch ||
      cacheMetadata.nodeMajorVersion !== process.versions.node.split(".")[0]
    ) {
      return null;
    }

    console.log(`[build-npm-runtime-update-channel] Reusing runtime deployment cache ${this.cacheDir}.`);
    await cp(cachedRuntimeRoot, this.runtimeRoot, { recursive: true, force: true });
    const refreshResult = await this.refreshWorkspacePackages();
    const pruneResult = await this.pruneRuntimeNodeModules(refreshResult.refreshedPackageRoots);
    await this.assertCoreRuntimeSkillAssets();
    return { ...pruneResult, refreshedPackages: refreshResult.refreshedPackages };
  };

  store = async () => {
    if (!this.cacheDir) {
      return;
    }
    const stagingCacheDir = `${this.cacheDir}.building-${process.pid}`;
    await rm(stagingCacheDir, { recursive: true, force: true });
    await mkdir(stagingCacheDir, { recursive: true });
    await cp(this.runtimeRoot, join(stagingCacheDir, "runtime"), { recursive: true, force: true });
    await writeFile(join(stagingCacheDir, "runtime-cache.json"), `${JSON.stringify({
      schemaVersion: runtimeCacheSchemaVersion,
      platform: this.platform,
      arch: this.arch,
      nodeMajorVersion: process.versions.node.split(".")[0],
      createdAt: new Date().toISOString()
    }, null, 2)}\n`, "utf8");
    await rm(this.cacheDir, { recursive: true, force: true });
    await mkdir(dirname(this.cacheDir), { recursive: true });
    await rename(stagingCacheDir, this.cacheDir);
  };

  pruneRuntimeNodeModules = async (packageRoots = null) => {
    const nodeModulesRoot = join(this.runtimeRoot, "node_modules");
    try {
      const nodeModulesStat = await stat(nodeModulesRoot);
      if (!nodeModulesStat.isDirectory()) {
        return { removedEntries: 0 };
      }
    } catch {
      return { removedEntries: 0 };
    }

    let removedEntries = 0;
    const walk = async (currentDir) => {
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
    };
    for (const packageRoot of packageRoots ?? [nodeModulesRoot]) {
      await walk(packageRoot);
    }
    return { removedEntries };
  };

  assertCoreRuntimeSkillAssets = async () => {
    const fileEntries = ["dist/skills"];
    const [sourceFingerprint, deployedFingerprint] = await Promise.all([
      resolvePackageArtifactFingerprint(join(this.workspacePackagesRoot, "nextclaw-core"), fileEntries),
      resolvePackageArtifactFingerprint(resolveRuntimePackagePath(this.runtimeRoot, "@nextclaw/core"), fileEntries)
    ]);
    if (sourceFingerprint !== deployedFingerprint) {
      throw new Error("Runtime deployment changed @nextclaw/core/dist/skills assets.");
    }
  };

  refreshWorkspacePackages = async () => {
    const workspacePackages = await discoverWorkspacePackages(this.workspacePackagesRoot);
    let refreshedPackages = 0;
    const refreshedPackageRoots = [];
    const nodeModulesRoot = join(this.runtimeRoot, "node_modules");
    for (const [packageName, workspacePackage] of workspacePackages) {
      const targetPackageRoot = resolveRuntimePackagePath(this.runtimeRoot, packageName);
      if (!existsSync(join(targetPackageRoot, "package.json"))) {
        continue;
      }
      const fileEntries = workspacePackage.packageJson.files;
      if (!Array.isArray(fileEntries) || fileEntries.some((entry) => typeof entry !== "string")) {
        throw new Error(`Workspace runtime package ${workspacePackage.packageJson.name} must declare a literal files array.`);
      }
      const deployedPackagePath = packageName === "nextclaw" ? null : relative(nodeModulesRoot, targetPackageRoot);
      const [sourceFingerprint, deployedFingerprint] = await Promise.all([
        resolvePackageArtifactFingerprint(workspacePackage.packageDir, fileEntries, deployedPackagePath),
        resolvePackageArtifactFingerprint(targetPackageRoot, fileEntries, deployedPackagePath)
      ]);
      if (sourceFingerprint === deployedFingerprint) {
        continue;
      }
      await refreshWorkspacePackage(workspacePackage, targetPackageRoot);
      refreshedPackages += 1;
      if (deployedPackagePath) {
        refreshedPackageRoots.push(targetPackageRoot);
      }
    }
    return { refreshedPackages, refreshedPackageRoots };
  };
}
