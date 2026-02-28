#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

class CommandRunner {
  run(command, args, options = {}) {
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: "inherit"
    });
    if (result.status !== 0) {
      throw new Error(`Command failed: ${command} ${args.join(" ")}`);
    }
  }

  capture(command, args, options = {}) {
    const result = spawnSync(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8"
    });
    if (result.status !== 0) {
      const stdout = (result.stdout ?? "").toString().trim();
      const stderr = (result.stderr ?? "").toString().trim();
      const details = [stdout ? `stdout:\n${stdout}` : "", stderr ? `stderr:\n${stderr}` : ""]
        .filter(Boolean)
        .join("\n");
      throw new Error(
        `Command failed: ${command} ${args.join(" ")}${details ? `\n${details}` : ""}`
      );
    }
    return (result.stdout ?? "").toString();
  }
}

class InstallerBuilder {
  constructor(options) {
    this.platform = options.platform;
    this.arch = options.arch;
    this.nodeVersion = options.nodeVersion;
    this.outputDir = options.outputDir;
    this.keepWorkdir = options.keepWorkdir;
    this.packageSpec = options.packageSpec;

    this.runner = new CommandRunner();
    this.repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
    this.nextclawDir = resolve(this.repoRoot, "packages/nextclaw");
    this.workdir = options.workdir;
    this.stageDir = resolve(this.workdir, "stage");
    this.bundleDir = resolve(this.workdir, "bundle");
    this.downloadDir = resolve(this.workdir, "downloads");
    this.manifest = {
      platform: this.platform,
      arch: this.arch,
      nodeVersion: this.nodeVersion,
      startedAt: new Date().toISOString()
    };
  }

  ensureSupportedTarget() {
    if (!["darwin", "win32"].includes(this.platform)) {
      throw new Error(`Unsupported platform: ${this.platform}. Expected darwin or win32.`);
    }
    if (!["x64", "arm64"].includes(this.arch)) {
      throw new Error(`Unsupported arch: ${this.arch}. Expected x64 or arm64.`);
    }
  }

  ensureBuildArtifacts() {
    if (this.packageSpec) {
      return;
    }
    const distDir = resolve(this.nextclawDir, "dist");
    const uiDistDir = resolve(this.nextclawDir, "ui-dist");
    if (!existsSync(distDir) || !existsSync(uiDistDir)) {
      throw new Error(
        [
          "Missing nextclaw build artifacts.",
          "Run `PATH=/opt/homebrew/bin:$PATH pnpm build` (or at least `pnpm -C packages/nextclaw build`) first."
        ].join(" ")
      );
    }
  }

  prepareDirectories() {
    rmSync(this.workdir, { recursive: true, force: true });
    mkdirSync(this.workdir, { recursive: true });
    mkdirSync(this.stageDir, { recursive: true });
    mkdirSync(this.bundleDir, { recursive: true });
    mkdirSync(this.downloadDir, { recursive: true });
    mkdirSync(this.outputDir, { recursive: true });
  }

  readVersion() {
    if (this.packageSpec) {
      const parsedVersion = this.tryParseVersionFromPackageSpec(this.packageSpec);
      if (parsedVersion) {
        this.version = parsedVersion;
        return;
      }
      const resolvedVersion = this.runner.capture("npm", ["view", this.packageSpec, "version"]).trim();
      if (!resolvedVersion) {
        throw new Error(`Unable to resolve version for package spec: ${this.packageSpec}`);
      }
      this.version = resolvedVersion;
      return;
    }
    const packageJsonPath = resolve(this.nextclawDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    this.version = packageJson.version;
    if (!this.version) {
      throw new Error("Unable to read nextclaw version from packages/nextclaw/package.json");
    }
  }

  tryParseVersionFromPackageSpec(packageSpec) {
    return this.parsePackageSpec(packageSpec)?.version ?? "";
  }

  parsePackageSpec(packageSpec) {
    const trimmed = packageSpec.trim();
    const versionSeparatorIndex = trimmed.lastIndexOf("@");
    if (versionSeparatorIndex <= 0 || versionSeparatorIndex === trimmed.length - 1) {
      return null;
    }
    const name = trimmed.slice(0, versionSeparatorIndex).trim();
    const maybeVersion = trimmed.slice(versionSeparatorIndex + 1).trim();
    if (!name || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(maybeVersion)) {
      return null;
    }
    return { name, version: maybeVersion };
  }

  tryResolveNpmRegistryTarball(packageSpec) {
    const parsed = this.parsePackageSpec(packageSpec);
    if (!parsed) {
      return null;
    }
    const encodedName = encodeURIComponent(parsed.name);
    const tarballBase = parsed.name.startsWith("@")
      ? parsed.name.slice(1).replace("/", "-")
      : parsed.name;
    return {
      filename: `${tarballBase}-${parsed.version}.tgz`,
      url: `https://registry.npmjs.org/${encodedName}/-/${tarballBase}-${parsed.version}.tgz`
    };
  }

  packNextclaw() {
    if (this.packageSpec) {
      const npmTarball = this.tryResolveNpmRegistryTarball(this.packageSpec);
      if (npmTarball) {
        const packedTargetPath = resolve(this.downloadDir, npmTarball.filename);
        this.runner.run("curl", ["-fL", npmTarball.url, "-o", packedTargetPath]);
        this.packedTgzPath = packedTargetPath;
        this.manifest.packageTarball = {
          path: this.packedTgzPath,
          sourceUrl: npmTarball.url,
          sizeBytes: statSync(this.packedTgzPath).size
        };
        return;
      }
    }

    const packArgs = this.packageSpec
      ? ["pack", this.packageSpec, "--silent"]
      : ["pack", "--silent"];
    const packOutput = this.runner.capture("npm", packArgs, {
      cwd: this.packageSpec ? this.downloadDir : this.nextclawDir
    });
    const lines = packOutput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const packName = lines.at(-1);
    if (!packName || !packName.endsWith(".tgz")) {
      throw new Error(`Unexpected npm pack output: ${packOutput}`);
    }
    const packedFromRepoPath = resolve(
      this.packageSpec ? this.downloadDir : this.nextclawDir,
      packName
    );
    const packedTargetPath = resolve(this.downloadDir, packName);
    if (packedFromRepoPath !== packedTargetPath) {
      cpSync(packedFromRepoPath, packedTargetPath);
      unlinkSync(packedFromRepoPath);
    }
    this.packedTgzPath = packedTargetPath;
    this.manifest.packageTarball = {
      path: this.packedTgzPath,
      sizeBytes: statSync(this.packedTgzPath).size
    };
  }

  getNodeArchiveInfo() {
    if (this.platform === "darwin") {
      const filename = `node-v${this.nodeVersion}-darwin-${this.arch}.tar.gz`;
      return {
        filename,
        url: `https://nodejs.org/dist/v${this.nodeVersion}/${filename}`,
        format: "tar.gz"
      };
    }
    const filename = `node-v${this.nodeVersion}-win-${this.arch}.zip`;
    return {
      filename,
      url: `https://nodejs.org/dist/v${this.nodeVersion}/${filename}`,
      format: "zip"
    };
  }

  async downloadRuntime() {
    const archive = this.getNodeArchiveInfo();
    const archivePath = resolve(this.downloadDir, archive.filename);
    const response = await fetch(archive.url);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download runtime: ${archive.url} (status=${response.status})`);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(archivePath));
    this.runtimeArchive = { ...archive, path: archivePath };
    this.manifest.runtimeArchive = {
      url: archive.url,
      path: archivePath,
      sizeBytes: statSync(archivePath).size
    };
  }

  extractRuntime() {
    const extractedRoot = resolve(this.workdir, "runtime-extracted");
    mkdirSync(extractedRoot, { recursive: true });

    if (this.runtimeArchive.format === "tar.gz") {
      this.runner.run("tar", ["-xzf", this.runtimeArchive.path, "-C", extractedRoot]);
    } else {
      const script = [
        `$ErrorActionPreference = 'Stop'`,
        `Expand-Archive -Path '${this.escapePowerShell(this.runtimeArchive.path)}' -DestinationPath '${this.escapePowerShell(extractedRoot)}' -Force`
      ].join("; ");
      this.runPowerShellScript(script);
    }

    const entries = readdirSync(extractedRoot, { withFileTypes: true });
    const nodeDirEntry = entries.find((entry) => entry.isDirectory() && entry.name.startsWith("node-v"));
    if (!nodeDirEntry) {
      throw new Error(`Unable to locate extracted node directory in ${extractedRoot}`);
    }
    const extractedRuntimeDir = resolve(extractedRoot, nodeDirEntry.name);
    const runtimeTarget = resolve(this.bundleDir, "runtime");
    cpSync(extractedRuntimeDir, runtimeTarget, { recursive: true });
    this.runtimeDir = runtimeTarget;
  }

  installApplicationPayload() {
    const appDir = resolve(this.bundleDir, "app");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(
      resolve(appDir, "package.json"),
      JSON.stringify({ name: "nextclaw-app-bundle", private: true }, null, 2),
      "utf8"
    );
    this.runner.capture(
      "npm",
      ["install", "--omit=dev", "--no-audit", "--no-fund", this.packedTgzPath],
      { cwd: appDir }
    );
    this.removeSourceMapFiles(appDir);
    this.appDir = appDir;
  }

  removeSourceMapFiles(rootDir) {
    const entries = readdirSync(rootDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(rootDir, entry.name);
      if (entry.isDirectory()) {
        this.removeSourceMapFiles(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".map")) {
        unlinkSync(fullPath);
      }
    }
  }

  writeLaunchers() {
    const startName = this.platform === "darwin" ? "Start NextClaw.command" : "Start NextClaw.cmd";
    const cliShimName = this.platform === "darwin" ? "nextclaw" : "nextclaw.cmd";

    const startPath = resolve(this.bundleDir, startName);
    const cliShimPath = resolve(this.bundleDir, cliShimName);
    const readmePath = resolve(this.bundleDir, "README.txt");

    if (this.platform === "darwin") {
      writeFileSync(
        startPath,
        [
          "#!/bin/bash",
          "set -euo pipefail",
          'BASE_DIR="$(cd "$(dirname "$0")" && pwd)"',
          'NODE_BIN="$BASE_DIR/runtime/bin/node"',
          'CLI_JS="$BASE_DIR/app/node_modules/nextclaw/dist/cli/index.js"',
          'exec "$NODE_BIN" "$CLI_JS" start --ui-open "$@"',
          ""
        ].join("\n"),
        "utf8"
      );
      writeFileSync(
        cliShimPath,
        [
          "#!/bin/bash",
          "set -euo pipefail",
          'BASE_DIR="$(cd "$(dirname "$0")" && pwd)"',
          'NODE_BIN="$BASE_DIR/runtime/bin/node"',
          'CLI_JS="$BASE_DIR/app/node_modules/nextclaw/dist/cli/index.js"',
          'exec "$NODE_BIN" "$CLI_JS" "$@"',
          ""
        ].join("\n"),
        "utf8"
      );
      chmodSync(startPath, 0o755);
      chmodSync(cliShimPath, 0o755);
    } else {
      writeFileSync(
        startPath,
        [
          "@echo off",
          "setlocal",
          "set \"BASE_DIR=%~dp0\"",
          "set \"NODE_BIN=%BASE_DIR%runtime\\node.exe\"",
          "set \"CLI_JS=%BASE_DIR%app\\node_modules\\nextclaw\\dist\\cli\\index.js\"",
          "\"%NODE_BIN%\" \"%CLI_JS%\" start --ui-open %*",
          ""
        ].join("\r\n"),
        "utf8"
      );
      writeFileSync(
        cliShimPath,
        [
          "@echo off",
          "setlocal",
          "set \"BASE_DIR=%~dp0\"",
          "set \"NODE_BIN=%BASE_DIR%runtime\\node.exe\"",
          "set \"CLI_JS=%BASE_DIR%app\\node_modules\\nextclaw\\dist\\cli\\index.js\"",
          "\"%NODE_BIN%\" \"%CLI_JS%\" %*",
          ""
        ].join("\r\n"),
        "utf8"
      );
    }

    writeFileSync(
      readmePath,
      [
        "NextClaw Desktop Runtime Bundle (Beta)",
        "",
        "1. Double-click \"Start NextClaw\" to launch.",
        "2. A browser tab will open to http://127.0.0.1:18791.",
        "3. To stop service, run: nextclaw stop (from the launcher directory).",
        "",
        "Beta notice: desktop installer is beta and may have issues.",
        "",
        "Data directory: ~/.nextclaw (or %USERPROFILE%\\.nextclaw on Windows).",
        ""
      ].join("\n"),
      "utf8"
    );
  }

  buildInstallerArtifact() {
    if (this.platform === "darwin") {
      this.buildMacInstaller();
      return;
    }
    this.buildWindowsInstaller();
  }

  buildMacInstaller() {
    const payloadRoot = resolve(this.stageDir, "pkg-root");
    const appInstallPath = resolve(payloadRoot, "Applications", "NextClaw");
    mkdirSync(appInstallPath, { recursive: true });
    cpSync(this.bundleDir, appInstallPath, { recursive: true });
    const outFile = resolve(
      this.outputDir,
      `NextClaw-${this.version}-beta-macos-${this.arch}-installer.pkg`
    );
    this.runner.run("pkgbuild", [
      "--root",
      payloadRoot,
      "--identifier",
      "io.nextclaw.installer",
      "--version",
      this.version,
      "--install-location",
      "/",
      outFile
    ]);
    this.installerPath = outFile;
  }

  buildWindowsInstaller() {
    const nsisTemplate = resolve(this.repoRoot, "scripts/installer/windows-installer.nsi");
    if (!existsSync(nsisTemplate)) {
      throw new Error(`NSIS template not found: ${nsisTemplate}`);
    }
    const outFile = resolve(
      this.outputDir,
      `NextClaw-${this.version}-beta-windows-${this.arch}-installer.exe`
    );
    const sourceDir = this.bundleDir;
    const makensis = this.resolveMakensisBinary();
    console.log(`[installer] using makensis: ${makensis}`);
    this.runner.run(makensis, [
      "/DAPP_NAME=NextClaw-Beta",
      `/DAPP_VERSION=${this.version}`,
      `/DAPP_ARCH=${this.arch}`,
      `/DAPP_SOURCE_DIR=${this.toWindowsPath(sourceDir)}`,
      `/DAPP_OUT_FILE=${this.toWindowsPath(outFile)}`,
      this.toWindowsPath(nsisTemplate)
    ]);
    this.installerPath = outFile;
  }

  resolveMakensisBinary() {
    const candidates = ["makensis"];
    if (process.platform === "win32") {
      candidates.push(
        "C:\\Program Files (x86)\\NSIS\\makensis.exe",
        "C:\\Program Files\\NSIS\\makensis.exe"
      );
      const chocoInstall = process.env.ChocolateyInstall?.trim();
      if (chocoInstall) {
        candidates.push(resolve(chocoInstall, "bin", "makensis.exe"));
      }
      const programData = process.env.ProgramData?.trim();
      if (programData) {
        candidates.push(resolve(programData, "chocolatey", "bin", "makensis.exe"));
      }
    }

    for (const candidate of candidates) {
      if (candidate === "makensis") {
        try {
          this.runner.capture("where", ["makensis"]);
          return candidate;
        } catch {
          continue;
        }
      }
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      [
        "Unable to locate makensis executable.",
        "Checked PATH lookup and common NSIS install locations.",
        `PATH=${process.env.PATH ?? ""}`
      ].join(" ")
    );
  }

  writeManifest() {
    const bundleSizeBytes = this.computeDirectorySize(this.bundleDir);
    this.manifest.bundleSizeBytes = bundleSizeBytes;
    this.manifest.installer = {
      path: this.installerPath,
      sizeBytes: statSync(this.installerPath).size
    };
    this.manifest.completedAt = new Date().toISOString();

    const manifestPath = resolve(
      this.outputDir,
      `manifest-${this.platform}-${this.arch}.json`
    );
    writeFileSync(manifestPath, `${JSON.stringify(this.manifest, null, 2)}\n`, "utf8");
    console.log(`[installer] manifest: ${manifestPath}`);
  }

  finish() {
    if (!this.keepWorkdir) {
      rmSync(this.workdir, { recursive: true, force: true });
    } else {
      console.log(`[installer] keep workdir: ${this.workdir}`);
    }
  }

  toWindowsPath(input) {
    return resolve(input).replace(/\//g, "\\");
  }

  escapePowerShell(input) {
    return input.replace(/'/g, "''");
  }

  runPowerShellScript(script) {
    try {
      this.runner.run("pwsh", ["-NoProfile", "-Command", script]);
    } catch {
      this.runner.run("powershell", ["-NoProfile", "-Command", script]);
    }
  }

  computeDirectorySize(target) {
    let total = 0;
    const entries = readdirSync(target, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(target, entry.name);
      if (entry.isDirectory()) {
        total += this.computeDirectorySize(fullPath);
      } else if (entry.isFile()) {
        total += statSync(fullPath).size;
      }
    }
    return total;
  }

  async run() {
    this.ensureSupportedTarget();
    this.ensureBuildArtifacts();
    this.prepareDirectories();
    this.readVersion();
    this.packNextclaw();
    await this.downloadRuntime();
    this.extractRuntime();
    this.installApplicationPayload();
    this.writeLaunchers();
    this.buildInstallerArtifact();
    this.writeManifest();
    this.finish();
    console.log(`[installer] output: ${this.installerPath}`);
    console.log(`[installer] size: ${(statSync(this.installerPath).size / 1024 / 1024).toFixed(1)} MB`);
  }
}

function parseArgs(argv) {
  const options = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.env.NEXTCLAW_INSTALLER_NODE_VERSION ?? "22.20.0",
    outputDir: resolve(process.cwd(), "dist/installers"),
    keepWorkdir: false,
    packageSpec: process.env.NEXTCLAW_INSTALLER_PACKAGE_SPEC?.trim() || ""
  };

  for (const arg of argv) {
    if (arg === "--keep-workdir") {
      options.keepWorkdir = true;
      continue;
    }
    if (!arg.startsWith("--") || !arg.includes("=")) {
      throw new Error(`Unsupported argument: ${arg}`);
    }
    const [key, value] = arg.slice(2).split("=");
    if (!value) {
      throw new Error(`Missing value for argument: ${arg}`);
    }
    if (key === "platform") {
      options.platform = value;
      continue;
    }
    if (key === "arch") {
      options.arch = value;
      continue;
    }
    if (key === "node-version") {
      options.nodeVersion = value;
      continue;
    }
    if (key === "output-dir") {
      options.outputDir = resolve(process.cwd(), value);
      continue;
    }
    if (key === "work-dir") {
      options.workdir = resolve(process.cwd(), value);
      continue;
    }
    if (key === "package-spec") {
      options.packageSpec = value.trim();
      continue;
    }
    throw new Error(`Unknown argument key: --${key}`);
  }

  if (!options.workdir) {
    if (options.platform === "win32") {
      const homeDir = process.env.USERPROFILE ?? process.env.RUNNER_TEMP ?? tmpdir();
      options.workdir = `${homeDir}\\zci-${Date.now()}`;
    } else {
      options.workdir = resolve(
        tmpdir(),
        `nextclaw-installer-${options.platform}-${options.arch}-${Date.now()}`
      );
    }
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const builder = new InstallerBuilder(options);
await builder.run();
