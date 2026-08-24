#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const desktopDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = resolve(desktopDir, "..", "..");
const nextclawCorePackageRoot = resolve(workspaceRoot, "packages", "nextclaw-core");
const nextclawKernelPackageRoot = resolve(workspaceRoot, "packages", "nextclaw-kernel");
const requireFromCore = createRequire(join(nextclawCorePackageRoot, "package.json"));
const requireFromKernel = createRequire(join(nextclawKernelPackageRoot, "package.json"));
const requireFromDesktop = createRequire(join(desktopDir, "package.json"));
const defaultOutputRoot = resolve(desktopDir, "build", "native-app-resources");
const SHARP_RUNTIME_BASE_PACKAGE_NAMES = ["sharp", "detect-libc", "semver", "@img/colour"];
const SHARP_NATIVE_PACKAGE_NAMES_BY_TARGET = {
  "darwin-arm64": ["@img/sharp-darwin-arm64", "@img/sharp-libvips-darwin-arm64"],
  "darwin-x64": ["@img/sharp-darwin-x64", "@img/sharp-libvips-darwin-x64"],
  "linux-arm64": ["@img/sharp-linux-arm64", "@img/sharp-libvips-linux-arm64"],
  "linux-x64": ["@img/sharp-linux-x64", "@img/sharp-libvips-linux-x64"],
  "win32-arm64": ["@img/sharp-win32-arm64"],
  "win32-x64": ["@img/sharp-win32-x64"]
};
const SQLITE_RUNTIME_PACKAGE_NAMES = ["better-sqlite3", "bindings", "file-uri-to-path"];

export const DESKTOP_SQLITE_NATIVE_BINARY_RELATIVE_PATH = join(
  "node_modules",
  "better-sqlite3",
  "build",
  "Release",
  "better_sqlite3.node"
);

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

function readPackageJson(packageRoot) {
  return JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
}

function resolveSharpInstallNodeModulesRoot() {
  const sharpPackageJsonPath = requireFromCore.resolve("sharp/package.json");
  return dirname(dirname(sharpPackageJsonPath));
}

function resolveSqlitePackageRoots() {
  const betterSqlitePackageJsonPath = requireFromKernel.resolve("better-sqlite3/package.json");
  const requireFromBetterSqlite = createRequire(betterSqlitePackageJsonPath);
  return new Map([
    ["better-sqlite3", dirname(betterSqlitePackageJsonPath)],
    ["bindings", dirname(requireFromBetterSqlite.resolve("bindings/package.json"))],
    ["file-uri-to-path", dirname(requireFromBetterSqlite.resolve("file-uri-to-path/package.json"))]
  ]);
}

function resolveElectronVersion() {
  const electronPackageRoot = dirname(requireFromDesktop.resolve("electron/package.json"));
  const version = readPackageJson(electronPackageRoot).version;
  if (typeof version !== "string" || !version.trim()) {
    throw new Error(`Unable to resolve installed Electron version from ${electronPackageRoot}`);
  }
  return version.trim();
}

export function resolveDesktopNativeResourcePackageNames(platform, arch) {
  const target = `${platform}-${arch}`;
  const sharpNativePackageNames = SHARP_NATIVE_PACKAGE_NAMES_BY_TARGET[target];
  if (!sharpNativePackageNames) {
    throw new Error(`Unsupported native desktop resource target: ${target}`);
  }
  return [...SHARP_RUNTIME_BASE_PACKAGE_NAMES, ...sharpNativePackageNames, ...SQLITE_RUNTIME_PACKAGE_NAMES];
}

async function copyPackageRoot(packageName, sourceRoot, outputRoot) {
  if (!existsSync(sourceRoot)) {
    throw new Error(`Missing installed package required by Desktop native runtime: ${packageName} (${sourceRoot})`);
  }
  const targetRoot = join(outputRoot, "node_modules", ...packageName.split("/"));
  await mkdir(dirname(targetRoot), { recursive: true });
  await cp(sourceRoot, targetRoot, { recursive: true, dereference: true });
  rmSync(join(targetRoot, "node_modules"), { recursive: true, force: true });
}

async function copyDesktopRuntimePackages(packageNames, outputRoot) {
  const sharpNodeModulesRoot = resolveSharpInstallNodeModulesRoot();
  const sqlitePackageRoots = resolveSqlitePackageRoots();
  for (const packageName of packageNames) {
    const sourceRoot = sqlitePackageRoots.get(packageName) ?? join(sharpNodeModulesRoot, ...packageName.split("/"));
    await copyPackageRoot(packageName, sourceRoot, outputRoot);
  }
}

function installSqlitePrebuildForElectron(options) {
  const { outputRoot, electronVersion, platform, arch } = options;
  const sqlitePackageRoot = join(outputRoot, "node_modules", "better-sqlite3");
  rmSync(join(sqlitePackageRoot, "build"), { recursive: true, force: true });
  const prebuildInstallPath = requireFromDesktop.resolve("prebuild-install/bin.js");
  const result = spawnSync(
    process.execPath,
    [
      prebuildInstallPath,
      "--runtime=electron",
      `--target=${electronVersion}`,
      `--platform=${platform}`,
      `--arch=${arch}`,
      "--force"
    ],
    {
      cwd: sqlitePackageRoot,
      env: process.env,
      encoding: "utf8",
      stdio: "inherit"
    }
  );
  if (result.status !== 0) {
    throw new Error(
      `Unable to install better-sqlite3 prebuild for Electron ${electronVersion} ${platform}-${arch}`
    );
  }

  const nativeBinaryPath = join(outputRoot, DESKTOP_SQLITE_NATIVE_BINARY_RELATIVE_PATH);
  if (!existsSync(nativeBinaryPath)) {
    throw new Error(`Electron rebuild completed without the required SQLite native binary: ${nativeBinaryPath}`);
  }
}

export async function prepareDesktopNativeResources(options = {}) {
  const platform = options.platform?.trim() || process.platform;
  const arch = options.arch?.trim() || process.arch;
  const electronVersion = options.electronVersion?.trim() || resolveElectronVersion();
  const outputRoot = resolve(options.outputRoot?.trim() || defaultOutputRoot);
  const packageNames = resolveDesktopNativeResourcePackageNames(platform, arch);

  rmSync(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await copyDesktopRuntimePackages(packageNames, outputRoot);
  installSqlitePrebuildForElectron({ outputRoot, electronVersion, platform, arch });

  return {
    outputRoot,
    platform,
    arch,
    electronVersion,
    nativeResourcePackages: packageNames
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await prepareDesktopNativeResources({
    platform: args.platform,
    arch: args.arch,
    electronVersion: args["electron-version"],
    outputRoot: args["output-root"]
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  await main();
}
