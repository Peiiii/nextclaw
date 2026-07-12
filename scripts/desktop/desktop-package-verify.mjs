#!/usr/bin/env node
import { createPublicKey, verify } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveRepoPath } from "../shared/repo-paths.mjs";

const rootDir = resolveRepoPath(import.meta.url);
const releaseDir = resolve(rootDir, "apps/desktop/release");
const channelExtensionPackages = [
  "nextclaw-channel-extension-feishu",
  "nextclaw-channel-extension-weixin",
  "nextclaw-channel-extension-qq",
  "nextclaw-channel-extension-dingtalk",
  "nextclaw-channel-extension-telegram",
  "nextclaw-channel-extension-discord",
  "nextclaw-channel-extension-email",
  "nextclaw-channel-extension-slack",
  "nextclaw-channel-extension-wecom",
  "nextclaw-channel-extension-whatsapp"
];
const nextclawPackageJsonPath = resolve(rootDir, "packages/nextclaw/package.json");
const isHandoffVerify = process.argv.includes("--handoff");
const RUNTIME_BUNDLE_FILE_BUDGET = 400;
const SHARP_RUNTIME_BASE_PACKAGE_NAMES = ["sharp", "detect-libc", "semver", "@img/colour"];
const SHARP_NATIVE_PACKAGE_NAMES_BY_TARGET = {
  "darwin-arm64": ["@img/sharp-darwin-arm64", "@img/sharp-libvips-darwin-arm64"],
  "darwin-x64": ["@img/sharp-darwin-x64", "@img/sharp-libvips-darwin-x64"],
  "linux-arm64": ["@img/sharp-linux-arm64", "@img/sharp-libvips-linux-arm64"],
  "linux-x64": ["@img/sharp-linux-x64", "@img/sharp-libvips-linux-x64"],
  "win32-arm64": ["@img/sharp-win32-arm64"],
  "win32-x64": ["@img/sharp-win32-x64"]
};

function binName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(command, args, options = {}) {
  console.log(`[desktop-verify] run: ${command} ${args.join(" ")}`);
  const startMs = Date.now();
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    env: { ...process.env, ...(options.env ?? {}) }
  });
  const elapsedMs = Date.now() - startMs;
  if (result.status !== 0) {
    throw new Error(`Command failed after ${elapsedMs}ms: ${command} ${args.join(" ")}`);
  }
  console.log(`[desktop-verify] completed in ${elapsedMs}ms: ${command} ${args.join(" ")}`);
}

function commandExists(command, args = ["--version"]) {
  const result = spawnSync(command, args, { stdio: "ignore" });
  if (result.error) {
    return false;
  }
  return result.status === 0;
}

function readUsablePython3Path() {
  const candidates = process.platform === "darwin" ? ["/usr/bin/python3", "python3"] : ["python3"];
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["-c", "import sys, plistlib; print(sys.executable)"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (result.status === 0 && !result.error) {
      return result.stdout.trim();
    }
  }
  return "";
}

function resolveSharpRuntimePackageNames(platform, arch) {
  const target = `${platform}-${arch}`;
  const nativePackageNames = SHARP_NATIVE_PACKAGE_NAMES_BY_TARGET[target];
  if (!nativePackageNames) {
    throw new Error(`Unsupported sharp native dependency target for desktop runtime bundle: ${target}`);
  }
  return [...SHARP_RUNTIME_BASE_PACKAGE_NAMES, ...nativePackageNames];
}

function ensureMacPythonCommand() {
  if (process.platform !== "darwin" || commandExists("python")) {
    return;
  }

  const python3Path = readUsablePython3Path();
  if (!python3Path) {
    return;
  }

  const shimDir = mkdtempSync(join(tmpdir(), "nextclaw-desktop-python-"));
  const pythonShimPath = join(shimDir, "python");
  symlinkSync(python3Path, pythonShimPath);
  process.env.PATH = `${shimDir}:${process.env.PATH ?? ""}`;
  process.on("exit", () => rmSync(shimDir, { recursive: true, force: true }));
  console.log(`[desktop-verify] using python shim: ${pythonShimPath} -> ${python3Path}`);
}

function findLatestReleaseFile(matcher) {
  if (!existsSync(releaseDir)) {
    return "";
  }
  const entries = readdirSync(releaseDir)
    .map((name) => {
      const fullPath = resolve(releaseDir, name);
      return {
        name,
        fullPath,
        mtimeMs: statSync(fullPath).mtimeMs
      };
    })
    .filter((entry) => matcher(entry.name))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return entries[0]?.fullPath ?? "";
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function printArtifactSize(label, artifactPath) {
  if (!existsSync(artifactPath)) {
    throw new Error(`Cannot inspect missing artifact: ${artifactPath}`);
  }
  const size = statSync(artifactPath).size;
  console.log(`[desktop-verify] artifact ${label}: ${artifactPath} (${formatBytes(size)})`);
}

function cleanReleaseDir() {
  rmSync(releaseDir, { recursive: true, force: true });
}

function runCommonBuildSteps() {
  run(binName("pnpm"), ["-C", "packages/nextclaw-core", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw-runtime", "build"]);
  for (const packageName of channelExtensionPackages) {
    run(binName("pnpm"), ["-C", `packages/extensions/${packageName}`, "build"]);
  }
  for (const packageDir of [
    "packages/ncp-packages/nextclaw-ncp",
    "packages/ncp-packages/nextclaw-ncp-toolkit",
    "packages/ncp-packages/nextclaw-ncp-http-agent-client",
    "packages/ncp-packages/nextclaw-ncp-react"
  ]) {
    run(binName("pnpm"), ["-C", packageDir, "build"]);
  }
  run(binName("pnpm"), ["-C", "packages/nextclaw-ui", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw-server", "build"]);
  run(binName("pnpm"), ["-C", "packages/nextclaw", "build"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "bundle:public-key:ensure"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "bundle:seed", "--", "--channel", "stable"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "lint"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "tsc"]);
  run(binName("pnpm"), ["-C", "apps/desktop", "build:main"], {
    env: { CSC_IDENTITY_AUTO_DISCOVERY: "false" }
  });
  run(binName("pnpm"), [
    "-C",
    "apps/desktop",
    "native-resources",
    "--",
    "--platform",
    process.platform,
    "--arch",
    process.arch
  ]);
}

function parsePublicKey(publicKeyPem, context) {
  try {
    return createPublicKey(publicKeyPem);
  } catch (error) {
    throw new Error(`Invalid desktop update public key from ${context}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readExpectedBundleVersion() {
  const nextclawPackage = JSON.parse(readFileSync(nextclawPackageJsonPath, "utf8"));
  const version = typeof nextclawPackage.version === "string" ? nextclawPackage.version.trim() : "";
  if (!version) {
    throw new Error(`Invalid nextclaw package version: ${nextclawPackageJsonPath}`);
  }
  return version;
}

function readZipBundleVersion(zipPath) {
  const script = [
    "const JSZip=require('jszip');",
    "const fs=require('fs');",
    "const zipPath=process.argv[1];",
    "JSZip.loadAsync(fs.readFileSync(zipPath))",
    "  .then(async (zip) => {",
    "    const manifestEntry = zip.file('bundle/manifest.json');",
    "    if (!manifestEntry) throw new Error(`bundle/manifest.json missing: ${zipPath}`);",
    "    const manifest = JSON.parse(await manifestEntry.async('string'));",
    "    if (!manifest?.bundleVersion || typeof manifest.bundleVersion !== 'string') {",
    "      throw new Error(`bundleVersion missing: ${zipPath}`);",
    "    }",
    "    console.log(manifest.bundleVersion.trim());",
    "  })",
    "  .catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });"
  ].join(" ");
  const result = spawnSync(binName("pnpm"), ["-C", "apps/desktop", "exec", "node", "-e", script, zipPath], {
    cwd: rootDir,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`Failed to read bundleVersion from ${zipPath}: ${result.stderr || result.stdout}`);
  }
  const bundleVersion = result.stdout.trim();
  if (!bundleVersion) {
    throw new Error(`Empty bundleVersion from ${zipPath}`);
  }
  return bundleVersion;
}

function assertSeedBundleVersion(seedBundlePath) {
  const expectedVersion = readExpectedBundleVersion();
  const actualVersion = readZipBundleVersion(seedBundlePath);
  if (actualVersion !== expectedVersion) {
    throw new Error(
      `Packaged seed bundle version mismatch: expected ${expectedVersion} but got ${actualVersion} (${seedBundlePath})`
    );
  }
  console.log(`[desktop-verify] seed bundle version verified: ${actualVersion}`);
}

function assertSeedBundleRuntimeShape(seedBundlePath, platform, arch) {
  const expectedChannelExtensionPackages = JSON.stringify(channelExtensionPackages);
  const allowedRuntimeNodeModulePackageNames = JSON.stringify(resolveSharpRuntimePackageNames(platform, arch));
  const script = [
    "const JSZip=require('jszip');",
    "const fs=require('fs');",
    "const zipPath=process.argv[1];",
    `const runtimeFileBudget=${RUNTIME_BUNDLE_FILE_BUDGET};`,
    `const expectedChannelExtensionPackages=${expectedChannelExtensionPackages};`,
    `const allowedRuntimeNodeModulePackageNames=${allowedRuntimeNodeModulePackageNames};`,
    "function packageNameToZipPath(packageName) {",
    "  return `bundle/node_modules/${packageName}/package.json`;",
    "}",
    "function readNativeDependencyPackageNames(entries) {",
    "  const packageNames = new Set();",
    "  const prefix = 'bundle/node_modules/';",
    "  for (const entry of entries) {",
    "    if (!entry.startsWith(prefix)) continue;",
    "    const segments = entry.slice(prefix.length).split('/').filter(Boolean);",
    "    if (segments.length === 0) continue;",
    "    packageNames.add(segments[0].startsWith('@') ? `${segments[0]}/${segments[1] ?? ''}` : segments[0]);",
    "  }",
    "  return Array.from(packageNames).filter((packageName) => !packageName.endsWith('/')).sort();",
    "}",
    "JSZip.loadAsync(fs.readFileSync(zipPath))",
    "  .then((zip) => {",
    "    const entries = Object.keys(zip.files);",
    "    const forbiddenNodeModules = entries.filter((name) => name.startsWith('bundle/runtime/node_modules/') || /^bundle\\/plugins\\/[^/]+\\/(?:dist\\/)?node_modules\\//.test(name));",
    "    if (forbiddenNodeModules.length > 0) throw new Error(`seed bundle contains forbidden nested node_modules: ${forbiddenNodeModules[0]}`);",
    "    const nativeDependencyPackageNames = readNativeDependencyPackageNames(entries);",
    "    const unexpectedNativeDependencyPackageNames = nativeDependencyPackageNames.filter((packageName) => !allowedRuntimeNodeModulePackageNames.includes(packageName));",
    "    if (unexpectedNativeDependencyPackageNames.length > 0) throw new Error(`seed bundle contains unexpected native dependency packages: ${unexpectedNativeDependencyPackageNames.join(', ')}`);",
    "    const missingRuntimeNodeModulePackageNames = allowedRuntimeNodeModulePackageNames.filter((packageName) => !zip.file(packageNameToZipPath(packageName)));",
    "    if (missingRuntimeNodeModulePackageNames.length > 0) {",
    "      throw new Error(`seed bundle is missing native runtime dependencies: ${missingRuntimeNodeModulePackageNames.join(', ')}`);",
    "    }",
    "    const runtimeFiles = entries.filter((name) => name.startsWith('bundle/runtime/') && !zip.files[name].dir);",
    "    if (runtimeFiles.length > runtimeFileBudget) {",
    "      throw new Error(`seed bundle runtime file count ${runtimeFiles.length} exceeds budget ${runtimeFileBudget}: ${zipPath}`);",
    "    }",
    "    const missingExtensionFiles = expectedChannelExtensionPackages.flatMap((name) => [",
    "      `bundle/plugins/${name}/nextclaw.extension.json`,",
    "      `bundle/plugins/${name}/dist/main.mjs`",
    "    ].filter((entry) => !zip.file(entry)));",
    "    if (missingExtensionFiles.length > 0) {",
    "      throw new Error(`seed bundle missing packaged channel extension files: ${missingExtensionFiles.join(', ')}`);",
    "    }",
    "    const pluginFiles = entries.filter((name) => name.startsWith('bundle/plugins/') && !zip.files[name].dir);",
    "    console.log(`runtimeFiles=${runtimeFiles.length} pluginFiles=${pluginFiles.length} nativeRuntimeDependencies=${nativeDependencyPackageNames.join(',')}`);",
    "  })",
    "  .catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exit(1); });"
  ].join(" ");
  const result = spawnSync(binName("pnpm"), ["-C", "apps/desktop", "exec", "node", "-e", script, seedBundlePath], {
    cwd: rootDir,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`Invalid packaged seed bundle runtime shape: ${result.stderr || result.stdout}`);
  }
  console.log(`[desktop-verify] seed bundle runtime shape verified (${result.stdout.trim()}): ${seedBundlePath}`);
}

function assertDesktopPackageExcludesNestedElectron(appRoot) {
  const nestedElectronPath = resolve(appRoot, "Contents/Resources/app.asar.unpacked/node_modules/electron");
  if (existsSync(nestedElectronPath)) {
    throw new Error(`Packaged desktop app embeds nested Electron runtime: ${nestedElectronPath}`);
  }
  console.log(`[desktop-verify] desktop app excludes nested Electron runtime: ${appRoot}`);
}

function verifySeedBundleRuntimeInit(seedBundlePath) {
  const tempRoot = mkdtempSync(join(tmpdir(), "nextclaw-seed-runtime-verify-"));
  const extractRoot = resolve(tempRoot, "extract");
  const runtimeHome = resolve(tempRoot, "home");
  try {
    run("ditto", ["-x", "-k", seedBundlePath, extractRoot]);
    const runtimeScriptPath = resolve(extractRoot, "bundle", "runtime", "dist", "cli", "app", "index.js");
    if (!existsSync(runtimeScriptPath)) {
      throw new Error(`Packaged seed runtime script missing: ${runtimeScriptPath}`);
    }
    run(binName("node"), [runtimeScriptPath, "init"], {
      env: {
        NEXTCLAW_HOME: runtimeHome
      }
    });
    console.log(`[desktop-verify] seed runtime init verified: ${runtimeScriptPath}`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function serializeUnsignedManifest(manifest) {
  return JSON.stringify({
    channel: manifest.channel,
    platform: manifest.platform,
    arch: manifest.arch,
    latestVersion: manifest.latestVersion,
    minimumLauncherVersion: manifest.minimumLauncherVersion,
    bundleUrl: manifest.bundleUrl,
    bundleSha256: manifest.bundleSha256,
    bundleSignature: manifest.bundleSignature,
    releaseNotesUrl: manifest.releaseNotesUrl
  });
}

function assertManifestSignatureCanBeVerified(publicKeyPath, manifestUrl) {
  const publicKey = parsePublicKey(readFileSync(publicKeyPath, "utf8"), publicKeyPath);
  const response = spawnSync("curl", ["-fsSL", manifestUrl], {
    cwd: rootDir,
    encoding: "utf8"
  });
  if (response.status !== 0) {
    throw new Error(`Failed to download ${manifestUrl}: ${response.stderr || response.stdout}`);
  }
  const manifest = JSON.parse(response.stdout);
  const signature = Buffer.from(manifest.manifestSignature, "base64");
  const valid = verify(null, Buffer.from(serializeUnsignedManifest(manifest)), publicKey, signature);
  if (!valid) {
    throw new Error(`Packaged update public key cannot verify published manifest: ${manifestUrl}`);
  }
  console.log(`[desktop-verify] update manifest signature verified: ${manifestUrl}`);
}

function verifyMacDesktopPackage() {
  cleanReleaseDir();
  const arch = process.arch === "x64" ? "x64" : "arm64";
  run(binName("pnpm"), [
    "-C",
    "apps/desktop",
    "exec",
    "electron-builder",
    "--mac",
    "dmg",
    `--${arch}`,
    "--publish",
    "never"
  ], {
    env: { CSC_IDENTITY_AUTO_DISCOVERY: "false" }
  });
  const dmgPath = findLatestReleaseFile((name) => name.endsWith(".dmg"));
  if (!dmgPath) {
    throw new Error("No dmg artifact found in apps/desktop/release");
  }
  const mountedAppRoot = resolve(releaseDir, `mac-${arch}`, "NextClaw Desktop.app");
  const seedBundlePath = resolve(mountedAppRoot, "Contents/Resources/update/seed-product-bundle.zip");
  if (!existsSync(seedBundlePath)) {
    throw new Error(`Packaged seed bundle missing: ${seedBundlePath}`);
  }
  const packagedPublicKeyPath = resolve(mountedAppRoot, "Contents/Resources/update/update-bundle-public.pem");
  if (!existsSync(packagedPublicKeyPath)) {
    throw new Error(`Packaged update public key missing: ${packagedPublicKeyPath}`);
  }
  printArtifactSize("dmg", dmgPath);
  printArtifactSize("seed bundle", seedBundlePath);
  parsePublicKey(readFileSync(packagedPublicKeyPath, "utf8"), packagedPublicKeyPath);
  assertManifestSignatureCanBeVerified(
    packagedPublicKeyPath,
    `https://Peiiii.github.io/nextclaw/desktop-updates/stable/manifest-stable-darwin-${arch}.json`
  );
  assertDesktopPackageExcludesNestedElectron(mountedAppRoot);
  assertSeedBundleVersion(seedBundlePath);
  assertSeedBundleRuntimeShape(seedBundlePath, process.platform, arch);
  verifySeedBundleRuntimeInit(seedBundlePath);
  run("bash", ["apps/desktop/scripts/smoke-macos-dmg.sh", dmgPath, "120"]);
  if (isHandoffVerify) {
    run("bash", ["apps/desktop/scripts/smoke-macos-dmg.sh", dmgPath, "120"], {
      env: { NEXTCLAW_DESKTOP_SMOKE_PROFILE: "real" }
    });
  } else {
    console.log("[desktop-verify] real-profile handoff smoke skipped. Run `pnpm desktop:package:handoff:verify` before giving a clickable local macOS artifact to a human.");
  }
  console.log(`[desktop-verify] macOS package verified: ${dmgPath}`);
}

function verifyWindowsDesktopPackage() {
  cleanReleaseDir();
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  run(binName("pnpm"), [
    "-C",
    "apps/desktop",
    "exec",
    "electron-builder",
    "--win",
    "dir",
    `--${arch}`,
    "--publish",
    "never"
  ], {
    env: { CSC_IDENTITY_AUTO_DISCOVERY: "false" }
  });
  const desktopExePath = resolve(releaseDir, "win-unpacked", "NextClaw Desktop.exe");
  if (!existsSync(desktopExePath)) {
    throw new Error(`No Windows desktop executable found: ${desktopExePath}`);
  }

  const psArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "apps/desktop/scripts/smoke-windows-desktop.ps1",
    "-DesktopExePath",
    desktopExePath,
    "-StartupTimeoutSec",
    "120",
    "-MaxReadySec",
    "20",
    "-SeedStaleSameVersionBundle"
  ];
  if (commandExists("pwsh")) {
    run("pwsh", psArgs);
  } else {
    run("powershell", psArgs);
  }
  console.log(`[desktop-verify] Windows desktop executable verified: ${desktopExePath}`);

  run(binName("pnpm"), ["desktop:portable:verify"]);

  run(binName("pnpm"), [
    "-C",
    "apps/desktop",
    "exec",
    "electron-builder",
    "--win",
    "nsis",
    `--${arch}`,
    "--publish",
    "never"
  ], {
    env: { CSC_IDENTITY_AUTO_DISCOVERY: "false" }
  });
  const installerPath = findLatestReleaseFile((name) => name.endsWith(".exe") && name.includes("Setup"));
  if (!installerPath) {
    throw new Error("No Windows installer executable found in apps/desktop/release");
  }

  const installerPsArgs = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    "apps/desktop/scripts/smoke-windows-installer.ps1",
    "-InstallerPath",
    installerPath,
    "-StartupTimeoutSec",
    "120",
    "-MaxReadySec",
    "20",
    "-SeedStaleSameVersionBundle"
  ];
  if (commandExists("pwsh")) {
    run("pwsh", installerPsArgs);
  } else {
    run("powershell", installerPsArgs);
  }
  console.log(`[desktop-verify] Windows desktop installer verified: ${installerPath}`);
}

function verifyLinuxDesktopPackage() {
  cleanReleaseDir();
  if (process.arch !== "x64") {
    throw new Error("Linux package verification currently supports x64 only.");
  }
  run(binName("pnpm"), [
    "-C",
    "apps/desktop",
    "exec",
    "electron-builder",
    "--linux",
    "AppImage",
    "deb",
    "--x64",
    "--publish",
    "never"
  ], {
    env: { CSC_IDENTITY_AUTO_DISCOVERY: "false" }
  });

  const appImagePath = findLatestReleaseFile((name) => name.endsWith(".AppImage"));
  if (!appImagePath) {
    throw new Error("No Linux AppImage artifact found in apps/desktop/release");
  }
  run("bash", ["apps/desktop/scripts/smoke-linux-appimage.sh", appImagePath, "120"]);

  const debPath = findLatestReleaseFile((name) => name.endsWith(".deb"));
  if (!debPath) {
    throw new Error("No Linux deb artifact found in apps/desktop/release");
  }
  run("bash", ["apps/desktop/scripts/smoke-linux-deb.sh", debPath]);
  run(
    binName("node"),
    [
      "scripts/desktop/build-linux-apt-repo.mjs",
      "--input-dir",
      releaseDir,
      "--output-dir",
      resolve(rootDir, "dist/linux-apt-repo-local"),
      "--signing-mode",
      "test"
    ]
  );
  run("bash", ["apps/desktop/scripts/smoke-linux-apt-repo.sh", resolve(rootDir, "dist/linux-apt-repo-local", "apt")]);
  console.log(`[desktop-verify] Linux AppImage verified: ${appImagePath}`);
  console.log(`[desktop-verify] Linux deb verified: ${debPath}`);
}

function main() {
  console.log(`[desktop-verify] platform=${process.platform} arch=${process.arch}`);
  console.log(`[desktop-verify] mode=${isHandoffVerify ? "handoff" : "package"}`);
  ensureMacPythonCommand();
  runCommonBuildSteps();

  if (process.platform === "darwin") {
    verifyMacDesktopPackage();
    return;
  }
  if (process.platform === "win32") {
    verifyWindowsDesktopPackage();
    return;
  }
  if (process.platform === "linux") {
    verifyLinuxDesktopPackage();
    return;
  }

  throw new Error(
    "Unsupported platform for local desktop package verification. Use macOS, Windows, or Linux."
  );
}

main();
