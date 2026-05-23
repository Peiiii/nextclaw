import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { DesktopCommandSurfaceManifest } from "../services/desktop-command-surface.service";
import { NEXTCLAW_COMMAND_SURFACE_BIN_ENV } from "../services/desktop-command-surface.service";

type DesktopCommandBridgeArgs = {
  manifestPath: string;
  runtimeArgs: string[];
};

type DesktopCommandBridgeOptions = {
  argv: string[];
  env?: NodeJS.ProcessEnv;
  readTextFile?: (path: string) => string;
  fileExists?: (path: string) => boolean;
  spawnCommand?: (
    command: string,
    args: string[],
    options: { stdio: "inherit"; env: NodeJS.ProcessEnv; windowsHide: boolean }
  ) => Pick<SpawnSyncReturns<Buffer>, "status" | "signal" | "error">;
  exit?: (code: number) => never;
  stderr?: Pick<NodeJS.WriteStream, "write">;
};

function parseBridgeArgs(argv: string[]): DesktopCommandBridgeArgs {
  const manifestFlagIndex = argv.indexOf("--manifest");
  if (manifestFlagIndex < 0) {
    throw new Error("Missing --manifest for desktop command bridge.");
  }
  const manifestPath = argv[manifestFlagIndex + 1]?.trim();
  if (!manifestPath) {
    throw new Error("--manifest requires a path value.");
  }
  const separatorIndex = argv.indexOf("--", manifestFlagIndex + 2);
  const runtimeArgs = separatorIndex >= 0 ? argv.slice(separatorIndex + 1) : argv.slice(manifestFlagIndex + 2);
  return {
    manifestPath: resolve(manifestPath),
    runtimeArgs
  };
}

function readJsonObject(path: string, readTextFile: (path: string) => string): Record<string, unknown> {
  const parsed = JSON.parse(readTextFile(path)) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Desktop command surface manifest must be an object: ${path}`);
  }
  return parsed as Record<string, unknown>;
}

function readRequiredString(parsed: Record<string, unknown>, key: keyof DesktopCommandSurfaceManifest): string {
  const value = parsed[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Desktop command surface manifest is missing ${String(key)}.`);
  }
  return value.trim();
}

function readOptionalString(parsed: Record<string, unknown>, key: keyof DesktopCommandSurfaceManifest): string | null {
  const value = parsed[key];
  if (value === null || typeof value === "undefined") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(`Desktop command surface manifest field ${String(key)} must be a string or null.`);
  }
  return value.trim() || null;
}

function readManifest(path: string, readTextFile: (path: string) => string): DesktopCommandSurfaceManifest {
  const parsed = readJsonObject(path, readTextFile);
  if (parsed.schemaVersion !== 1) {
    throw new Error(`Unsupported desktop command surface schemaVersion: ${String(parsed.schemaVersion)}`);
  }
  return {
    schemaVersion: 1,
    installationKind: readRequiredString(parsed, "installationKind") as DesktopCommandSurfaceManifest["installationKind"],
    desktopDataDir: readRequiredString(parsed, "desktopDataDir"),
    runtimeHome: readRequiredString(parsed, "runtimeHome"),
    appExecutablePath: readRequiredString(parsed, "appExecutablePath"),
    commandBridgeScriptPath: readRequiredString(parsed, "commandBridgeScriptPath"),
    commandSurfaceBinDir: readRequiredString(parsed, "commandSurfaceBinDir"),
    packagedRuntimeScriptPath: readOptionalString(parsed, "packagedRuntimeScriptPath"),
    launcherVersion: readRequiredString(parsed, "launcherVersion")
  };
}

function readCurrentBundleVersion(
  desktopDataDir: string,
  readTextFile: (path: string) => string,
  fileExists: (path: string) => boolean
): string | null {
  const currentPointerPath = join(desktopDataDir, "current.json");
  if (!fileExists(currentPointerPath)) {
    return null;
  }
  const parsed = readJsonObject(currentPointerPath, readTextFile);
  const version = typeof parsed.version === "string" ? parsed.version.trim() : "";
  return version || null;
}

function resolveRuntimeScriptFromBundle(
  desktopDataDir: string,
  version: string,
  readTextFile: (path: string) => string,
  fileExists: (path: string) => boolean
): string {
  const versionDir = join(desktopDataDir, "versions", version);
  const manifestPath = join(versionDir, "manifest.json");
  if (!fileExists(manifestPath)) {
    throw new Error(`Current desktop bundle manifest is missing: ${manifestPath}`);
  }
  const parsed = readJsonObject(manifestPath, readTextFile);
  const entrypoints = parsed.entrypoints;
  if (!entrypoints || typeof entrypoints !== "object" || Array.isArray(entrypoints)) {
    throw new Error(`Current desktop bundle manifest is missing entrypoints: ${manifestPath}`);
  }
  const runtimeScript = (entrypoints as Record<string, unknown>).runtimeScript;
  if (typeof runtimeScript !== "string" || !runtimeScript.trim()) {
    throw new Error(`Current desktop bundle manifest is missing entrypoints.runtimeScript: ${manifestPath}`);
  }
  const runtimeScriptPath = join(versionDir, runtimeScript);
  if (!fileExists(runtimeScriptPath)) {
    throw new Error(`Current desktop bundle runtime script is missing: ${runtimeScriptPath}`);
  }
  return runtimeScriptPath;
}

function resolveRuntimeScript(
  manifest: DesktopCommandSurfaceManifest,
  readTextFile: (path: string) => string,
  fileExists: (path: string) => boolean
): string {
  const currentVersion = readCurrentBundleVersion(manifest.desktopDataDir, readTextFile, fileExists);
  if (currentVersion) {
    return resolveRuntimeScriptFromBundle(manifest.desktopDataDir, currentVersion, readTextFile, fileExists);
  }
  if (manifest.packagedRuntimeScriptPath && fileExists(manifest.packagedRuntimeScriptPath)) {
    return manifest.packagedRuntimeScriptPath;
  }
  throw new Error("No current desktop bundle or packaged runtime script is available.");
}

function createRuntimeEnv(manifest: DesktopCommandSurfaceManifest, baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    ELECTRON_RUN_AS_NODE: "1",
    NEXTCLAW_HOME: manifest.runtimeHome,
    NEXTCLAW_DESKTOP_COMMAND_SURFACE: "1",
    [NEXTCLAW_COMMAND_SURFACE_BIN_ENV]: manifest.commandSurfaceBinDir
  };
  delete env.NEXTCLAW_RUNTIME_BUNDLE_CHILD;
  delete env.NEXTCLAW_DISABLE_RUNTIME_BUNDLE_LAUNCHER;
  return env;
}

export function runDesktopCommandBridge(options: DesktopCommandBridgeOptions): number {
  const { argv, env: baseEnv, fileExists: fileExistsOption, readTextFile: readTextFileOption, spawnCommand: spawnCommandOption } = options;
  const readTextFile = readTextFileOption ?? ((path: string) => readFileSync(path, "utf8"));
  const fileExists = fileExistsOption ?? existsSync;
  const spawnCommand = spawnCommandOption ?? spawnSync;
  const parsedArgs = parseBridgeArgs(argv);
  const manifest = readManifest(parsedArgs.manifestPath, readTextFile);
  if (!fileExists(manifest.appExecutablePath)) {
    throw new Error(`Desktop app executable is missing: ${manifest.appExecutablePath}`);
  }
  const runtimeScriptPath = resolveRuntimeScript(manifest, readTextFile, fileExists);
  const result = spawnCommand(manifest.appExecutablePath, [runtimeScriptPath, ...parsedArgs.runtimeArgs], {
    stdio: "inherit",
    env: createRuntimeEnv(manifest, baseEnv ?? process.env),
    windowsHide: true
  });
  if (result.error) {
    throw result.error;
  }
  if (typeof result.status === "number") {
    return result.status;
  }
  return result.signal ? 1 : 0;
}

function main(): void {
  const exit = (code: number): never => process.exit(code);
  try {
    exit(runDesktopCommandBridge({ argv: process.argv.slice(2) }));
  } catch (error) {
    process.stderr.write(
      [
        "NextClaw desktop command surface is unavailable.",
        `reason: ${error instanceof Error ? error.message : String(error)}`,
        "recovery: open NextClaw Desktop once, or run the desktop package repair/update path.",
        ""
      ].join("\n")
    );
    exit(1);
  }
}

if (require.main === module) {
  main();
}
