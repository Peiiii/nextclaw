import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { DesktopBundleLayoutStore } from "../launcher/stores/bundle-layout.store";
import { DesktopLauncherStateStore } from "../launcher/stores/launcher-state.store";
import { createBundleArchive, createLauncherState, withTempDir, writeBundleFixture } from "../launcher/__tests__/launcher-test.utils";
import { DesktopBundleBootstrapService } from "./desktop-bundle-bootstrap.service";

async function writeSeedArchive(rootDir: string, version: string, marker: string): Promise<{ archivePath: string; sha256: string }> {
  const archiveBytes = await createBundleArchive({
    rootDir: join(rootDir, `seed-${marker}`),
    version
  });
  const archivePath = join(rootDir, `${version}-${marker}.zip`);
  await writeFile(archivePath, archiveBytes);
  return {
    archivePath,
    sha256: createHash("sha256").update(archiveBytes).digest("hex")
  };
}

function createBootstrapService(
  layout: DesktopBundleLayoutStore,
  seedBundlePath: string,
  launcherBuildFingerprint = "launcher-a"
): DesktopBundleBootstrapService {
  return new DesktopBundleBootstrapService({
    logger: {
      info: () => {},
      warn: () => {}
    },
    layout,
    launcherVersion: "0.1.0",
    channel: "stable",
    resolveManifestUrl: async () => null,
    bundlePublicKey: null,
    seedBundlePath,
    launcherBuildFingerprint
  });
}

test("retries a quarantined packaged seed when the packaged archive fingerprint is new", async () =>
  await withTempDir("nextclaw-desktop-packaged-seed-retry-", async (rootDir) => {
    const layout = new DesktopBundleLayoutStore(rootDir);
    await layout.ensureLauncherDirs();
    writeBundleFixture({
      rootDir: layout.getVersionsDir(),
      version: "0.17.7"
    });
    await layout.writeCurrentPointer({ version: "0.17.7" });
    const { archivePath, sha256 } = await writeSeedArchive(rootDir, "0.17.10", "fixed");
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    await stateStore.write(
      createLauncherState({
        currentVersion: "0.17.7",
        lastKnownGoodVersion: "0.17.7",
        badVersions: ["0.17.10"],
        lastAttemptedPackagedSeedVersion: "0.17.10",
        lastAttemptedPackagedSeedSha256: "stale-sha256",
        lastAttemptedPackagedSeedLauncherFingerprint: "launcher-a"
      })
    );

    await createBootstrapService(layout, archivePath).ensureInitialBundleAvailability();

    assert.deepEqual(layout.readCurrentPointer(), { version: "0.17.10" });
    assert.equal(stateStore.read().currentVersion, "0.17.10");
    assert.equal(stateStore.read().candidateVersion, "0.17.10");
    assert.equal(stateStore.read().lastAttemptedPackagedSeedVersion, "0.17.10");
    assert.equal(stateStore.read().lastAttemptedPackagedSeedSha256, sha256);
    assert.equal(stateStore.read().lastAttemptedPackagedSeedLauncherFingerprint, "launcher-a");
  }));

test("does not retry the same quarantined packaged seed fingerprint again", async () =>
  await withTempDir("nextclaw-desktop-packaged-seed-skip-", async (rootDir) => {
    const layout = new DesktopBundleLayoutStore(rootDir);
    await layout.ensureLauncherDirs();
    writeBundleFixture({
      rootDir: layout.getVersionsDir(),
      version: "0.17.7"
    });
    await layout.writeCurrentPointer({ version: "0.17.7" });
    const { archivePath, sha256 } = await writeSeedArchive(rootDir, "0.17.10", "same");
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    await stateStore.write(
      createLauncherState({
        currentVersion: "0.17.7",
        lastKnownGoodVersion: "0.17.7",
        badVersions: ["0.17.10"],
        lastAttemptedPackagedSeedVersion: "0.17.10",
        lastAttemptedPackagedSeedSha256: sha256,
        lastAttemptedPackagedSeedLauncherFingerprint: "launcher-a"
      })
    );

    await createBootstrapService(layout, archivePath).ensureInitialBundleAvailability();

    assert.deepEqual(layout.readCurrentPointer(), { version: "0.17.7" });
    assert.equal(stateStore.read().currentVersion, "0.17.7");
    assert.equal(stateStore.read().candidateVersion, null);
    assert.equal(stateStore.read().lastAttemptedPackagedSeedSha256, sha256);
  }));

test("retries a quarantined packaged seed when the launcher fingerprint changed", async () =>
  await withTempDir("nextclaw-desktop-packaged-seed-launcher-retry-", async (rootDir) => {
    const layout = new DesktopBundleLayoutStore(rootDir);
    await layout.ensureLauncherDirs();
    writeBundleFixture({
      rootDir: layout.getVersionsDir(),
      version: "0.17.7"
    });
    await layout.writeCurrentPointer({ version: "0.17.7" });
    const { archivePath, sha256 } = await writeSeedArchive(rootDir, "0.17.10", "same-seed-new-launcher");
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    await stateStore.write(
      createLauncherState({
        currentVersion: "0.17.7",
        lastKnownGoodVersion: "0.17.7",
        badVersions: ["0.17.10"],
        lastAttemptedPackagedSeedVersion: "0.17.10",
        lastAttemptedPackagedSeedSha256: sha256,
        lastAttemptedPackagedSeedLauncherFingerprint: "launcher-a"
      })
    );

    await createBootstrapService(layout, archivePath, "launcher-b").ensureInitialBundleAvailability();

    assert.deepEqual(layout.readCurrentPointer(), { version: "0.17.10" });
    assert.equal(stateStore.read().currentVersion, "0.17.10");
    assert.equal(stateStore.read().candidateVersion, "0.17.10");
    assert.equal(stateStore.read().lastAttemptedPackagedSeedSha256, sha256);
    assert.equal(stateStore.read().lastAttemptedPackagedSeedLauncherFingerprint, "launcher-b");
  }));

test("replaces an existing same-version bundle when retrying a quarantined packaged seed", async () =>
  await withTempDir("nextclaw-desktop-packaged-seed-replace-quarantined-", async (rootDir) => {
    const layout = new DesktopBundleLayoutStore(rootDir);
    await layout.ensureLauncherDirs();
    const existingBundleDir = writeBundleFixture({
      rootDir: layout.getVersionsDir(),
      version: "0.17.10"
    });
    await writeFile(join(existingBundleDir, "runtime", "old-runtime-marker.txt"), "old\n");
    await layout.writeCurrentPointer({ version: "0.17.7" });
    const { archivePath, sha256 } = await writeSeedArchive(rootDir, "0.17.10", "replacement");
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    await stateStore.write(
      createLauncherState({
        currentVersion: "0.17.7",
        lastKnownGoodVersion: "0.17.7",
        badVersions: ["0.17.10"],
        lastAttemptedPackagedSeedVersion: "0.17.10",
        lastAttemptedPackagedSeedSha256: "stale-sha256",
        lastAttemptedPackagedSeedLauncherFingerprint: "launcher-a"
      })
    );

    await createBootstrapService(layout, archivePath, "launcher-b").ensureInitialBundleAvailability();

    assert.deepEqual(layout.readCurrentPointer(), { version: "0.17.10" });
    assert.equal(existsSync(join(layout.getVersionDir("0.17.10"), "runtime", "old-runtime-marker.txt")), false);
    assert.equal(stateStore.read().lastAttemptedPackagedSeedSha256, sha256);
  }));

test("uses packaged seed metadata to skip older seed archives without opening the bundle", async () =>
  await withTempDir("nextclaw-desktop-packaged-seed-metadata-skip-", async (rootDir) => {
    const layout = new DesktopBundleLayoutStore(rootDir);
    await layout.ensureLauncherDirs();
    writeBundleFixture({
      rootDir: layout.getVersionsDir(),
      version: "0.17.10"
    });
    await layout.writeCurrentPointer({ version: "0.17.10" });
    const stateStore = new DesktopLauncherStateStore(layout.getLauncherStatePath());
    await stateStore.write(
      createLauncherState({
        currentVersion: "0.17.10",
        lastKnownGoodVersion: "0.17.10"
      })
    );

    const service = new DesktopBundleBootstrapService({
      logger: {
        info: () => {},
        warn: () => {}
      },
      layout,
      launcherVersion: "0.1.0",
      channel: "stable",
      resolveManifestUrl: async () => null,
      bundlePublicKey: null,
      seedBundlePath: join(rootDir, "missing-seed.zip"),
      seedBundleMetadata: {
        version: "0.17.9",
        sha256: "metadata-sha256",
        archiveBytes: 10,
        fileCount: 1,
        directoryCount: 1,
        uncompressedBytes: 10
      }
    });

    await service.ensureInitialBundleAvailability();

    assert.deepEqual(layout.readCurrentPointer(), { version: "0.17.10" });
    assert.equal(stateStore.read().currentVersion, "0.17.10");
    assert.equal(stateStore.read().candidateVersion, null);
  }));
