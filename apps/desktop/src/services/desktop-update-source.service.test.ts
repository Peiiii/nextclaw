import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DesktopLauncherStateStore } from "../launcher/stores/launcher-state.store";
import {
  DesktopUpdateSourceService,
  getDesktopUpdateChannelManifestUrl,
  getDesktopUpdateChannelManifestUrlFromBaseUrl,
  getDesktopUpdateManifestAssetName
} from "./desktop-update-source.service";

async function withTempDir(prefix: string, job: (rootDir: string) => Promise<void>): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), prefix));
  await job(rootDir);
}

test("stable packaged apps resolve the latest stable manifest URL by default", async () =>
  await withTempDir("nextclaw-update-source-stable-", async (rootDir) => {
    const stateStore = new DesktopLauncherStateStore(join(rootDir, "launcher-state.json"));
    const service = new DesktopUpdateSourceService({
      isPackaged: true,
      appPath: rootDir,
      resourcesPath: rootDir,
      platform: "darwin",
      arch: "arm64",
      publishTarget: {
        owner: "Peiiii",
        repo: "nextclaw"
      },
      stateStore
    });

    const manifestUrl = await service.resolveManifestUrl();
    assert.equal(
      manifestUrl,
      "https://Peiiii.github.io/nextclaw/desktop-updates/stable/manifest-stable-darwin-arm64.json"
    );
    assert.equal(service.resolveChannel(), "stable");
  }));

test("beta packaged apps resolve the published beta channel manifest URL", async () =>
  await withTempDir("nextclaw-update-source-beta-", async (rootDir) => {
    const resourcesPath = join(rootDir, "resources");
    await mkdir(join(resourcesPath, "update"), { recursive: true });
    await writeFile(
      join(resourcesPath, "update", "update-release-metadata.json"),
      `${JSON.stringify({ channel: "beta", releaseTag: "v0.17.6-desktop-beta.2" }, null, 2)}\n`,
      "utf8"
    );

    const stateStore = new DesktopLauncherStateStore(join(rootDir, "launcher-state.json"));
    const service = new DesktopUpdateSourceService({
      isPackaged: true,
      appPath: rootDir,
      resourcesPath,
      platform: "darwin",
      arch: "arm64",
      publishTarget: {
        owner: "Peiiii",
        repo: "nextclaw"
      },
      stateStore
    });

    assert.equal(service.resolveChannel(), "beta");
    assert.equal(
      await service.resolveManifestUrl(),
      "https://Peiiii.github.io/nextclaw/desktop-updates/beta/manifest-beta-darwin-arm64.json"
    );
  }));

test("builds a deterministic published channel manifest URL", () => {
  assert.equal(
    getDesktopUpdateChannelManifestUrl({ owner: "Peiiii", repo: "nextclaw" }, "beta", "darwin", "arm64"),
    "https://Peiiii.github.io/nextclaw/desktop-updates/beta/manifest-beta-darwin-arm64.json"
  );
  assert.equal(
    getDesktopUpdateChannelManifestUrlFromBaseUrl("http://127.0.0.1:4010/desktop-updates", "beta", "darwin", "arm64"),
    "http://127.0.0.1:4010/desktop-updates/beta/manifest-beta-darwin-arm64.json"
  );
  assert.equal(getDesktopUpdateManifestAssetName("stable", "linux", "x64"), "manifest-stable-linux-x64.json");
});

test("explicit manifest base url keeps channel-aware resolution for unpackaged smoke environments", async () =>
  await withTempDir("nextclaw-update-source-base-url-", async (rootDir) => {
    const stateStore = new DesktopLauncherStateStore(join(rootDir, "launcher-state.json"));
    await stateStore.write({
      channel: "beta",
      currentVersion: null,
      previousVersion: null,
      candidateVersion: null,
      candidateLaunchCount: 0,
      lastKnownGoodVersion: null,
      badVersions: [],
      lastUpdateCheckAt: null,
      downloadedVersion: null,
      downloadedReleaseNotesUrl: null,
      updatePreferences: {
        automaticChecks: true,
        autoDownload: false
      }
    });

    const service = new DesktopUpdateSourceService({
      isPackaged: false,
      appPath: rootDir,
      resourcesPath: rootDir,
      env: {
        NEXTCLAW_DESKTOP_UPDATE_MANIFEST_BASE_URL: "http://127.0.0.1:4010/desktop-updates"
      },
      platform: "darwin",
      arch: "arm64",
      publishTarget: null,
      stateStore
    });

    assert.equal(service.resolveChannel(), "beta");
    assert.equal(
      await service.resolveManifestUrl(),
      "http://127.0.0.1:4010/desktop-updates/beta/manifest-beta-darwin-arm64.json"
    );
  }));

test("explicit manifest url still wins over manifest base url", async () =>
  await withTempDir("nextclaw-update-source-explicit-url-", async (rootDir) => {
    const stateStore = new DesktopLauncherStateStore(join(rootDir, "launcher-state.json"));
    const service = new DesktopUpdateSourceService({
      isPackaged: false,
      appPath: rootDir,
      resourcesPath: rootDir,
      env: {
        NEXTCLAW_DESKTOP_UPDATE_MANIFEST_URL: "http://127.0.0.1:4010/custom-manifest.json",
        NEXTCLAW_DESKTOP_UPDATE_MANIFEST_BASE_URL: "http://127.0.0.1:4010/desktop-updates"
      },
      platform: "darwin",
      arch: "arm64",
      publishTarget: null,
      stateStore
    });

    assert.equal(await service.resolveManifestUrl(), "http://127.0.0.1:4010/custom-manifest.json");
  }));

test("persisted launcher state channel overrides packaged metadata", async () =>
  await withTempDir("nextclaw-update-source-state-channel-", async (rootDir) => {
    const resourcesPath = join(rootDir, "resources");
    await mkdir(join(resourcesPath, "update"), { recursive: true });
    await writeFile(
      join(resourcesPath, "update", "update-release-metadata.json"),
      `${JSON.stringify({ channel: "stable", releaseTag: "v0.17.6" }, null, 2)}\n`,
      "utf8"
    );
    const stateStore = new DesktopLauncherStateStore(join(rootDir, "launcher-state.json"));
    await stateStore.write({
      channel: "beta",
      currentVersion: null,
      previousVersion: null,
      candidateVersion: null,
      candidateLaunchCount: 0,
      lastKnownGoodVersion: null,
      badVersions: [],
      lastUpdateCheckAt: null,
      downloadedVersion: null,
      downloadedReleaseNotesUrl: null,
      updatePreferences: {
        automaticChecks: true,
        autoDownload: false
      }
    });

    const service = new DesktopUpdateSourceService({
      isPackaged: true,
      appPath: rootDir,
      resourcesPath,
      platform: "darwin",
      arch: "arm64",
      publishTarget: {
        owner: "Peiiii",
        repo: "nextclaw"
      },
      stateStore
    });

    assert.equal(service.resolveChannel(), "beta");
  }));
