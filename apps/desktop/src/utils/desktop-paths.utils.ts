import { app } from "electron";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const DEFAULT_NEXTCLAW_HOME_DIR = ".nextclaw";
const LEGACY_RUNTIME_HOME_ENV = "NEXTCLAW_HOME";
const LEGACY_DESKTOP_DATA_ENV = "NEXTCLAW_DESKTOP_DATA_DIR";
const PACKAGED_RUNTIME_HOME_OVERRIDE_ENV = "NEXTCLAW_DESKTOP_RUNTIME_HOME_OVERRIDE";
const PACKAGED_DESKTOP_DATA_OVERRIDE_ENV = "NEXTCLAW_DESKTOP_DATA_DIR_OVERRIDE";
const PACKAGED_RELEASE_METADATA_FILE_NAME = "update-release-metadata.json";

type PackagedDesktopPathOverrides = {
  runtimeHomeOverride: string | null;
  desktopDataDirOverride: string | null;
};

function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? resolve(value) : null;
}

function readOptionalPackagedPath(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith("~/")) {
    return resolve(homedir(), trimmed.slice(2));
  }
  return resolve(trimmed);
}

function readPackagedDesktopPathOverrides(): PackagedDesktopPathOverrides {
  if (!app.isPackaged) {
    return {
      runtimeHomeOverride: null,
      desktopDataDirOverride: null
    };
  }

  const metadataPath = join(process.resourcesPath, "update", PACKAGED_RELEASE_METADATA_FILE_NAME);
  if (!existsSync(metadataPath)) {
    return {
      runtimeHomeOverride: null,
      desktopDataDirOverride: null
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, unknown>;
    return {
      runtimeHomeOverride: readOptionalPackagedPath(parsed.runtimeHomeOverride),
      desktopDataDirOverride: readOptionalPackagedPath(parsed.desktopDataDirOverride)
    };
  } catch {
    return {
      runtimeHomeOverride: null,
      desktopDataDirOverride: null
    };
  }
}

export function resolveDesktopRuntimeHome(): string {
  const packagedOverride = readOptionalEnv(PACKAGED_RUNTIME_HOME_OVERRIDE_ENV);
  if (packagedOverride) {
    return packagedOverride;
  }

  const packagedMetadataOverride = readPackagedDesktopPathOverrides().runtimeHomeOverride;
  if (packagedMetadataOverride) {
    return packagedMetadataOverride;
  }

  if (!app.isPackaged) {
    const legacyRuntimeHome = readOptionalEnv(LEGACY_RUNTIME_HOME_ENV);
    if (legacyRuntimeHome) {
      return legacyRuntimeHome;
    }
  }

  return resolve(homedir(), DEFAULT_NEXTCLAW_HOME_DIR);
}

export function resolveDesktopDataDir(explicitBaseDir?: string): string {
  if (explicitBaseDir?.trim()) {
    return resolve(explicitBaseDir);
  }

  const packagedOverride = readOptionalEnv(PACKAGED_DESKTOP_DATA_OVERRIDE_ENV);
  if (packagedOverride) {
    return packagedOverride;
  }

  const packagedMetadataOverride = readPackagedDesktopPathOverrides().desktopDataDirOverride;
  if (packagedMetadataOverride) {
    return packagedMetadataOverride;
  }

  if (!app.isPackaged) {
    const legacyDesktopDataDir = readOptionalEnv(LEGACY_DESKTOP_DATA_ENV);
    if (legacyDesktopDataDir) {
      return legacyDesktopDataDir;
    }
  }

  return resolve(app.getPath("userData"));
}

export function createDesktopRuntimeEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const runtimeEnv = { ...baseEnv };
  delete runtimeEnv[LEGACY_RUNTIME_HOME_ENV];
  delete runtimeEnv[LEGACY_DESKTOP_DATA_ENV];
  runtimeEnv.ELECTRON_RUN_AS_NODE = "1";
  runtimeEnv[LEGACY_RUNTIME_HOME_ENV] = resolveDesktopRuntimeHome();
  return runtimeEnv;
}
