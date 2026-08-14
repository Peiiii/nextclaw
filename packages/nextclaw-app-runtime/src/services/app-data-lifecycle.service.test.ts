import { access, cp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppBundleService } from "./app-bundle.service.js";
import { AppHomeService } from "./app-home.service.js";
import { AppInstallationService } from "./app-installation.service.js";
import { AppInstanceInventoryService } from "./app-instance-inventory.service.js";
import { AppScaffoldService } from "./app-scaffold.service.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.map(async (entry) =>
    await rm(entry, { recursive: true, force: true })));
  cleanupPaths.length = 0;
});

describe("App data lifecycle", () => {
  it("preserves a real .napp instance across update and default uninstall, then purges it explicitly", async () => {
    const appV1Directory = createTemporaryPath("nextclaw-data-lifecycle-v1");
    const appV2Directory = createTemporaryPath("nextclaw-data-lifecycle-v2");
    const appHomeDirectory = createTemporaryPath("nextclaw-data-lifecycle-home");
    const bundleV1Path = `${createTemporaryPath("nextclaw-data-lifecycle-v1")}.napp`;
    const bundleV2Path = `${createTemporaryPath("nextclaw-data-lifecycle-v2")}.napp`;
    cleanupPaths.push(
      appV1Directory,
      appV2Directory,
      appHomeDirectory,
      bundleV1Path,
      bundleV2Path,
    );

    await new AppScaffoldService().scaffold(appV1Directory);
    await cp(appV1Directory, appV2Directory, { recursive: true });
    const appId = "nextclaw.data-lifecycle";
    await setManifestIdentity(appV1Directory, appId, "0.1.0");
    await setManifestIdentity(appV2Directory, appId, "0.2.0");
    const bundleService = new AppBundleService();
    await bundleService.packAppDirectory({
      appDirectory: appV1Directory,
      outputPath: bundleV1Path,
    });
    await bundleService.packAppDirectory({
      appDirectory: appV2Directory,
      outputPath: bundleV2Path,
    });

    const appHomeService = new AppHomeService(appHomeDirectory);
    const installationService = new AppInstallationService(appHomeService);
    const installedV1 = await installationService.install(bundleV1Path);
    const sentinelPath = path.join(installedV1.instance.storage.dataDirectory, "sentinel.json");
    await writeFile(sentinelPath, "{\"value\":1}\n", "utf8");
    await Promise.all([
      writeFile(path.join(installedV1.instance.storage.configDirectory, "config"), "c", "utf8"),
      writeFile(path.join(installedV1.instance.storage.stateDirectory, "state"), "ss", "utf8"),
      writeFile(path.join(installedV1.instance.storage.cacheDirectory, "cache"), "ccc", "utf8"),
      writeFile(path.join(installedV1.instance.storage.temporaryDirectory, "tmp"), "tttt", "utf8"),
      writeFile(path.join(installedV1.instance.storage.logsDirectory, "log"), "lllll", "utf8"),
    ]);
    await expect(new AppInstanceInventoryService().list(
      appHomeService.getInstancesDirectory(),
    )).resolves.toMatchObject({
      entries: [{
        appId,
        usage: {
          dataBytes: 12,
          configBytes: 1,
          stateBytes: 2,
          cacheBytes: 3,
          temporaryBytes: 4,
          logsBytes: 5,
          totalBytes: 27,
        },
      }],
      diagnostics: [],
    });

    const installedV2 = await installationService.install(bundleV2Path);
    expect(installedV2.version).toBe("0.2.0");
    expect(installedV2.instance.storage.instanceDirectory)
      .toBe(installedV1.instance.storage.instanceDirectory);
    await expect(readFile(sentinelPath, "utf8")).resolves.toBe("{\"value\":1}\n");

    await expect(installationService.uninstall(appId, false)).resolves.toMatchObject({
      dataRemoved: false,
    });
    await expect(access(installedV1.instance.storage.instanceDirectory)).resolves.toBeUndefined();

    const reinstalled = await installationService.install(bundleV2Path);
    await expect(readFile(sentinelPath, "utf8")).resolves.toBe("{\"value\":1}\n");
    expect(reinstalled.instance.storage.instanceDirectory)
      .toBe(installedV1.instance.storage.instanceDirectory);

    await expect(installationService.uninstall(appId, true)).resolves.toMatchObject({
      dataRemoved: true,
    });
    await expect(access(installedV1.instance.storage.instanceDirectory)).rejects.toThrow();
    await expect(new AppInstanceInventoryService().list(
      appHomeService.getInstancesDirectory(),
    )).resolves.toMatchObject({ entries: [], diagnostics: [] });
  });
});

async function setManifestIdentity(
  appDirectory: string,
  appId: string,
  version: string,
): Promise<void> {
  const manifestPath = path.join(appDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  await writeFile(
    manifestPath,
    `${JSON.stringify({ ...manifest, id: appId, name: "Data Lifecycle", version }, null, 2)}\n`,
    "utf8",
  );
}

function createTemporaryPath(prefix: string): string {
  return path.join(
    tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}
