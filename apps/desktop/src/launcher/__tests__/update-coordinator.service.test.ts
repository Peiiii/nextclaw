import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { DesktopBundleLifecycleService } from "../services/bundle-lifecycle.service";
import { DesktopBundleService } from "../services/bundle.service";
import { DesktopUpdateCoordinatorService } from "../services/update-coordinator.service";
import { DesktopUpdateService } from "../services/update.service";
import { DesktopBundleLayoutStore } from "../stores/bundle-layout.store";
import { DesktopLauncherStateStore } from "../stores/launcher-state.store";
import {
  bundlePublicKey,
  createBundleArchive,
  createLauncherState,
  createSignedUpdateManifest,
  signBundleArchive,
  withTempDir,
  writeBundleFixture
} from "./launcher-test.utils";

test("downloads and installs an update without changing the active version", async () =>
  await withTempDir("nextclaw-update-download-only-", async (rootDir) => {
    const layout = new DesktopBundleLayoutStore(rootDir);
    await layout.ensureLauncherDirs();
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    writeBundleFixture({
      rootDir: layout.getVersionsDir(),
      version: "0.18.1"
    });
    await stateStore.write(
      createLauncherState({
        currentVersion: "0.18.1",
        lastKnownGoodVersion: "0.18.1"
      })
    );
    await layout.writeCurrentPointer({ version: "0.18.1" });

    const archiveBytes = await createBundleArchive({
      rootDir: join(rootDir, "source"),
      version: "0.18.2"
    });
    const archiveSha256 = createHash("sha256").update(archiveBytes).digest("hex");
    const manifest = createSignedUpdateManifest({
      latestVersion: "0.18.2",
      bundleSha256: archiveSha256,
      bundleSignature: signBundleArchive(archiveBytes)
    });
    const updateClient = new DesktopUpdateService({
      layout,
      launcherVersion: "0.1.0",
      bundlePublicKey,
      fetchImpl: async () => new Response(archiveBytes, { status: 200 }),
      now: () => 321
    });

    const downloaded = await updateClient.downloadAndInstallUpdate(manifest);
    assert.deepEqual(downloaded, {
      kind: "bundle-update-downloaded",
      manifest,
      downloadedVersion: "0.18.2",
      bundleDirectory: layout.getVersionDir("0.18.2")
    });
    assert.deepEqual(
      stateStore.read(),
      createLauncherState({
        currentVersion: "0.18.1",
        lastKnownGoodVersion: "0.18.1"
      })
    );
    assert.deepEqual(layout.readCurrentPointer(), { version: "0.18.1" });
  }));

test("coordinator reports an available update without downloading by default", async () =>
  await withTempDir("nextclaw-update-coordinator-check-", async (rootDir) => {
    const layout = new DesktopBundleLayoutStore(rootDir);
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    await stateStore.write(
      createLauncherState({
        currentVersion: "0.18.0",
        lastKnownGoodVersion: "0.18.0"
      })
    );
    const manifest = createSignedUpdateManifest({
      latestVersion: "0.18.1",
      releaseNotesUrl: "https://example.com/release-notes"
    });
    let downloadInvocations = 0;
    const coordinator = new DesktopUpdateCoordinatorService({
      launcherVersion: "0.1.0",
      manifestUrl: "https://example.com/manifest.json",
      stateStore,
      updateService: {
        checkForUpdate: async () => ({
          kind: "bundle-update",
          manifest
        }),
        downloadAndInstallUpdate: async () => {
          downloadInvocations += 1;
          return {
            kind: "bundle-update-downloaded",
            manifest,
            downloadedVersion: manifest.latestVersion,
            bundleDirectory: layout.getVersionDir(manifest.latestVersion)
          };
        }
      } as unknown as DesktopUpdateService,
      bundleLifecycle: {} as DesktopBundleLifecycleService,
      bundleService: {} as DesktopBundleService
    });

    const snapshot = await coordinator.checkForUpdates({ manual: true });
    assert.equal(snapshot.status, "update-available");
    assert.equal(snapshot.availableVersion, "0.18.1");
    assert.equal(snapshot.downloadedVersion, null);
    assert.equal(downloadInvocations, 0);
    assert.match(stateStore.read().lastUpdateCheckAt ?? "", /^20\d\d-/);
  }));

test("coordinator downloads an update and waits for user-triggered apply", async () =>
  await withTempDir("nextclaw-update-coordinator-apply-", async (rootDir) => {
    const layout = new DesktopBundleLayoutStore(rootDir);
    await layout.ensureLauncherDirs();
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    writeBundleFixture({
      rootDir: layout.getVersionsDir(),
      version: "0.17.9"
    });
    writeBundleFixture({
      rootDir: layout.getVersionsDir(),
      version: "0.18.0"
    });
    writeBundleFixture({
      rootDir: layout.getVersionsDir(),
      version: "0.18.1"
    });
    await stateStore.write(
      createLauncherState({
        currentVersion: "0.18.0",
        lastKnownGoodVersion: "0.18.0"
      })
    );
    await layout.writeCurrentPointer({ version: "0.18.0" });

    const manifest = createSignedUpdateManifest({
      latestVersion: "0.18.1",
      releaseNotesUrl: "https://example.com/release-notes"
    });
    const bundleService = new DesktopBundleService({
      layout,
      stateStore,
      launcherVersion: "0.1.0"
    });
    const coordinator = new DesktopUpdateCoordinatorService({
      launcherVersion: "0.1.0",
      manifestUrl: "https://example.com/manifest.json",
      stateStore,
      updateService: {
        checkForUpdate: async () => ({
          kind: "bundle-update",
          manifest
        }),
        downloadAndInstallUpdate: async () => ({
          kind: "bundle-update-downloaded",
          manifest,
          downloadedVersion: manifest.latestVersion,
          bundleDirectory: layout.getVersionDir(manifest.latestVersion)
        })
      } as unknown as DesktopUpdateService,
      bundleLifecycle: new DesktopBundleLifecycleService({
        layout,
        stateStore,
        bundleService
      }),
      bundleService
    });

    const downloadedSnapshot = await coordinator.downloadUpdate();
    assert.equal(downloadedSnapshot.status, "downloaded");
    assert.equal(stateStore.read().currentVersion, "0.18.0");
    assert.equal(stateStore.read().downloadedVersion, "0.18.1");
    assert.equal(existsSync(layout.getVersionDir("0.17.9")), false);
    assert.equal(existsSync(layout.getVersionDir("0.18.0")), true);
    assert.equal(existsSync(layout.getVersionDir("0.18.1")), true);

    const appliedSnapshot = await coordinator.applyDownloadedUpdate();
    assert.equal(appliedSnapshot.currentVersion, "0.18.1");
    assert.equal(appliedSnapshot.downloadedVersion, null);
    assert.deepEqual(layout.readCurrentPointer(), { version: "0.18.1" });
    assert.deepEqual(
      stateStore.read(),
      createLauncherState({
        currentVersion: "0.18.1",
        previousVersion: "0.18.0",
        candidateVersion: "0.18.1",
        lastKnownGoodVersion: "0.18.0",
        lastUpdateCheckAt: stateStore.read().lastUpdateCheckAt
      })
    );
  }));

test("coordinator auto-downloads only when the preference is enabled", async () =>
  await withTempDir("nextclaw-update-coordinator-auto-download-", async (rootDir) => {
    const layout = new DesktopBundleLayoutStore(rootDir);
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    await stateStore.write(
      createLauncherState({
        currentVersion: "0.18.0",
        lastKnownGoodVersion: "0.18.0",
        updatePreferences: {
          automaticChecks: true,
          autoDownload: true
        }
      })
    );
    const manifest = createSignedUpdateManifest({
      latestVersion: "0.18.1"
    });
    let autoReadyNotifications = 0;
    let downloadInvocations = 0;
    const coordinator = new DesktopUpdateCoordinatorService({
      launcherVersion: "0.1.0",
      manifestUrl: "https://example.com/manifest.json",
      stateStore,
      updateService: {
        checkForUpdate: async () => ({
          kind: "bundle-update",
          manifest
        }),
        downloadAndInstallUpdate: async () => {
          downloadInvocations += 1;
          return {
            kind: "bundle-update-downloaded",
            manifest,
            downloadedVersion: manifest.latestVersion,
            bundleDirectory: layout.getVersionDir(manifest.latestVersion)
          };
        }
      } as unknown as DesktopUpdateService,
      bundleLifecycle: {} as DesktopBundleLifecycleService,
      bundleService: {
        pruneRetainedArtifacts: async () => ({
          keptVersions: [],
          removedVersions: [],
          removedStagingEntries: []
        })
      } as unknown as DesktopBundleService,
      onAutoDownloadedUpdateReady: () => {
        autoReadyNotifications += 1;
      }
    });

    const snapshot = await coordinator.checkForUpdates();
    assert.equal(snapshot.status, "downloaded");
    assert.equal(downloadInvocations, 1);
    assert.equal(autoReadyNotifications, 1);
    assert.equal(stateStore.read().downloadedVersion, "0.18.1");
  }));
