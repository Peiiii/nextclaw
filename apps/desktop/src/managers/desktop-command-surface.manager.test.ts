import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { DesktopCommandSurfaceManager, type DesktopCommandSurfaceManifest } from "./desktop-command-surface.manager";
import type { DesktopInstallationProfile } from "../utils/desktop-installation-profile.utils";

function createProfile(root: string, installationKind: DesktopInstallationProfile["installationKind"]): DesktopInstallationProfile {
  return {
    installationKind,
    profileId: installationKind,
    portableRoot: installationKind === "portable" ? root : null,
    desktopDataDir: join(root, "desktop"),
    desktopUserDataDir: join(root, "desktop", "userData"),
    runtimeHome: join(root, "runtime-home"),
    logsDir: join(root, "logs"),
    instanceScopeId: installationKind,
    updateCapability: {
      supported: installationKind === "installed",
      blockReason: installationKind === "installed" ? null : "unsupported-installation",
      message: null
    },
    runtimeEnvPatch: {}
  };
}

test("desktop command surface writes manifest and shims for installed profile", async () => {
  const root = mkdtempSync(join(tmpdir(), "nextclaw-command-surface-"));
  try {
    const runtimeScriptPath = join(root, "node_modules", "nextclaw", "dist", "cli", "app", "index.js");
    mkdirSync(dirname(runtimeScriptPath), { recursive: true });
    writeFileSync(runtimeScriptPath, "");
    const result = await new DesktopCommandSurfaceManager({
      profile: createProfile(root, "installed"),
      appExecutablePath: "/Applications/NextClaw Desktop.app/Contents/MacOS/NextClaw Desktop",
      appIsPackaged: false,
      appPath: root,
      resourcesPath: join(root, "resources"),
      compiledMainDir: "/Applications/NextClaw Desktop.app/Contents/Resources/app.asar/dist/src",
      launcherVersion: "0.0.189"
    }).ensure();

    const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8")) as DesktopCommandSurfaceManifest;
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.installationKind, "installed");
    assert.equal(manifest.runtimeHome, join(root, "runtime-home"));
    assert.equal(result.runtimeEnvPatch.NEXTCLAW_COMMAND_SURFACE_BIN, result.binDir);

    const posixShimPath = join(result.binDir, "nextclaw");
    const windowsShimPath = join(result.binDir, "nextclaw.cmd");
    assert.equal(existsSync(posixShimPath), true);
    assert.equal(existsSync(windowsShimPath), true);
    assert.match(readFileSync(posixShimPath, "utf8"), /ELECTRON_RUN_AS_NODE=1 exec/);
    assert.match(readFileSync(posixShimPath, "utf8"), /--manifest/);
    assert.equal(readFileSync(windowsShimPath, "utf8").includes("%*"), true);
    assert.equal((statSync(posixShimPath).mode & 0o111) !== 0, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("desktop command surface is idempotent for portable profile", async () => {
  const root = mkdtempSync(join(tmpdir(), "nextclaw-command-surface-portable-"));
  try {
    const service = new DesktopCommandSurfaceManager({
      profile: createProfile(root, "portable"),
      appExecutablePath: join(root, "NextClaw Desktop.exe"),
      appIsPackaged: true,
      appPath: root,
      resourcesPath: join(root, "resources"),
      compiledMainDir: join(root, "dist", "src"),
      launcherVersion: "0.0.189"
    });

    const first = await service.ensure();
    const second = await service.ensure();
    assert.deepEqual(second, first);
    const manifest = JSON.parse(readFileSync(first.manifestPath, "utf8")) as DesktopCommandSurfaceManifest;
    assert.equal(manifest.installationKind, "portable");
    assert.equal(manifest.desktopDataDir, join(root, "desktop"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
