#!/usr/bin/env node
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { resolveRepoPath } from "../shared/repo-paths.mjs";

const DEFAULT_ARCH = "x86_64";
const SUPPORTED_ARCHES = new Set(["x86_64", "aarch64"]);
const DEFAULT_SERVICE_PORT = "55667";

class NextclawFnosPackageBuilder {
  repoRoot = resolveRepoPath(import.meta.url);
  templateRoot = resolve(this.repoRoot, "apps/fnos-nextclaw/pack-template");
  outputRoot = resolve(this.repoRoot, "dist/fnos-nextclaw");
  iconSourcePath = resolve(this.repoRoot, "apps/desktop/build/icons/icon.png");
  licenseSourcePath = resolve(this.repoRoot, "LICENSE");
  nextclawPackagePath = resolve(this.repoRoot, "packages/nextclaw/package.json");

  build = (rawArgs) => {
    const options = this.parseOptions(rawArgs);
    const version = this.readNextclawVersion();
    const archOutputRoot = resolve(options.outputRoot, options.arch);
    const packageDir = resolve(archOutputRoot, "fnnas.nextclaw");
    const serverDir = resolve(packageDir, "app/server");
    const imagesDir = resolve(packageDir, "app/ui/images");

    this.ensureWorkspaceArtifacts();
    this.preparePackageDirectory({ packageDir, archOutputRoot });
    this.copyTemplate({ packageDir, version, arch: options.arch, servicePort: options.servicePort });
    this.copyLicense(packageDir);
    this.copyIcons(imagesDir);
    this.deployNextclawServer(serverDir);
    this.removeBinDirectories(serverDir);
    if (this.countSymlinks(serverDir) > 0) {
      throw new Error(`Server deploy output still contains symlinks: ${serverDir}`);
    }

    const result = {
      version,
      arch: options.arch,
      servicePort: options.servicePort,
      packageDir,
      fpkPath: null
    };

    if (!options.skipFnpack && this.findExecutable("fnpack")) {
      result.fpkPath = this.buildFpk(packageDir);
    } else if (!options.skipFnpack) {
      console.log("[fnos-package] fnpack 未安装，已跳过 .fpk 生成，仅保留打包目录。");
    }

    this.printSummary(result);
  };

  parseOptions = (rawArgs) => {
    const options = {
      arch: DEFAULT_ARCH,
      outputRoot: this.outputRoot,
      servicePort: DEFAULT_SERVICE_PORT,
      skipFnpack: false
    };

    for (let index = 0; index < rawArgs.length; index += 1) {
      const current = rawArgs[index];
      if (current === "--") {
        continue;
      }
      if (current === "--arch") {
        options.arch = rawArgs[index + 1] ?? "";
        index += 1;
        continue;
      }
      if (current === "--output-root") {
        options.outputRoot = resolve(this.repoRoot, rawArgs[index + 1] ?? "");
        index += 1;
        continue;
      }
      if (current === "--service-port") {
        options.servicePort = rawArgs[index + 1] ?? "";
        index += 1;
        continue;
      }
      if (current === "--skip-fnpack") {
        options.skipFnpack = true;
        continue;
      }
      throw new Error(`Unknown option: ${current}`);
    }

    if (!SUPPORTED_ARCHES.has(options.arch)) {
      throw new Error(`Unsupported arch "${options.arch}". Expected one of: ${[...SUPPORTED_ARCHES].join(", ")}`);
    }
    if (!/^\d+$/.test(options.servicePort)) {
      throw new Error(`Invalid service port "${options.servicePort}".`);
    }

    return options;
  };

  readNextclawVersion = () => {
    const raw = readFileSync(this.nextclawPackagePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed?.version) {
      throw new Error(`Missing version in ${this.nextclawPackagePath}`);
    }
    return parsed.version;
  };

  ensureWorkspaceArtifacts = () => {
    this.run("pnpm", ["-r", "--filter", "nextclaw...", "build"]);
  };

  preparePackageDirectory = ({ packageDir, archOutputRoot }) => {
    rmSync(packageDir, { recursive: true, force: true });
    mkdirSync(archOutputRoot, { recursive: true });
  };

  copyTemplate = ({ packageDir, version, arch, servicePort }) => {
    cpSync(this.templateRoot, packageDir, { recursive: true });
    const replacements = [
      ["__NEXTCLAW_VERSION__", version],
      ["__FNOS_ARCH__", arch],
      ["__FNOS_PLATFORM__", this.resolvePlatform(arch)],
      ["__NEXTCLAW_SERVICE_PORT__", servicePort]
    ];
    const filesToRender = [
      resolve(packageDir, "manifest"),
      resolve(packageDir, "cmd/main"),
      resolve(packageDir, "app/ui/config")
    ];

    for (const filePath of filesToRender) {
      let content = readFileSync(filePath, "utf8");
      for (const [from, to] of replacements) {
        content = content.replaceAll(from, to);
      }
      writeFileSync(filePath, content);
    }

    chmodSync(resolve(packageDir, "cmd/main"), 0o755);
  };

  copyLicense = (packageDir) => {
    if (!existsSync(this.licenseSourcePath)) {
      return;
    }
    cpSync(this.licenseSourcePath, resolve(packageDir, "LICENSE"));
  };

  copyIcons = (imagesDir) => {
    if (!existsSync(this.iconSourcePath)) {
      throw new Error(`Missing icon source at ${this.iconSourcePath}`);
    }
    const packageRoot = resolve(imagesDir, "../../..");
    mkdirSync(imagesDir, { recursive: true });
    this.writeIconVariant(this.iconSourcePath, resolve(imagesDir, "icon-64.png"), 64);
    this.writeIconVariant(this.iconSourcePath, resolve(imagesDir, "icon_64.png"), 64);
    this.writeIconVariant(this.iconSourcePath, resolve(imagesDir, "icon-256.png"), 256);
    this.writeIconVariant(this.iconSourcePath, resolve(imagesDir, "icon_256.png"), 256);
    this.writeIconVariant(this.iconSourcePath, resolve(packageRoot, "ICON.PNG"), 64);
    this.writeIconVariant(this.iconSourcePath, resolve(packageRoot, "ICON_256.PNG"), 256);
  };

  writeIconVariant = (sourcePath, outputPath, size) => {
    if (process.platform === "darwin" && this.findExecutable("sips")) {
      const result = spawnSync("sips", ["-z", String(size), String(size), sourcePath, "--out", outputPath], {
        cwd: this.repoRoot,
        stdio: "ignore",
        env: process.env
      });
      if (result.status === 0) {
        return;
      }
    }
    cpSync(sourcePath, outputPath);
  };

  deployNextclawServer = (serverDir) => {
    rmSync(serverDir, { recursive: true, force: true });
    this.run("pnpm", [
      "--config.node-linker=hoisted",
      "--config.package-import-method=copy",
      "--config.lockfile=false",
      "--filter",
      "nextclaw",
      "--prod",
      "deploy",
      serverDir
    ]);
  };

  removeBinDirectories = (serverDir) => {
    for (const directory of this.findBinDirectories(serverDir)) {
      rmSync(directory, { recursive: true, force: true });
    }
  };

  buildFpk = (packageDir) => {
    const packageName = "fnnas.nextclaw.fpk";
    const repoRootPath = resolve(this.repoRoot, packageName);
    const siblingPath = resolve(packageDir, "..", packageName);
    rmSync(repoRootPath, { force: true });
    rmSync(siblingPath, { force: true });
    this.run("fnpack", ["build", "-d", packageDir]);
    const directPath = resolve(packageDir, packageName);
    if (existsSync(directPath)) {
      return directPath;
    }
    if (existsSync(repoRootPath)) {
      rmSync(siblingPath, { force: true });
      renameSync(repoRootPath, siblingPath);
      return siblingPath;
    }
    if (existsSync(siblingPath)) {
      return siblingPath;
    }
    const candidates = readdirSync(packageDir).filter((entry) => entry.endsWith(".fpk"));
    if (candidates.length > 0) {
      return join(packageDir, candidates[0]);
    }
    throw new Error(`fnpack finished without producing ${packageName}`);
  };

  resolvePlatform = (arch) => {
    if (arch === "x86_64") {
      return "x86";
    }
    if (arch === "aarch64") {
      return "arm";
    }
    throw new Error(`Unsupported arch "${arch}" for platform mapping`);
  };

  countSymlinks = (directoryPath) => {
    const result = spawnSync("find", [directoryPath, "-type", "l"], {
      cwd: this.repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
      env: process.env
    });
    if (result.status !== 0) {
      throw new Error(`Failed to count symlinks in ${directoryPath}`);
    }
    return String(result.stdout ?? "")
      .split("\n")
      .filter(Boolean).length;
  };

  findBinDirectories = (directoryPath) => {
    const result = spawnSync("find", [directoryPath, "-type", "d", "-name", ".bin"], {
      cwd: this.repoRoot,
      stdio: ["ignore", "pipe", "ignore"],
      env: process.env
    });
    if (result.status !== 0) {
      throw new Error(`Failed to find .bin directories in ${directoryPath}`);
    }
    return String(result.stdout ?? "")
      .split("\n")
      .filter(Boolean);
  };

  printSummary = (result) => {
    console.log("[fnos-package] build complete");
    console.log(`- version: ${result.version}`);
    console.log(`- arch: ${result.arch}`);
    console.log(`- service port: ${result.servicePort}`);
    console.log(`- package dir: ${result.packageDir}`);
    if (result.fpkPath) {
      console.log(`- fpk: ${result.fpkPath}`);
    }
  };

  run = (command, args) => {
    console.log(`[fnos-package] run: ${command} ${args.join(" ")}`);
    const result = spawnSync(command, args, {
      cwd: this.repoRoot,
      stdio: "inherit",
      env: process.env
    });
    if (result.status !== 0) {
      throw new Error(`Command failed: ${command} ${args.join(" ")}`);
    }
  };

  findExecutable = (binary) => {
    const pathEntries = String(process.env.PATH ?? "").split(":").filter(Boolean);
    return pathEntries.some((entry) => existsSync(resolve(entry, binary)));
  };
}

new NextclawFnosPackageBuilder().build(process.argv.slice(2));
