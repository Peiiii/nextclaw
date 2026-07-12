#!/usr/bin/env node
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { cp, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";
import {
  normalizeDesktopUpdateChannel,
  resolveGovernedMinimumLauncherVersion
} from "./launcher-compatibility.service.mjs";

const desktopDir = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const workspaceRoot = resolve(desktopDir, "..", "..");
const nextclawCorePackageRoot = resolve(workspaceRoot, "packages", "nextclaw-core");
const nextclawPackageRoot = resolve(workspaceRoot, "packages", "nextclaw");
const nextclawPackageJsonPath = resolve(nextclawPackageRoot, "package.json");
const RUNTIME_BUNDLE_FILE_BUDGET = 400;
const RUNTIME_ENTRYPOINT = "runtime/dist/cli/app/index.js";
const SESSION_SEARCH_WORKER_RELATIVE_PATH = "features/session-search/worker/session-search-worker-host.utils.js";
const requireFromCore = createRequire(join(nextclawCorePackageRoot, "package.json"));
const SHARP_RUNTIME_BASE_PACKAGE_NAMES = ["sharp", "detect-libc", "semver", "@img/colour"];
const SHARP_NATIVE_PACKAGE_NAMES_BY_TARGET = {
  "darwin-arm64": ["@img/sharp-darwin-arm64", "@img/sharp-libvips-darwin-arm64"],
  "darwin-x64": ["@img/sharp-darwin-x64", "@img/sharp-libvips-darwin-x64"],
  "linux-arm64": ["@img/sharp-linux-arm64", "@img/sharp-libvips-linux-arm64"],
  "linux-x64": ["@img/sharp-linux-x64", "@img/sharp-libvips-linux-x64"],
  "win32-arm64": ["@img/sharp-win32-arm64"],
  "win32-x64": ["@img/sharp-win32-x64"]
};
const CHANNEL_EXTENSION_PACKAGE_DIRS = [
  "nextclaw-channel-extension-dingtalk",
  "nextclaw-channel-extension-discord",
  "nextclaw-channel-extension-email",
  "nextclaw-channel-extension-feishu",
  "nextclaw-channel-extension-qq",
  "nextclaw-channel-extension-slack",
  "nextclaw-channel-extension-telegram",
  "nextclaw-channel-extension-wecom",
  "nextclaw-channel-extension-whatsapp",
  "nextclaw-channel-extension-weixin"
];

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

function resolveSharpRuntimePackageNames(options) {
  const target = `${options.platform}-${options.arch}`;
  const nativePackageNames = SHARP_NATIVE_PACKAGE_NAMES_BY_TARGET[target];
  if (!nativePackageNames) {
    throw new Error(`Unsupported sharp native dependency target for desktop runtime bundle: ${target}`);
  }
  return [...SHARP_RUNTIME_BASE_PACKAGE_NAMES, ...nativePackageNames];
}

function resolveSharpInstallNodeModulesRoot() {
  const sharpPackageJsonPath = requireFromCore.resolve("sharp/package.json");
  return dirname(dirname(sharpPackageJsonPath));
}

function readRuntimeNodeModulePackageNames(nodeModulesRoot) {
  if (!existsSync(nodeModulesRoot)) {
    return [];
  }
  return readdirSync(nodeModulesRoot, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) {
      return [];
    }
    if (!entry.name.startsWith("@")) {
      return [entry.name];
    }
    return readdirSync(join(nodeModulesRoot, entry.name), { withFileTypes: true })
      .filter((scopedEntry) => scopedEntry.isDirectory())
      .map((scopedEntry) => `${entry.name}/${scopedEntry.name}`);
  });
}

async function copyRuntimeNodeModulePackage(packageName, sourceNodeModulesRoot, targetNodeModulesRoot) {
  const pathSegments = packageName.split("/");
  const sourceRoot = join(sourceNodeModulesRoot, ...pathSegments);
  if (!existsSync(sourceRoot)) {
    throw new Error(
      [
        `Missing installed package required by desktop runtime bundle: ${packageName}`,
        "Run pnpm install with supportedArchitectures for the target platform and CPU before building the bundle."
      ].join(" ")
    );
  }

  const targetRoot = join(targetNodeModulesRoot, ...pathSegments);
  rmSync(targetRoot, { recursive: true, force: true });
  await mkdir(dirname(targetRoot), { recursive: true });
  await cp(sourceRoot, targetRoot, { recursive: true, dereference: true });
  rmSync(join(targetRoot, "node_modules"), { recursive: true, force: true });
}

async function copySharpRuntimeDependencies(workspace, options) {
  const packageNames = resolveSharpRuntimePackageNames(options);
  const sourceNodeModulesRoot = resolveSharpInstallNodeModulesRoot();
  await mkdir(workspace.nativeDependenciesRoot, { recursive: true });
  for (const packageName of packageNames) {
    await copyRuntimeNodeModulePackage(packageName, sourceNodeModulesRoot, workspace.nativeDependenciesRoot);
  }
  return packageNames;
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
      try {
        const sourceStat = await stat(sourcePath);
        if (sourceStat.isDirectory()) {
          await addDirectoryToZip(zip, sourcePath, targetPath);
          return;
        }
        zip.file(targetPath, readFileSync(sourcePath));
      } catch {
        return;
      }
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
    nativeDependenciesRoot: join(bundleRoot, "node_modules"),
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
      "--deps.never-bundle",
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

async function copyRuntimeAssets(workspace) {
  await mkdir(workspace.runtimeRoot, { recursive: true });
  await Promise.all([
    cp(join(nextclawPackageRoot, "ui-dist"), join(workspace.runtimeRoot, "ui-dist"), { recursive: true }),
    cp(join(nextclawPackageRoot, "ui-dist"), workspace.uiRoot, { recursive: true }),
    cp(join(nextclawPackageRoot, "templates"), join(workspace.runtimeRoot, "templates"), { recursive: true }),
    cp(join(nextclawPackageRoot, "resources"), join(workspace.runtimeRoot, "resources"), { recursive: true }),
    cp(join(nextclawPackageRoot, "bridge"), join(workspace.runtimeRoot, "bridge"), { recursive: true }),
    writeFile(join(workspace.runtimeRoot, "package.json"), readFileSync(nextclawPackageJsonPath, "utf8"), "utf8")
  ]);
}

async function copySessionSearchWorkerAssets(workspace) {
  const coreDistRoot = join(nextclawCorePackageRoot, "dist");
  const workerSourcePath = join(coreDistRoot, SESSION_SEARCH_WORKER_RELATIVE_PATH);
  const workerTargetPath = join(workspace.runtimeEntrypointDir, SESSION_SEARCH_WORKER_RELATIVE_PATH);
  if (!existsSync(workerSourcePath)) {
    throw new Error(`Session search worker asset is missing: ${relative(workspaceRoot, workerSourcePath)}`);
  }
  await mkdir(dirname(workerTargetPath), { recursive: true });
  await cp(workerSourcePath, workerTargetPath);

  const coreDistEntries = await readdir(coreDistRoot, { withFileTypes: true });
  const workerChunks = coreDistEntries
    .filter((entry) => entry.isFile() && /^session-search\.types-.+\.js$/.test(entry.name))
    .map((entry) => entry.name);
  if (workerChunks.length === 0) {
    throw new Error("Session search worker shared chunk is missing.");
  }
  await Promise.all(
    workerChunks.map((entryName) => cp(join(coreDistRoot, entryName), join(workspace.runtimeEntrypointDir, entryName)))
  );
  await cp(join(coreDistRoot, "skills"), join(workspace.runtimeEntrypointDir, "skills"), { recursive: true });
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
      "--deps.never-bundle",
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

  for (const packageDir of CHANNEL_EXTENSION_PACKAGE_DIRS) {
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
  ensureFreshRuntimeArtifacts();
  runCommand("node", [resolve(desktopDir, "scripts", "ensure-runtime.mjs")], workspaceRoot);
  await mkdir(workspace.bundleRoot, { recursive: true });
  bundleRuntimeEntrypoint(workspace);
  await copyRuntimeAssets(workspace);
  const nativeRuntimeDependencies = await copySharpRuntimeDependencies(workspace, options);
  await copySessionSearchWorkerAssets(workspace);
  await writeFile(join(workspace.runtimeEntrypointDir, "index.js"), 'import "./index.mjs";\n', "utf8");
  assertRuntimeBundleContract(workspace.runtimeRoot, workspace.nativeDependenciesRoot, nativeRuntimeDependencies);
  await copyPackagedChannelExtensions(workspace);
  assertPackagedExtensionBundleContract(workspace.pluginsRoot);
  const runtimeFileCount = await countFiles(workspace.runtimeRoot);
  const pluginFileCount = await countFiles(workspace.pluginsRoot);
  if (runtimeFileCount > RUNTIME_BUNDLE_FILE_BUDGET) {
    throw new Error(`Runtime bundle file count ${runtimeFileCount} exceeds budget ${RUNTIME_BUNDLE_FILE_BUDGET}.`);
  }
  return {
    runtimeFileCount,
    pluginFileCount,
    nativeRuntimeDependencies,
    packagedExtensionCount: CHANNEL_EXTENSION_PACKAGE_DIRS.length
  };
}

function assertRuntimeBundleContract(runtimeRoot, nativeDependenciesRoot, allowedRuntimeNodeModulePackageNames) {
  const requiredFiles = [
    "dist/cli/app/index.js",
    "dist/cli/app/index.mjs",
    `dist/cli/app/${SESSION_SEARCH_WORKER_RELATIVE_PATH}`,
    "dist/cli/app/skills/nextclaw-self-manage/SKILL.md",
    "package.json",
    "ui-dist/index.html"
  ];
  const missingFiles = requiredFiles.filter((relativePath) => !existsSync(join(runtimeRoot, relativePath)));
  if (missingFiles.length > 0) {
    throw new Error(`Runtime bundle is missing required packaged files: ${missingFiles.join(", ")}`);
  }
  if (existsSync(join(runtimeRoot, "node_modules"))) throw new Error("Runtime bundle must not contain runtime/node_modules.");
  const nodeModulePackageNames = readRuntimeNodeModulePackageNames(nativeDependenciesRoot);
  const allowedPackageNames = new Set(allowedRuntimeNodeModulePackageNames);
  const missingNodeModulePackageNames = allowedRuntimeNodeModulePackageNames.filter(
    (packageName) => !nodeModulePackageNames.includes(packageName)
  );
  if (missingNodeModulePackageNames.length > 0) {
    throw new Error(`Runtime bundle is missing native runtime dependencies: ${missingNodeModulePackageNames.join(", ")}`);
  }
  const unexpectedNodeModulePackageNames = nodeModulePackageNames.filter((packageName) => !allowedPackageNames.has(packageName));
  if (unexpectedNodeModulePackageNames.length > 0) {
    throw new Error(`Runtime bundle contains unexpected node_modules packages: ${unexpectedNodeModulePackageNames.join(", ")}`);
  }
}

function assertPackagedExtensionBundleContract(pluginsRoot) {
  const missingFiles = CHANNEL_EXTENSION_PACKAGE_DIRS.flatMap((packageDir) => {
    return [
      join(packageDir, "nextclaw.extension.json"),
      join(packageDir, "dist", "main.mjs")
    ].filter((relativePath) => !existsSync(join(pluginsRoot, relativePath)));
  });
  if (missingFiles.length > 0) {
    throw new Error(`Product bundle is missing packaged channel extension files: ${missingFiles.join(", ")}`);
  }
}

async function writeBundleManifest(bundleRoot, options) {
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
    migrationVersion: 1
  };
  await writeFile(join(bundleRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function writeBundleArchive(bundleRoot, options) {
  const { platform, arch, bundleVersion, outputDir } = options;
  const zip = new JSZip();
  await addDirectoryToZip(zip, bundleRoot, basename(bundleRoot));
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
        runtimeFileBudget: RUNTIME_BUNDLE_FILE_BUDGET,
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
    await writeBundleManifest(workspace.bundleRoot, options);
    const archivePath = await writeBundleArchive(workspace.bundleRoot, options);
    reportBundleBuildResult(archivePath, options, workspace, buildResult);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

buildBundleArchive(parseArgs(process.argv.slice(2))).catch((error) => {
  console.error(`[build-product-bundle] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
