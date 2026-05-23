import type { Stats } from "node:fs";
import { existsSync } from "node:fs";
import { chmod, mkdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { DesktopInstallationProfile } from "../utils/desktop-installation-profile.utils";

export const NEXTCLAW_COMMAND_SURFACE_BIN_ENV = "NEXTCLAW_COMMAND_SURFACE_BIN";

export type DesktopCommandSurfaceManifest = {
  schemaVersion: 1;
  installationKind: DesktopInstallationProfile["installationKind"];
  desktopDataDir: string;
  runtimeHome: string;
  appExecutablePath: string;
  commandBridgeScriptPath: string;
  commandSurfaceBinDir: string;
  packagedRuntimeScriptPath: string | null;
  launcherVersion: string;
};

export type DesktopCommandSurfaceResult = {
  manifestPath: string;
  binDir: string;
  runtimeEnvPatch: Record<string, string>;
};

type DesktopCommandSurfaceManagerOptions = {
  profile: DesktopInstallationProfile;
  appExecutablePath: string;
  appIsPackaged: boolean;
  appPath: string;
  resourcesPath: string;
  compiledMainDir: string;
  launcherVersion: string;
  fileExists?: (path: string) => boolean;
  writeTextFile?: (path: string, content: string) => Promise<void>;
  renameFile?: (source: string, target: string) => Promise<void>;
  chmodFile?: (path: string, mode: number) => Promise<void>;
  makeDirectory?: (path: string) => Promise<void>;
  statPath?: (path: string) => Promise<Pick<Stats, "isDirectory">>;
};

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function resolveCommandBridgeScriptPath(compiledMainDir: string): string {
  return join(compiledMainDir, "utils", "desktop-command-bridge.utils.js");
}

function createPosixShim(manifest: DesktopCommandSurfaceManifest, manifestPath: string): string {
  return [
    "#!/bin/sh",
    "set -eu",
    `APP_EXECUTABLE=${shellQuote(manifest.appExecutablePath)}`,
    `BRIDGE_SCRIPT=${shellQuote(manifest.commandBridgeScriptPath)}`,
    `SURFACE_MANIFEST=${shellQuote(manifestPath)}`,
    'ELECTRON_RUN_AS_NODE=1 exec "$APP_EXECUTABLE" "$BRIDGE_SCRIPT" --manifest "$SURFACE_MANIFEST" -- "$@"',
    ""
  ].join("\n");
}

function createWindowsShim(manifest: DesktopCommandSurfaceManifest, manifestPath: string): string {
  return [
    "@echo off",
    "setlocal",
    'set "ELECTRON_RUN_AS_NODE=1"',
    `"${manifest.appExecutablePath}" "${manifest.commandBridgeScriptPath}" --manifest "${manifestPath}" -- %*`,
    "exit /b %ERRORLEVEL%",
    ""
  ].join("\r\n");
}

export class DesktopCommandSurfaceManager {
  private readonly fileExists: (path: string) => boolean;
  private readonly writeTextFile: (path: string, content: string) => Promise<void>;
  private readonly renameFile: (source: string, target: string) => Promise<void>;
  private readonly chmodFile: (path: string, mode: number) => Promise<void>;
  private readonly makeDirectory: (path: string) => Promise<void>;
  private readonly statPath: (path: string) => Promise<Pick<Stats, "isDirectory">>;

  constructor(private readonly options: DesktopCommandSurfaceManagerOptions) {
    this.fileExists = options.fileExists ?? existsSync;
    this.writeTextFile = options.writeTextFile ?? ((path, content) => writeFile(path, content, "utf8"));
    this.renameFile = options.renameFile ?? rename;
    this.chmodFile = options.chmodFile ?? chmod;
    this.makeDirectory = options.makeDirectory ?? ((path) => mkdir(path, { recursive: true }).then(() => undefined));
    this.statPath = options.statPath ?? stat;
  }

  ensure = async (): Promise<DesktopCommandSurfaceResult> => {
    const commandSurfaceDir = join(this.options.profile.desktopDataDir, "command-surface");
    const binDir = join(commandSurfaceDir, "bin");
    const manifestPath = join(commandSurfaceDir, "nextclaw-command-surface.json");
    const posixShimPath = join(binDir, "nextclaw");
    const windowsShimPath = join(binDir, "nextclaw.cmd");
    const manifest = this.createManifest(binDir);

    await this.makeDirectory(binDir);
    await this.writeTextAtomically(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await this.writeTextAtomically(posixShimPath, createPosixShim(manifest, manifestPath));
    await this.writeTextAtomically(windowsShimPath, createWindowsShim(manifest, manifestPath));
    await this.chmodFile(posixShimPath, 0o755);
    await this.assertDirectory(binDir);

    return {
      manifestPath,
      binDir,
      runtimeEnvPatch: {
        [NEXTCLAW_COMMAND_SURFACE_BIN_ENV]: binDir
      }
    };
  };

  private createManifest = (binDir: string): DesktopCommandSurfaceManifest => ({
    schemaVersion: 1,
    installationKind: this.options.profile.installationKind,
    desktopDataDir: this.options.profile.desktopDataDir,
    runtimeHome: this.options.profile.runtimeHome,
    appExecutablePath: this.options.appExecutablePath,
    commandBridgeScriptPath: resolveCommandBridgeScriptPath(this.options.compiledMainDir),
    commandSurfaceBinDir: binDir,
    packagedRuntimeScriptPath: this.resolvePackagedRuntimeScriptPath(),
    launcherVersion: this.options.launcherVersion
  });

  private writeTextAtomically = async (path: string, content: string): Promise<void> => {
    const tempPath = `${path}.tmp`;
    await this.makeDirectory(dirname(path));
    await this.writeTextFile(tempPath, content);
    await this.renameFile(tempPath, path);
  };

  private assertDirectory = async (path: string): Promise<void> => {
    const stats = await this.statPath(path);
    if (!stats.isDirectory()) {
      throw new Error(`Desktop command surface bin path is not a directory: ${path}`);
    }
  };

  private resolvePackagedRuntimeScriptPath = (): string | null => {
    const packagedRuntimeScriptPath = this.options.appIsPackaged
      ? join(this.options.resourcesPath, "app.asar", "node_modules", "nextclaw", "dist", "cli", "app", "index.js")
      : resolve(this.options.appPath, "node_modules", "nextclaw", "dist", "cli", "app", "index.js");
    return this.fileExists(packagedRuntimeScriptPath) ? packagedRuntimeScriptPath : null;
  };
}
