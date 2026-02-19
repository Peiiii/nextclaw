import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import JSZip from "jszip";
import * as tar from "tar";
import { getDataPath } from "@nextclaw/core";
import { loadPluginManifest } from "./manifest.js";

export type PluginInstallLogger = {
  info?: (message: string) => void;
  warn?: (message: string) => void;
};

type PackageManifest = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  openclaw?: {
    extensions?: string[];
  };
};

export type InstallPluginResult =
  | {
      ok: true;
      pluginId: string;
      targetDir: string;
      manifestName?: string;
      version?: string;
      extensions: string[];
    }
  | { ok: false; error: string };

const defaultLogger: PluginInstallLogger = {};

function resolveUserPath(input: string): string {
  if (input.startsWith("~/")) {
    return path.resolve(os.homedir(), input.slice(2));
  }
  return path.resolve(input);
}

function safeDirName(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-/, "")
    .replace(/-$/, "")
    .trim();
}

function validatePluginId(pluginId: string): string | null {
  if (!pluginId) {
    return "invalid plugin name: missing";
  }
  if (pluginId === "." || pluginId === "..") {
    return "invalid plugin name: reserved path segment";
  }
  if (pluginId.includes("/") || pluginId.includes("\\")) {
    return "invalid plugin name: path separators not allowed";
  }
  return null;
}

function resolveExtensionsDir(extensionsDir?: string): string {
  return extensionsDir ? resolveUserPath(extensionsDir) : path.join(getDataPath(), "extensions");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function resolveArchiveKind(filePath: string): "zip" | "tgz" | "tar" | null {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".zip")) {
    return "zip";
  }
  if (lower.endsWith(".tgz") || lower.endsWith(".tar.gz")) {
    return "tgz";
  }
  if (lower.endsWith(".tar")) {
    return "tar";
  }
  return null;
}

async function extractArchive(params: {
  archivePath: string;
  destDir: string;
  kind: "zip" | "tgz" | "tar";
}): Promise<void> {
  if (params.kind === "zip") {
    const raw = await fs.readFile(params.archivePath);
    const zip = await JSZip.loadAsync(raw);
    await Promise.all(
      Object.values(zip.files).map(async (entry) => {
        const fullPath = path.resolve(params.destDir, entry.name);
        if (!fullPath.startsWith(path.resolve(params.destDir) + path.sep) && fullPath !== path.resolve(params.destDir)) {
          throw new Error(`zip entry escapes destination: ${entry.name}`);
        }
        if (entry.dir) {
          await fs.mkdir(fullPath, { recursive: true });
          return;
        }
        const parent = path.dirname(fullPath);
        await fs.mkdir(parent, { recursive: true });
        const content = await entry.async("nodebuffer");
        await fs.writeFile(fullPath, content);
      })
    );
    return;
  }

  await tar.x({
    file: params.archivePath,
    cwd: params.destDir,
    strict: true,
    preservePaths: false
  });
}

async function resolvePackedRootDir(extractDir: string): Promise<string> {
  const packageDir = path.join(extractDir, "package");
  if (await exists(path.join(packageDir, "package.json"))) {
    return packageDir;
  }

  if (await exists(path.join(extractDir, "package.json"))) {
    return extractDir;
  }

  const entries = await fs.readdir(extractDir, { withFileTypes: true });
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(extractDir, entry.name));

  if (dirs.length === 1 && (await exists(path.join(dirs[0], "package.json")))) {
    return dirs[0];
  }

  for (const dir of dirs) {
    if (await exists(path.join(dir, "package.json"))) {
      return dir;
    }
  }

  throw new Error("archive missing package root");
}

async function ensureOpenClawExtensions(manifest: PackageManifest): Promise<string[]> {
  const extensions = manifest.openclaw?.extensions;
  if (!Array.isArray(extensions)) {
    throw new Error("package.json missing openclaw.extensions");
  }
  const list = extensions.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean);
  if (list.length === 0) {
    throw new Error("package.json openclaw.extensions is empty");
  }
  return list;
}

async function runCommand(command: string, args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
        NPM_CONFIG_IGNORE_SCRIPTS: "true"
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });

    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: `${stderr}\n${String(error)}` });
    });
  });
}

async function installDependenciesIfNeeded(packageDir: string, manifest: PackageManifest, logger: PluginInstallLogger): Promise<void> {
  if (!manifest.dependencies || Object.keys(manifest.dependencies).length === 0) {
    return;
  }
  logger.info?.("Installing plugin dependencies...");
  const result = await runCommand("npm", ["install", "--ignore-scripts"], packageDir);
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "npm install failed");
  }
}

export function resolvePluginInstallDir(pluginId: string, extensionsDir?: string): string {
  const err = validatePluginId(pluginId);
  if (err) {
    throw new Error(err);
  }

  const baseDir = resolveExtensionsDir(extensionsDir);
  const target = path.resolve(baseDir, pluginId);
  if (!target.startsWith(path.resolve(baseDir) + path.sep) && target !== path.resolve(baseDir)) {
    throw new Error("invalid plugin name: path traversal detected");
  }
  return target;
}

async function installPluginFromPackageDir(params: {
  packageDir: string;
  extensionsDir?: string;
  logger?: PluginInstallLogger;
  mode?: "install" | "update";
  dryRun?: boolean;
  expectedPluginId?: string;
}): Promise<InstallPluginResult> {
  const logger = params.logger ?? defaultLogger;
  const packageDir = resolveUserPath(params.packageDir);
  const mode = params.mode ?? "install";
  const dryRun = params.dryRun ?? false;

  const packageJsonPath = path.join(packageDir, "package.json");
  if (!(await exists(packageJsonPath))) {
    return { ok: false, error: "plugin package missing package.json" };
  }

  let packageManifest: PackageManifest;
  try {
    packageManifest = await readJsonFile<PackageManifest>(packageJsonPath);
  } catch (err) {
    return { ok: false, error: `invalid package.json: ${String(err)}` };
  }

  let extensions: string[];
  try {
    extensions = await ensureOpenClawExtensions(packageManifest);
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  const manifestRes = loadPluginManifest(packageDir);
  if (!manifestRes.ok) {
    return { ok: false, error: manifestRes.error };
  }

  const pluginId = manifestRes.manifest.id;
  const pluginErr = validatePluginId(pluginId);
  if (pluginErr) {
    return { ok: false, error: pluginErr };
  }
  if (params.expectedPluginId && params.expectedPluginId !== pluginId) {
    return {
      ok: false,
      error: `plugin id mismatch: expected ${params.expectedPluginId}, got ${pluginId}`
    };
  }

  const targetDir = resolvePluginInstallDir(pluginId, params.extensionsDir);
  if (mode === "install" && (await exists(targetDir))) {
    return { ok: false, error: `plugin already exists: ${targetDir} (delete it first)` };
  }

  if (dryRun) {
    return {
      ok: true,
      pluginId,
      targetDir,
      manifestName: packageManifest.name,
      version: packageManifest.version,
      extensions
    };
  }

  await fs.mkdir(path.dirname(targetDir), { recursive: true });
  if (mode === "update" && (await exists(targetDir))) {
    await fs.rm(targetDir, { recursive: true, force: true });
  }

  logger.info?.(`Installing to ${targetDir}...`);
  await fs.cp(packageDir, targetDir, { recursive: true, force: true });

  try {
    for (const extensionPath of extensions) {
      const resolved = path.resolve(targetDir, extensionPath);
      if (!resolved.startsWith(path.resolve(targetDir) + path.sep) && resolved !== path.resolve(targetDir)) {
        throw new Error(`extension entry escapes plugin directory: ${extensionPath}`);
      }
      if (!(await exists(resolved))) {
        throw new Error(`extension entry not found after install: ${extensionPath}`);
      }
    }

    await installDependenciesIfNeeded(targetDir, packageManifest, logger);
  } catch (err) {
    await fs.rm(targetDir, { recursive: true, force: true }).catch(() => undefined);
    return {
      ok: false,
      error: err instanceof Error ? err.message : `failed to install dependencies: ${String(err)}`
    };
  }

  return {
    ok: true,
    pluginId,
    targetDir,
    manifestName: packageManifest.name,
    version: packageManifest.version,
    extensions
  };
}

export async function installPluginFromArchive(params: {
  archivePath: string;
  extensionsDir?: string;
  logger?: PluginInstallLogger;
  mode?: "install" | "update";
  dryRun?: boolean;
  expectedPluginId?: string;
}): Promise<InstallPluginResult> {
  const logger = params.logger ?? defaultLogger;
  const archivePath = resolveUserPath(params.archivePath);
  if (!(await exists(archivePath))) {
    return { ok: false, error: `archive not found: ${archivePath}` };
  }

  const kind = resolveArchiveKind(archivePath);
  if (!kind) {
    return { ok: false, error: `unsupported archive: ${archivePath}` };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextclaw-plugin-"));
  try {
    const extractDir = path.join(tempDir, "extract");
    await fs.mkdir(extractDir, { recursive: true });

    logger.info?.(`Extracting ${archivePath}...`);
    try {
      await extractArchive({ archivePath, destDir: extractDir, kind });
    } catch (err) {
      return { ok: false, error: `failed to extract archive: ${String(err)}` };
    }

    let packageDir = "";
    try {
      packageDir = await resolvePackedRootDir(extractDir);
    } catch (err) {
      return { ok: false, error: String(err) };
    }

    return await installPluginFromPackageDir({
      packageDir,
      extensionsDir: params.extensionsDir,
      logger,
      mode: params.mode,
      dryRun: params.dryRun,
      expectedPluginId: params.expectedPluginId
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function installPluginFromDir(params: {
  dirPath: string;
  extensionsDir?: string;
  logger?: PluginInstallLogger;
  mode?: "install" | "update";
  dryRun?: boolean;
  expectedPluginId?: string;
}): Promise<InstallPluginResult> {
  const dirPath = resolveUserPath(params.dirPath);
  if (!(await exists(dirPath))) {
    return { ok: false, error: `directory not found: ${dirPath}` };
  }
  const stat = await fs.stat(dirPath);
  if (!stat.isDirectory()) {
    return { ok: false, error: `not a directory: ${dirPath}` };
  }

  return installPluginFromPackageDir({
    packageDir: dirPath,
    extensionsDir: params.extensionsDir,
    logger: params.logger,
    mode: params.mode,
    dryRun: params.dryRun,
    expectedPluginId: params.expectedPluginId
  });
}

export async function installPluginFromFile(params: {
  filePath: string;
  extensionsDir?: string;
  logger?: PluginInstallLogger;
  mode?: "install" | "update";
  dryRun?: boolean;
}): Promise<InstallPluginResult> {
  const filePath = resolveUserPath(params.filePath);
  const logger = params.logger ?? defaultLogger;
  const mode = params.mode ?? "install";
  const dryRun = params.dryRun ?? false;

  if (!(await exists(filePath))) {
    return { ok: false, error: `file not found: ${filePath}` };
  }

  const stat = await fs.stat(filePath);
  if (!stat.isFile()) {
    return { ok: false, error: `not a file: ${filePath}` };
  }

  const ext = path.extname(filePath);
  const pluginId = safeDirName(path.basename(filePath, ext) || "plugin");
  const pluginErr = validatePluginId(pluginId);
  if (pluginErr) {
    return { ok: false, error: pluginErr };
  }

  const targetDir = resolveExtensionsDir(params.extensionsDir);
  const targetFile = path.join(targetDir, `${pluginId}${ext}`);
  if (mode === "install" && (await exists(targetFile))) {
    return { ok: false, error: `plugin already exists: ${targetFile} (delete it first)` };
  }

  if (dryRun) {
    return {
      ok: true,
      pluginId,
      targetDir: targetFile,
      extensions: [path.basename(targetFile)]
    };
  }

  await fs.mkdir(targetDir, { recursive: true });
  logger.info?.(`Installing to ${targetFile}...`);
  await fs.copyFile(filePath, targetFile);

  return {
    ok: true,
    pluginId,
    targetDir: targetFile,
    extensions: [path.basename(targetFile)]
  };
}

function validateRegistryNpmSpec(spec: string): string | null {
  const trimmed = spec.trim();
  if (!trimmed) {
    return "npm spec is required";
  }
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("git+") ||
    lower.startsWith("github:") ||
    lower.startsWith("file:")
  ) {
    return "only registry npm specs are supported";
  }
  if (trimmed.includes("/") && !trimmed.startsWith("@")) {
    return "only registry npm specs are supported";
  }
  return null;
}

export async function installPluginFromNpmSpec(params: {
  spec: string;
  extensionsDir?: string;
  logger?: PluginInstallLogger;
  mode?: "install" | "update";
  dryRun?: boolean;
  expectedPluginId?: string;
}): Promise<InstallPluginResult> {
  const logger = params.logger ?? defaultLogger;
  const spec = params.spec.trim();
  const specError = validateRegistryNpmSpec(spec);
  if (specError) {
    return { ok: false, error: specError };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "nextclaw-npm-pack-"));
  try {
    logger.info?.(`Downloading ${spec}...`);
    const packed = await runCommand("npm", ["pack", spec, "--ignore-scripts"], tempDir);
    if (packed.code !== 0) {
      return {
        ok: false,
        error: `npm pack failed: ${packed.stderr.trim() || packed.stdout.trim()}`
      };
    }

    const archiveName = packed.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .pop();
    if (!archiveName) {
      return { ok: false, error: "npm pack produced no archive" };
    }

    const archivePath = path.join(tempDir, archiveName);
    return await installPluginFromArchive({
      archivePath,
      extensionsDir: params.extensionsDir,
      logger,
      mode: params.mode,
      dryRun: params.dryRun,
      expectedPluginId: params.expectedPluginId
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function installPluginFromPath(params: {
  path: string;
  extensionsDir?: string;
  logger?: PluginInstallLogger;
  mode?: "install" | "update";
  dryRun?: boolean;
  expectedPluginId?: string;
}): Promise<InstallPluginResult> {
  const resolvedPath = resolveUserPath(params.path);
  if (!(await exists(resolvedPath))) {
    return { ok: false, error: `path not found: ${resolvedPath}` };
  }

  const stat = await fs.stat(resolvedPath);
  if (stat.isDirectory()) {
    return installPluginFromDir({
      dirPath: resolvedPath,
      extensionsDir: params.extensionsDir,
      logger: params.logger,
      mode: params.mode,
      dryRun: params.dryRun,
      expectedPluginId: params.expectedPluginId
    });
  }

  const archiveKind = resolveArchiveKind(resolvedPath);
  if (archiveKind) {
    return installPluginFromArchive({
      archivePath: resolvedPath,
      extensionsDir: params.extensionsDir,
      logger: params.logger,
      mode: params.mode,
      dryRun: params.dryRun,
      expectedPluginId: params.expectedPluginId
    });
  }

  return installPluginFromFile({
    filePath: resolvedPath,
    extensionsDir: params.extensionsDir,
    logger: params.logger,
    mode: params.mode,
    dryRun: params.dryRun
  });
}
