#!/usr/bin/env node
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";
import { prepareDesktopNativeResources } from "../../prepare-native-app-resources.mjs";
import {
  PACKAGED_EXTENSION_PACKAGE_DIRS,
  PRODUCT_BUNDLE_ASSET_CONTRACT,
  RUNTIME_ENTRYPOINT
} from "../configs/product-bundle-assets.config.mjs";
import {
  assertPreparedProductBundle,
  copyProductBundleAssets,
  createProductBundleAssetInventory,
  verifyProductBundleArchive
} from "../utils/product-bundle-assets.utils.mjs";
import {
  normalizeDesktopUpdateChannel,
  resolveGovernedMinimumLauncherVersion
} from "./launcher-compatibility.service.mjs";

const desktopDir = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const workspaceRoot = resolve(desktopDir, "..", "..");
const nextclawCorePackageRoot = resolve(workspaceRoot, "packages", "nextclaw-core");
const nextclawKernelPackageRoot = resolve(workspaceRoot, "packages", "nextclaw-kernel");
const nextclawAppRuntimePackageRoot = resolve(workspaceRoot, "packages", "nextclaw-app-runtime");
const nextclawPackageRoot = resolve(workspaceRoot, "packages", "nextclaw");
const nextclawPackageJsonPath = resolve(nextclawPackageRoot, "package.json");

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

function readRequiredOption(args, key, fallback) {
  const value = args[key]?.trim() || fallback;
  if (!value) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
    encoding: "utf8",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
  }
}

function writePackagedExtensionManifest(sourcePackageRoot, targetRoot) {
  const manifest = readJson(join(sourcePackageRoot, "nextclaw.extension.json"));
  const packagedManifest = {
    ...manifest,
    server: {
      ...manifest.server,
      args: ["dist/main.mjs"]
    }
  };
  return writeFile(
    join(targetRoot, "nextclaw.extension.json"),
    `${JSON.stringify(packagedManifest, null, 2)}\n`,
    "utf8"
  );
}

function ensureFreshRuntimeArtifacts() {
  runCommand("pnpm", ["--filter", "nextclaw...", "build"], workspaceRoot);
}

function createWorkspaceTempRoot() {
  const tempParent = resolve(workspaceRoot, "tmp");
  mkdirSync(tempParent, { recursive: true });
  return mkdtempSync(join(tempParent, "nextclaw-product-bundle-"));
}

async function addDirectoryToZip(zip, sourceDir, zipRoot) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const sourcePath = join(sourceDir, entry.name);
      const targetPath = join(zipRoot, entry.name).replaceAll("\\", "/");
      const sourceStat = await stat(sourcePath);
      if (sourceStat.isDirectory()) {
        await addDirectoryToZip(zip, sourcePath, targetPath);
        return;
      }
      zip.file(targetPath, readFileSync(sourcePath));
    })
  );
}

function resolveBundleBuildOptions(args) {
  const nextclawPackage = readJson(nextclawPackageJsonPath);
  const channel = normalizeDesktopUpdateChannel(args.channel);
  return {
    bundleVersion: readRequiredOption(args, "version", nextclawPackage.version),
    platform: readRequiredOption(args, "platform", process.platform),
    arch: readRequiredOption(args, "arch", process.arch),
    channel,
    minimumLauncherVersion: resolveGovernedMinimumLauncherVersion({
      channel,
      minimumLauncherVersion: args["minimum-launcher-version"],
      allowOverride: args["allow-minimum-launcher-version-override"] === "true"
    }),
    outputDir: resolve(args["output-dir"]?.trim() || join(desktopDir, "dist-bundles"))
  };
}

function createBundleWorkspace(tempRoot) {
  const bundleRoot = join(tempRoot, "bundle");
  const runtimeRoot = join(bundleRoot, "runtime");
  const runtimeEntrypointDir = join(runtimeRoot, "dist", "cli", "app");
  const uiRoot = join(bundleRoot, "ui");
  const pluginsRoot = join(bundleRoot, "plugins");
  return {
    bundleRoot,
    runtimeRoot,
    runtimeEntrypointDir,
    nativeResourcesRoot: join(tempRoot, "native-app-resources"),
    uiRoot,
    pluginsRoot
  };
}

function bundleRuntimeEntrypoint(workspace) {
  runCommand(
    "pnpm",
    [
      "exec",
      "tsdown",
      "packages/nextclaw/src/cli/app/index.ts",
      "--no-config",
      "--format",
      "esm",
      "--platform",
      "node",
      "--target",
      "es2022",
      "--deps.neverBundle",
      "sharp",
      "--out-dir",
      workspace.runtimeEntrypointDir,
      "--shims",
      "--logLevel",
      "error"
    ],
    workspaceRoot
  );
}

function bundlePackagedExtensionEntrypoint(sourcePackageRoot, targetRoot) {
  runCommand(
    "pnpm",
    [
      "exec",
      "tsdown",
      join(sourcePackageRoot, "src", "main.ts"),
      "--no-config",
      "--format",
      "esm",
      "--platform",
      "node",
      "--target",
      "es2022",
      "--deps.neverBundle",
      "sharp",
      "--out-dir",
      join(targetRoot, "dist"),
      "--shims",
      "--logLevel",
      "error"
    ],
    workspaceRoot
  );
}

async function copyPackagedChannelExtensions(workspace) {
  await mkdir(workspace.pluginsRoot, { recursive: true });
  await writeFile(join(workspace.pluginsRoot, ".keep"), "\n", "utf8");

  for (const packageDir of PACKAGED_EXTENSION_PACKAGE_DIRS) {
    const sourcePackageRoot = join(workspaceRoot, "packages", "extensions", packageDir);
    const targetRoot = join(workspace.pluginsRoot, packageDir);
    if (!existsSync(join(sourcePackageRoot, "nextclaw.extension.json"))) {
      throw new Error(`Channel extension manifest is missing: ${relative(workspaceRoot, sourcePackageRoot)}`);
    }
    const packageJson = readJson(join(sourcePackageRoot, "package.json"));
    await mkdir(targetRoot, { recursive: true });
    await Promise.all([
      writePackagedExtensionManifest(sourcePackageRoot, targetRoot),
      writeFile(
        join(targetRoot, "package.json"),
        `${JSON.stringify({
          name: packageJson.name,
          version: packageJson.version,
          type: "module",
          private: true
        }, null, 2)}\n`,
        "utf8"
      )
    ]);
    bundlePackagedExtensionEntrypoint(sourcePackageRoot, targetRoot);
  }
}

async function countFiles(targetDir) {
  let fileCount = 0;
  const entries = await readdir(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      fileCount += await countFiles(entryPath);
      continue;
    }
    fileCount += 1;
  }
  return fileCount;
}

async function prepareBundleWorkspace(workspace, options) {
  const { platform, arch } = options;
  ensureFreshRuntimeArtifacts();
  runCommand("node", [resolve(desktopDir, "scripts", "ensure-runtime.mjs")], workspaceRoot);
  await mkdir(workspace.bundleRoot, { recursive: true });
  bundleRuntimeEntrypoint(workspace);
  const nativeResources = await prepareDesktopNativeResources({
    outputRoot: workspace.nativeResourcesRoot,
    platform,
    arch
  });
  const declaredAssets = await copyProductBundleAssets({
    bundleRoot: workspace.bundleRoot,
    sourceRoots: {
      "nextclaw-package": nextclawPackageRoot,
      "app-runtime-package": nextclawAppRuntimePackageRoot,
      "kernel-sqljs": join(nextclawKernelPackageRoot, "node_modules", "sql.js"),
      "core-dist": join(nextclawCorePackageRoot, "dist"),
      "native-resources": nativeResources.outputRoot
    },
    platform,
    arch,
    contract: PRODUCT_BUNDLE_ASSET_CONTRACT
  });
  const nativeRuntimeDependencies = nativeResources.nativeResourcePackages;
  await writeFile(join(workspace.runtimeRoot, "package.json"), readFileSync(nextclawPackageJsonPath, "utf8"), "utf8");
  await writeFile(join(workspace.runtimeEntrypointDir, "index.js"), 'import "./index.mjs";\n', "utf8");
  await copyPackagedChannelExtensions(workspace);
  const { runtimeFileCount, pluginFileCount } = assertPreparedProductBundle({
    bundleRoot: workspace.bundleRoot,
    platform,
    arch,
    declaredAssets,
    nativeRuntimeDependencies,
    packagedExtensions: PACKAGED_EXTENSION_PACKAGE_DIRS,
    contract: PRODUCT_BUNDLE_ASSET_CONTRACT
  });
  return {
    declaredAssets,
    runtimeFileCount,
    pluginFileCount,
    nativeRuntimeDependencies,
    packagedExtensionCount: PACKAGED_EXTENSION_PACKAGE_DIRS.length
  };
}
async function writeBundleManifest(bundleRoot, options, buildResult) {
  const { bundleVersion, platform, arch, minimumLauncherVersion } = options;
  const manifest = {
    bundleVersion,
    platform,
    arch,
    uiVersion: bundleVersion,
    runtimeVersion: bundleVersion,
    builtInPluginSetVersion: bundleVersion,
    launcherCompatibility: {
      minVersion: minimumLauncherVersion
    },
    entrypoints: {
      runtimeScript: RUNTIME_ENTRYPOINT
    },
    migrationVersion: 1,
    assetContract: {
      schemaVersion: PRODUCT_BUNDLE_ASSET_CONTRACT.schemaVersion,
      declaredAssets: buildResult.declaredAssets,
      nativeRuntimeDependencies: buildResult.nativeRuntimeDependencies,
      packagedExtensions: [...PACKAGED_EXTENSION_PACKAGE_DIRS],
      inventory: createProductBundleAssetInventory(bundleRoot)
    }
  };
  await writeFile(join(bundleRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function writeBundleArchive(bundleRoot, options) {
  const { platform, arch, bundleVersion, outputDir } = options;
  const zip = new JSZip();
  await addDirectoryToZip(zip, bundleRoot, basename(bundleRoot));
  const sourceFileCount = await countFiles(bundleRoot);
  const archiveFileCount = Object.values(zip.files).filter((entry) => !entry.dir).length;
  if (archiveFileCount !== sourceFileCount) {
    throw new Error(
      `Product bundle archive file count mismatch: source=${sourceFileCount} archive=${archiveFileCount}.`
    );
  }
  const archiveName = `nextclaw-bundle-${platform}-${arch}-${bundleVersion}.zip`;
  const archivePath = resolve(outputDir, archiveName);
  await mkdir(dirname(archivePath), { recursive: true });
  await writeFile(archivePath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  return archivePath;
}

function reportBundleBuildResult(archivePath, options, workspace, buildResult) {
  process.stdout.write(
    `${JSON.stringify(
      {
        archivePath,
        bundleVersion: options.bundleVersion,
        platform: options.platform,
        arch: options.arch,
        runtimeFileCount: buildResult.runtimeFileCount,
        nativeRuntimeDependencies: buildResult.nativeRuntimeDependencies,
        packagedExtensionCount: buildResult.packagedExtensionCount,
        pluginFileCount: buildResult.pluginFileCount,
        runtimeRoot: relative(workspaceRoot, workspace.runtimeRoot),
        uiRoot: relative(workspaceRoot, workspace.uiRoot),
        pluginsRoot: relative(workspaceRoot, workspace.pluginsRoot)
      },
      null,
      2
    )}\n`
  );
}

async function buildBundleArchive(args) {
  const options = resolveBundleBuildOptions(args);
  const tempRoot = createWorkspaceTempRoot();
  const workspace = createBundleWorkspace(tempRoot);

  try {
    const buildResult = await prepareBundleWorkspace(workspace, options);
    await writeBundleManifest(workspace.bundleRoot, options, buildResult);
    const archivePath = await writeBundleArchive(workspace.bundleRoot, options);
    await verifyProductBundleArchive(archivePath, {
      platform: options.platform,
      arch: options.arch,
      contract: PRODUCT_BUNDLE_ASSET_CONTRACT
    });
    reportBundleBuildResult(archivePath, options, workspace, buildResult);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

buildBundleArchive(parseArgs(process.argv.slice(2))).catch((error) => {
  console.error(`[build-product-bundle] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
