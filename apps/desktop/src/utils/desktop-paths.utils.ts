import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { app } from "electron";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  PACKAGED_DESKTOP_DATA_OVERRIDE_ENV,
  PACKAGED_RUNTIME_HOME_OVERRIDE_ENV
} from "./desktop-path-env.utils";

export {
  PACKAGED_DESKTOP_DATA_OVERRIDE_ENV,
  PACKAGED_RUNTIME_HOME_OVERRIDE_ENV
} from "./desktop-path-env.utils";

const DEFAULT_NEXTCLAW_HOME_DIR = ".nextclaw";
const LEGACY_RUNTIME_HOME_ENV = "NEXTCLAW_HOME";
const LEGACY_DESKTOP_DATA_ENV = "NEXTCLAW_DESKTOP_DATA_DIR";
const PACKAGED_EXTENSION_DIR_ENV = "NEXTCLAW_PACKAGED_EXTENSION_DIR";

type DesktopRuntimeEnvOptions = {
  packagedExtensionDir?: string | null;
};

function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? resolve(value) : null;
}

export function resolveDesktopRuntimeHome(): string {
  return resolveDesktopRuntimeHomeFromEnv(process.env);
}

function resolveDesktopRuntimeHomeFromEnv(env: NodeJS.ProcessEnv): string {
  const packagedOverride = normalizeOptionalPath(env[PACKAGED_RUNTIME_HOME_OVERRIDE_ENV]);
  if (packagedOverride) {
    return packagedOverride;
  }

  if (!app?.isPackaged) {
    const legacyRuntimeHome = normalizeOptionalPath(env[LEGACY_RUNTIME_HOME_ENV]);
    if (legacyRuntimeHome) {
      return legacyRuntimeHome;
    }
  }

  return resolve(homedir(), DEFAULT_NEXTCLAW_HOME_DIR);
}

function normalizeOptionalPath(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? resolve(trimmed) : null;
}

export function resolveDesktopDataDir(explicitBaseDir?: string): string {
  if (explicitBaseDir?.trim()) {
    return resolve(explicitBaseDir);
  }

  const packagedOverride = readOptionalEnv(PACKAGED_DESKTOP_DATA_OVERRIDE_ENV);
  if (packagedOverride) {
    return packagedOverride;
  }

  if (!app.isPackaged) {
    const legacyDesktopDataDir = readOptionalEnv(LEGACY_DESKTOP_DATA_ENV);
    if (legacyDesktopDataDir) {
      return legacyDesktopDataDir;
    }
  }

  return resolve(app.getPath("userData"));
}

export function createDesktopRuntimeEnv(
  baseEnv: NodeJS.ProcessEnv = process.env,
  options: DesktopRuntimeEnvOptions = {},
): NodeJS.ProcessEnv {
  const runtimeEnv = { ...baseEnv };
  delete runtimeEnv[LEGACY_RUNTIME_HOME_ENV];
  delete runtimeEnv[LEGACY_DESKTOP_DATA_ENV];
  runtimeEnv.ELECTRON_RUN_AS_NODE = "1";
  runtimeEnv.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS = "1";
  const packagedExtensionDir = normalizeOptionalPath(
    options.packagedExtensionDir !== undefined
      ? options.packagedExtensionDir
      : runtimeEnv[PACKAGED_EXTENSION_DIR_ENV]
  );
  if (packagedExtensionDir) {
    runtimeEnv[PACKAGED_EXTENSION_DIR_ENV] = packagedExtensionDir;
  } else {
    delete runtimeEnv[PACKAGED_EXTENSION_DIR_ENV];
  }
  runtimeEnv[LEGACY_RUNTIME_HOME_ENV] = resolveDesktopRuntimeHomeFromEnv(baseEnv);
  return runtimeEnv;
}

export function resolveDesktopLauncherBuildFingerprint(appPath: string, launcherVersion: string): string {
  if (existsSync(appPath) && statSync(appPath).isFile()) {
    return createHash("sha256").update(readFileSync(appPath)).digest("hex");
  }
  return `${launcherVersion}:${appPath}`;
}
