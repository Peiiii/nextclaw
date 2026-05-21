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

function readOptionalEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? resolve(value) : null;
}

export function resolveDesktopRuntimeHome(): string {
  const packagedOverride = readOptionalEnv(PACKAGED_RUNTIME_HOME_OVERRIDE_ENV);
  if (packagedOverride) {
    return packagedOverride;
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
  runtimeEnv.NEXTCLAW_DISABLE_BUILTIN_EXTENSIONS = "1";
  runtimeEnv[LEGACY_RUNTIME_HOME_ENV] = resolveDesktopRuntimeHome();
  return runtimeEnv;
}
