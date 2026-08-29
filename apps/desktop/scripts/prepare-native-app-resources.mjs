#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMacosAccessibilityAdapter, buildMacosKeyboardInputHelper } from "./native/build-macos-accessibility-adapter.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const desktopDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = resolve(desktopDir, "..", "..");
const nextclawCorePackageRoot = resolve(workspaceRoot, "packages", "nextclaw-core");
const requireFromCore = createRequire(join(nextclawCorePackageRoot, "package.json"));
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

function resolveSharpInstallNodeModulesRoot() {
  const sharpPackageJsonPath = requireFromCore.resolve("sharp/package.json");
  return dirname(dirname(sharpPackageJsonPath));
}

export function resolveDesktopNativeResourcePackageNames(platform, arch) {
  const target = `${platform}-${arch}`;
  const sharpNativePackageNames = SHARP_NATIVE_PACKAGE_NAMES_BY_TARGET[target];
  if (!sharpNativePackageNames) {
    throw new Error(`Unsupported native desktop resource target: ${target}`);
  }
  return [...SHARP_RUNTIME_BASE_PACKAGE_NAMES, ...sharpNativePackageNames];
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
  for (const packageName of packageNames) {
    const sourceRoot = join(sharpNodeModulesRoot, ...packageName.split("/"));
    await copyPackageRoot(packageName, sourceRoot, outputRoot);
  }
}

async function prepareSharpDirectRuntimeLayout(platform, arch, outputRoot) {
  const target = `${platform}-${arch}`;
  const sharpPackageRoot = join(outputRoot, "node_modules", "sharp");
  const sharpNativePackageRoot = join(outputRoot, "node_modules", "@img", `sharp-${target}`);
  const sharpBuildRoot = join(sharpPackageRoot, "src", "build", "Release");
  await mkdir(sharpBuildRoot, { recursive: true });
  await cp(join(sharpNativePackageRoot, "lib"), sharpBuildRoot, { recursive: true, dereference: true });

  const sharpLibvipsPackageRoot = join(outputRoot, "node_modules", "@img", `sharp-libvips-${target}`);
  if (existsSync(sharpLibvipsPackageRoot)) {
    await cp(sharpLibvipsPackageRoot, join(sharpPackageRoot, "src", `sharp-libvips-${target}`), {
      recursive: true,
      dereference: true
    });
  }
}

export async function prepareDesktopNativeResources(options = {}) {
  const platform = options.platform?.trim() || process.platform;
  const arch = options.arch?.trim() || process.arch;
  const outputRoot = resolve(options.outputRoot?.trim() || defaultOutputRoot);
  const packageNames = resolveDesktopNativeResourcePackageNames(platform, arch);

  rmSync(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await copyDesktopRuntimePackages(packageNames, outputRoot);
  await prepareSharpDirectRuntimeLayout(platform, arch, outputRoot);
  mkdirSync(join(outputRoot, "native"), { recursive: true });
  const macosAccessibilityModule = buildMacosAccessibilityAdapter({
    platform,
    arch,
    output: join(outputRoot, "native", "macos-accessibility.node"),
  });
  const macosKeyboardInputHelper = buildMacosKeyboardInputHelper({
    platform,
    arch,
    output: join(outputRoot, "native", "macos-keyboard-input"),
  });

  return {
    outputRoot,
    platform,
    arch,
    nativeResourcePackages: packageNames,
    macosAccessibilityModule,
    macosKeyboardInputHelper
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
