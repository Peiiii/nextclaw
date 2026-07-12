#!/usr/bin/env node
import { existsSync, readFileSync, rmSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = resolve(desktopDir, "..", "..");
const nextclawCorePackageRoot = resolve(workspaceRoot, "packages", "nextclaw-core");
const requireFromCore = createRequire(join(nextclawCorePackageRoot, "package.json"));
const outputRoot = resolve(desktopDir, "build", "native-app-resources");
const NATIVE_RESOURCE_PACKAGES_BY_TARGET = {
  "darwin-arm64": ["@img/sharp-libvips-darwin-arm64"],
  "darwin-x64": ["@img/sharp-libvips-darwin-x64"],
  "linux-arm64": ["@img/sharp-libvips-linux-arm64"],
  "linux-x64": ["@img/sharp-libvips-linux-x64"],
  "win32-arm64": [],
  "win32-x64": []
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

function readPackageVersion(packageRoot) {
  const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  return typeof packageJson.version === "string" ? packageJson.version : "";
}

function resolveSharpInstallNodeModulesRoot() {
  const sharpPackageJsonPath = requireFromCore.resolve("sharp/package.json");
  return dirname(dirname(sharpPackageJsonPath));
}

function resolveNativeResourcePackageNames(platform, arch) {
  const target = `${platform}-${arch}`;
  const packageNames = NATIVE_RESOURCE_PACKAGES_BY_TARGET[target];
  if (!packageNames) {
    throw new Error(`Unsupported native desktop resource target: ${target}`);
  }
  return packageNames;
}

async function copyNativeResourcePackage(packageName, sourceNodeModulesRoot) {
  const pathSegments = packageName.split("/");
  const sourceRoot = join(sourceNodeModulesRoot, ...pathSegments);
  if (!existsSync(sourceRoot)) {
    throw new Error(
      [
        `Missing native desktop resource package: ${packageName}`,
        `sharp=${readPackageVersion(join(sourceNodeModulesRoot, "sharp")) || "unknown"}`,
        "Run pnpm install with optional dependencies before packaging the desktop app."
      ].join(" ")
    );
  }

  const targetRoot = join(outputRoot, "node_modules", ...pathSegments);
  await mkdir(dirname(targetRoot), { recursive: true });
  await cp(sourceRoot, targetRoot, { recursive: true, dereference: true });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const platform = args.platform?.trim() || process.platform;
  const arch = args.arch?.trim() || process.arch;
  const packageNames = resolveNativeResourcePackageNames(platform, arch);
  const sourceNodeModulesRoot = resolveSharpInstallNodeModulesRoot();

  rmSync(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  for (const packageName of packageNames) {
    await copyNativeResourcePackage(packageName, sourceNodeModulesRoot);
  }

  console.log(
    JSON.stringify(
      {
        outputRoot,
        platform,
        arch,
        nativeResourcePackages: packageNames
      },
      null,
      2
    )
  );
}

await main();
