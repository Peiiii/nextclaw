import type { App } from "electron";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  PACKAGED_DESKTOP_DATA_OVERRIDE_ENV,
  PACKAGED_RUNTIME_HOME_OVERRIDE_ENV
} from "./desktop-path-env.utils";

export type DesktopInstallationKind = "installed" | "portable";

export type DesktopUpdateCapability = {
  supported: boolean;
  blockReason: "unsupported-installation" | null;
  message: string | null;
};

export type DesktopInstallationProfile = {
  installationKind: DesktopInstallationKind;
  profileId: string;
  portableRoot: string | null;
  desktopDataDir: string;
  desktopUserDataDir: string;
  runtimeHome: string;
  logsDir: string;
  instanceScopeId: string;
  updateCapability: DesktopUpdateCapability;
  runtimeEnvPatch: Record<string, string>;
};

export type DesktopInstallationProfileInput = {
  execPath: string;
  argv: string[];
  env: NodeJS.ProcessEnv;
  defaultDesktopDataDir: string;
  defaultUserDataDir: string;
  defaultLogsDir: string;
  defaultRuntimeHome: string;
  fileExists?: (path: string) => boolean;
  readTextFile?: (path: string) => string;
};

export const DESKTOP_PORTABLE_MARKER_FILE = "nextclaw-portable.json";
export const DESKTOP_PORTABLE_MARKER_KIND = "nextclaw-portable";
export const DESKTOP_PORTABLE_MARKER_VERSION = 1;

const PORTABLE_UPDATE_MESSAGE =
  "Portable Edition does not support in-app updates yet. Download a newer Portable Edition and keep the data directory.";

function normalizeOptionalPath(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? resolve(trimmed) : null;
}

function readPortableRootFromArgv(argv: string[]): string | null {
  const portableRootFlagIndex = argv.findIndex((entry) => entry === "--portable-root");
  if (portableRootFlagIndex < 0) {
    return null;
  }
  const value = argv[portableRootFlagIndex + 1]?.trim();
  if (!value) {
    throw new Error("--portable-root requires a path value.");
  }
  return resolve(value);
}

function createProfileId(kind: DesktopInstallationKind, root: string | null): string {
  if (kind === "installed") {
    return "installed";
  }
  const digest = createHash("sha256").update(root ?? "").digest("hex").slice(0, 16);
  return `portable-${digest}`;
}

function assertPortableMarker(markerPath: string, readTextFile: (path: string) => string): void {
  const parsed = JSON.parse(readTextFile(markerPath)) as Record<string, unknown>;
  if (parsed.kind !== DESKTOP_PORTABLE_MARKER_KIND || parsed.version !== DESKTOP_PORTABLE_MARKER_VERSION) {
    throw new Error(`Invalid NextClaw portable marker: ${markerPath}`);
  }
}

function resolvePortableRoot(input: DesktopInstallationProfileInput): string | null {
  const argvPortableRoot = readPortableRootFromArgv(input.argv);
  if (argvPortableRoot) {
    return argvPortableRoot;
  }

  const fileExists = input.fileExists ?? existsSync;
  const readTextFile = input.readTextFile ?? ((path: string) => readFileSync(path, "utf8"));
  const executableDir = dirname(resolve(input.execPath));
  const markerPath = join(executableDir, DESKTOP_PORTABLE_MARKER_FILE);
  if (!fileExists(markerPath)) {
    return null;
  }
  assertPortableMarker(markerPath, readTextFile);
  return executableDir;
}

function createUpdateCapability(kind: DesktopInstallationKind): DesktopUpdateCapability {
  if (kind === "portable") {
    return {
      supported: false,
      blockReason: "unsupported-installation",
      message: PORTABLE_UPDATE_MESSAGE
    };
  }
  return {
    supported: true,
    blockReason: null,
    message: null
  };
}

export function resolveDesktopInstallationProfile(input: DesktopInstallationProfileInput): DesktopInstallationProfile {
  const portableRoot = resolvePortableRoot(input);
  if (portableRoot) {
    const desktopDataDir = join(portableRoot, "data", "desktop");
    const runtimeHome = join(portableRoot, "data", "runtime-home");
    const profileId = createProfileId("portable", portableRoot);
    return {
      installationKind: "portable",
      profileId,
      portableRoot,
      desktopDataDir,
      desktopUserDataDir: join(desktopDataDir, "userData"),
      runtimeHome,
      logsDir: join(portableRoot, "data", "logs"),
      instanceScopeId: profileId,
      updateCapability: createUpdateCapability("portable"),
      runtimeEnvPatch: {
        [PACKAGED_DESKTOP_DATA_OVERRIDE_ENV]: desktopDataDir,
        [PACKAGED_RUNTIME_HOME_OVERRIDE_ENV]: runtimeHome
      }
    };
  }

  const desktopDataDir = normalizeOptionalPath(input.env[PACKAGED_DESKTOP_DATA_OVERRIDE_ENV]) ?? input.defaultDesktopDataDir;
  const runtimeHome = normalizeOptionalPath(input.env[PACKAGED_RUNTIME_HOME_OVERRIDE_ENV]) ?? input.defaultRuntimeHome;
  return {
    installationKind: "installed",
    profileId: "installed",
    portableRoot: null,
    desktopDataDir,
    desktopUserDataDir: input.defaultUserDataDir,
    runtimeHome,
    logsDir: input.defaultLogsDir,
    instanceScopeId: "installed",
    updateCapability: createUpdateCapability("installed"),
    runtimeEnvPatch: {}
  };
}

export function applyDesktopInstallationProfile(
  app: Pick<App, "setPath">,
  profile: DesktopInstallationProfile
): void {
  if (profile.installationKind === "portable") {
    app.setPath("userData", profile.desktopUserDataDir);
    app.setPath("logs", profile.logsDir);
  }
}
