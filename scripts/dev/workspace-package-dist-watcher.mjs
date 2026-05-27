#!/usr/bin/env node
import { existsSync, readFileSync, statSync, watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, relative, resolve } from "node:path";
import { resolveRepoPath } from "../shared/repo-paths.mjs";

const rootDir = resolveRepoPath(import.meta.url);
const rootPackageJsonPath = resolve(rootDir, "package.json");
const rootPackageJson = readJson(rootPackageJsonPath);
const packageNames = new Set();
let mode = "watch";

for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (arg === "--") {
    continue;
  }
  if (arg === "--once") {
    mode = "once";
    continue;
  }
  if (arg === "--watch") {
    mode = "watch";
    continue;
  }
  if (arg === "--package") {
    const packageName = process.argv[index + 1];
    if (!packageName) {
      throw new Error("--package requires a package name");
    }
    packageNames.add(packageName);
    index += 1;
    continue;
  }
  throw new Error(`Unsupported option: ${arg}`);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

async function main() {
  const packages = orderPackages(
    (await discoverWorkspacePackages()).filter((workspacePackage) => {
      if (packageNames.size === 0) {
        return true;
      }
      return packageNames.has(workspacePackage.name);
    })
  );

  if (packages.length === 0) {
    console.log("[packages] No workspace package dist contracts found.");
    return;
  }

  const buildQueue = new PackageBuildQueue(packages);
  const stalePackages = [];
  for (const workspacePackage of packages) {
    if (await isPackageDistStale(workspacePackage)) {
      stalePackages.push(workspacePackage);
    }
  }

  if (stalePackages.length > 0) {
    console.log(`[packages] Building stale package dists: ${stalePackages.map((entry) => entry.name).join(", ")}`);
    for (const workspacePackage of stalePackages) {
      buildQueue.enqueue(workspacePackage.name);
    }
    const success = await buildQueue.drain();
    if (!success && mode === "once") {
      process.exit(1);
    }
  } else {
    console.log(`[packages] All ${packages.length} package dist contracts are fresh.`);
  }

  if (mode === "once") {
    process.exit(buildQueue.hasFailed ? 1 : 0);
  }

  console.log(`[packages] Watching ${packages.length} workspace package dist contracts.`);
  const watchers = packages.map((workspacePackage) => watchPackage(workspacePackage, buildQueue));

  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(signal, () => {
      for (const watcher of watchers) {
        watcher.close();
      }
      process.exit(buildQueue.hasFailed ? 1 : 0);
    });
  }
}

function getWorkspacePatterns() {
  if (Array.isArray(rootPackageJson.workspaces)) {
    return rootPackageJson.workspaces;
  }
  if (rootPackageJson.workspaces && Array.isArray(rootPackageJson.workspaces.packages)) {
    return rootPackageJson.workspaces.packages;
  }
  return [];
}

async function discoverWorkspacePackages() {
  const workspacePackages = [];
  for (const pattern of getWorkspacePatterns()) {
    if (!pattern.endsWith("/*")) {
      continue;
    }
    const parentDir = resolve(rootDir, pattern.slice(0, -2));
    if (!existsSync(parentDir)) {
      continue;
    }
    for (const entry of await readdir(parentDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const packageDir = join(parentDir, entry.name);
      const packageJsonPath = join(packageDir, "package.json");
      if (!existsSync(packageJsonPath)) {
        continue;
      }
      const workspacePackage = toWorkspacePackage(packageDir, packageJsonPath);
      if (workspacePackage) {
        workspacePackages.push(workspacePackage);
      }
    }
  }
  return workspacePackages;
}

function toWorkspacePackage(packageDir, packageJsonPath) {
  const packageJson = readJson(packageJsonPath);
  const typeTargets = getExportTypeTargets(packageJson)
    .filter((target) => target.startsWith("./dist/") && target.endsWith(".d.ts"))
    .map((target) => resolve(packageDir, target));

  if (
    typeof packageJson.name !== "string" ||
    typeTargets.length === 0 ||
    typeof packageJson.scripts?.build !== "string" ||
    !existsSync(resolve(packageDir, "src"))
  ) {
    return null;
  }

  return {
    name: packageJson.name,
    dir: packageDir,
    relativeDir: relative(rootDir, packageDir),
    packageJson,
    packageJsonPath,
    typeTargets
  };
}

function getExportTypeTargets(packageJson) {
  const targets = new Set();
  if (typeof packageJson.types === "string") {
    targets.add(packageJson.types);
  }
  for (const target of collectTypeTargets(packageJson.exports)) {
    targets.add(target);
  }
  return [...targets];
}

function collectTypeTargets(value) {
  if (!value || typeof value !== "object") {
    return [];
  }
  const targets = [];
  if (typeof value.types === "string") {
    targets.push(value.types);
  }
  for (const child of Object.values(value)) {
    targets.push(...collectTypeTargets(child));
  }
  return targets;
}

function orderPackages(workspacePackages) {
  const packageByName = new Map(workspacePackages.map((workspacePackage) => [workspacePackage.name, workspacePackage]));
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();

  const visit = (workspacePackage) => {
    if (visited.has(workspacePackage.name)) {
      return;
    }
    if (visiting.has(workspacePackage.name)) {
      ordered.push(workspacePackage);
      visited.add(workspacePackage.name);
      return;
    }
    visiting.add(workspacePackage.name);
    for (const dependencyName of getLocalDependencyNames(workspacePackage.packageJson, packageByName)) {
      visit(packageByName.get(dependencyName));
    }
    visiting.delete(workspacePackage.name);
    visited.add(workspacePackage.name);
    ordered.push(workspacePackage);
  };

  for (const workspacePackage of workspacePackages) {
    visit(workspacePackage);
  }
  return ordered;
}

function getLocalDependencyNames(packageJson, packageByName) {
  const dependencyBlocks = [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies
  ];
  const names = new Set();
  for (const dependencies of dependencyBlocks) {
    if (!dependencies || typeof dependencies !== "object") {
      continue;
    }
    for (const dependencyName of Object.keys(dependencies)) {
      if (packageByName.has(dependencyName)) {
        names.add(dependencyName);
      }
    }
  }
  return [...names];
}

async function isPackageDistStale(workspacePackage) {
  const outputMtime = getOldestExistingMtime(workspacePackage.typeTargets);
  if (outputMtime === null) {
    return true;
  }
  const inputMtime = await getLatestInputMtime(workspacePackage);
  return inputMtime > outputMtime;
}

function getOldestExistingMtime(filePaths) {
  let oldestMtime = null;
  for (const filePath of filePaths) {
    if (!existsSync(filePath)) {
      return null;
    }
    const mtime = statSync(filePath).mtimeMs;
    oldestMtime = oldestMtime === null ? mtime : Math.min(oldestMtime, mtime);
  }
  return oldestMtime;
}

async function getLatestInputMtime(workspacePackage) {
  let latestMtime = 0;
  const includeFile = async (filePath) => {
    if (!existsSync(filePath)) {
      return;
    }
    latestMtime = Math.max(latestMtime, (await stat(filePath)).mtimeMs);
  };

  await includeFile(workspacePackage.packageJsonPath);
  for (const configName of ["tsconfig.json", "tsconfig.build.json", "tsdown.config.ts", "tsdown.config.mts", "tsdown.config.mjs", "tsdown.config.js"]) {
    await includeFile(resolve(workspacePackage.dir, configName));
  }
  latestMtime = Math.max(latestMtime, await getLatestDirectoryMtime(resolve(workspacePackage.dir, "src")));
  return latestMtime;
}

async function getLatestDirectoryMtime(directoryPath) {
  let latestMtime = 0;
  for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
    const entryPath = join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      latestMtime = Math.max(latestMtime, await getLatestDirectoryMtime(entryPath));
      continue;
    }
    if (entry.isFile()) {
      latestMtime = Math.max(latestMtime, (await stat(entryPath)).mtimeMs);
    }
  }
  return latestMtime;
}

function watchPackage(workspacePackage, buildQueue) {
  let timer = null;
  const watcher = watch(workspacePackage.dir, { recursive: true }, (_eventType, filename) => {
    const normalizedFilename = String(filename ?? "").replaceAll("\\", "/");
    if (!isWatchedPackagePath(normalizedFilename)) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log(`[packages] ${workspacePackage.name} changed: ${normalizedFilename}`);
      buildQueue.enqueue(workspacePackage.name);
    }, 250);
  });

  watcher.on("error", (error) => {
    console.error(`[packages] Watch failed for ${workspacePackage.name}: ${error instanceof Error ? error.message : String(error)}`);
  });

  return watcher;
}

function isWatchedPackagePath(filename) {
  if (!filename) {
    return false;
  }
  if (filename.startsWith("dist/") || filename.startsWith("node_modules/")) {
    return false;
  }
  if (filename.startsWith("src/")) {
    return true;
  }
  return [
    "package.json",
    "tsconfig.json",
    "tsconfig.build.json",
    "tsdown.config.ts",
    "tsdown.config.mts",
    "tsdown.config.mjs",
    "tsdown.config.js"
  ].includes(filename);
}

class PackageBuildQueue {
  constructor(workspacePackages) {
    this.packageByName = new Map(workspacePackages.map((workspacePackage) => [workspacePackage.name, workspacePackage]));
    this.orderByName = new Map(workspacePackages.map((workspacePackage, index) => [workspacePackage.name, index]));
    this.pendingNames = new Set();
    this.running = false;
    this.waiters = [];
    this.hasFailed = false;
  }

  enqueue = (packageName) => {
    this.pendingNames.add(packageName);
    void this.run();
  };

  drain = async () => {
    if (!this.running && this.pendingNames.size === 0) {
      return !this.hasFailed;
    }
    return new Promise((resolveDrain) => {
      this.waiters.push(resolveDrain);
    });
  };

  run = async () => {
    if (this.running) {
      return;
    }
    this.running = true;
    while (this.pendingNames.size > 0) {
      const packageName = [...this.pendingNames].sort((left, right) => {
        return this.orderByName.get(left) - this.orderByName.get(right);
      })[0];
      this.pendingNames.delete(packageName);
      const workspacePackage = this.packageByName.get(packageName);
      const success = await buildPackage(workspacePackage);
      this.hasFailed = this.hasFailed || !success;
    }
    this.running = false;
    const success = !this.hasFailed;
    for (const waiter of this.waiters.splice(0)) {
      waiter(success);
    }
  };
}

function buildPackage(workspacePackage) {
  console.log(`[packages] build ${workspacePackage.name} (${workspacePackage.relativeDir})`);
  return new Promise((resolveBuild) => {
    const child = spawn("pnpm", ["-C", workspacePackage.dir, "build"], {
      cwd: rootDir,
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32"
    });

    child.on("error", (error) => {
      console.error(`[packages] ${workspacePackage.name} failed to start: ${error instanceof Error ? error.message : String(error)}`);
      resolveBuild(false);
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        console.log(`[packages] built ${workspacePackage.name}`);
        resolveBuild(true);
        return;
      }
      console.error(`[packages] ${workspacePackage.name} failed${typeof code === "number" ? ` with code ${code}` : ` with signal ${signal}`}`);
      resolveBuild(false);
    });
  });
}

await main();
