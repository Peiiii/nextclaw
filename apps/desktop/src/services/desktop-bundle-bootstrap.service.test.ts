import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

function createBootstrapService(layout: DesktopBundleLayoutStore, seedBundlePath: string): DesktopBundleBootstrapService {
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
    seedBundlePath
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
        lastAttemptedPackagedSeedSha256: "stale-sha256"
      })
    );

    await createBootstrapService(layout, archivePath).ensureInitialBundleAvailability();

    assert.deepEqual(layout.readCurrentPointer(), { version: "0.17.10" });
    assert.equal(stateStore.read().currentVersion, "0.17.10");
    assert.equal(stateStore.read().candidateVersion, "0.17.10");
    assert.equal(stateStore.read().lastAttemptedPackagedSeedVersion, "0.17.10");
    assert.equal(stateStore.read().lastAttemptedPackagedSeedSha256, sha256);
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
        lastAttemptedPackagedSeedSha256: sha256
      })
    );

    await createBootstrapService(layout, archivePath).ensureInitialBundleAvailability();

    assert.deepEqual(layout.readCurrentPointer(), { version: "0.17.7" });
    assert.equal(stateStore.read().currentVersion, "0.17.7");
    assert.equal(stateStore.read().candidateVersion, null);
    assert.equal(stateStore.read().lastAttemptedPackagedSeedSha256, sha256);
  }));
