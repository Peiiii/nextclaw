import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  DESKTOP_PORTABLE_MARKER_FILE,
  applyDesktopInstallationProfile,
  resolveDesktopInstallationProfile
} from "./desktop-installation-profile.utils";

const DEFAULTS = {
  defaultDesktopDataDir: "/default/desktop-data",
  defaultUserDataDir: "/default/user-data",
  defaultLogsDir: "/default/logs",
  defaultRuntimeHome: "/default/runtime-home"
};

test("resolves an installed desktop profile from existing defaults", () => {
  const profile = resolveDesktopInstallationProfile({
    execPath: "/Applications/NextClaw Desktop.exe",
    argv: [],
    env: {},
    ...DEFAULTS,
    fileExists: () => false
  });

  assert.equal(profile.installationKind, "installed");
  assert.equal(profile.profileId, "installed");
  assert.equal(profile.desktopDataDir, DEFAULTS.defaultDesktopDataDir);
  assert.equal(profile.desktopUserDataDir, DEFAULTS.defaultUserDataDir);
  assert.equal(profile.runtimeHome, DEFAULTS.defaultRuntimeHome);
  assert.equal(profile.logsDir, DEFAULTS.defaultLogsDir);
  assert.equal(profile.updateCapability.supported, true);
  assert.deepEqual(profile.runtimeEnvPatch, {});
});

test("resolves a portable profile from the executable marker", () => {
  const portableRoot = resolve("/tmp/NextClaw-Portable");
  const profile = resolveDesktopInstallationProfile({
    execPath: join(portableRoot, "NextClaw Desktop.exe"),
    argv: [],
    env: {},
    ...DEFAULTS,
    fileExists: (path) => path === join(portableRoot, DESKTOP_PORTABLE_MARKER_FILE),
    readTextFile: () => JSON.stringify({ kind: "nextclaw-portable", version: 1 })
  });

  assert.equal(profile.installationKind, "portable");
  assert.equal(profile.portableRoot, portableRoot);
  assert.equal(profile.desktopDataDir, join(portableRoot, "data", "desktop"));
  assert.equal(profile.desktopUserDataDir, join(portableRoot, "data", "desktop", "userData"));
  assert.equal(profile.runtimeHome, join(portableRoot, "data", "runtime-home"));
  assert.equal(profile.logsDir, join(portableRoot, "data", "logs"));
  assert.equal(profile.updateCapability.supported, false);
  assert.equal(profile.updateCapability.blockReason, "unsupported-installation");
  assert.equal(profile.runtimeEnvPatch.NEXTCLAW_DESKTOP_DATA_DIR_OVERRIDE, join(portableRoot, "data", "desktop"));
  assert.equal(profile.runtimeEnvPatch.NEXTCLAW_DESKTOP_RUNTIME_HOME_OVERRIDE, join(portableRoot, "data", "runtime-home"));
});

test("applies portable Electron paths and exposes runtime environment overrides", () => {
  const portableRoot = resolve("/tmp/NextClaw-Portable");
  const profile = resolveDesktopInstallationProfile({
    execPath: join(portableRoot, "NextClaw Desktop.exe"),
    argv: [],
    env: {},
    ...DEFAULTS,
    fileExists: () => true,
    readTextFile: () => JSON.stringify({ kind: "nextclaw-portable", version: 1 })
  });
  const appliedPaths: Record<string, string> = {};

  applyDesktopInstallationProfile(
    {
      setPath: (name, value) => {
        appliedPaths[name] = value;
      }
    },
    profile
  );

  assert.equal(appliedPaths.userData, join(portableRoot, "data", "desktop", "userData"));
  assert.equal(appliedPaths.logs, join(portableRoot, "data", "logs"));
  assert.equal(profile.runtimeEnvPatch.NEXTCLAW_DESKTOP_DATA_DIR_OVERRIDE, join(portableRoot, "data", "desktop"));
  assert.equal(profile.runtimeEnvPatch.NEXTCLAW_DESKTOP_RUNTIME_HOME_OVERRIDE, join(portableRoot, "data", "runtime-home"));
});

test("rejects malformed portable markers instead of silently falling back", () => {
  assert.throws(
    () =>
      resolveDesktopInstallationProfile({
        execPath: "/tmp/NextClaw-Portable/NextClaw Desktop.exe",
        argv: [],
        env: {},
        ...DEFAULTS,
        fileExists: () => true,
        readTextFile: () => JSON.stringify({ kind: "wrong", version: 1 })
      }),
    /Invalid NextClaw portable marker/
  );
});
