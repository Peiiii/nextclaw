import { access, chmod, cp, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppHomeService } from "#app-runtime/services/app-home.service.js";
import { AppBundleService } from "#app-runtime/services/app-bundle.service.js";
import { AppScaffoldService } from "#app-runtime/services/app-scaffold.service.js";
import { AppInstallationService } from "./app-installation.service.js";
import { AppRegistryService } from "#app-runtime/services/app-registry.service.js";
import type { AppBuildService } from "#app-runtime/services/app-build.service.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupPaths.map((entryPath) =>
      rm(entryPath, {
        recursive: true,
        force: true,
      }),
    ),
  );
  cleanupPaths.length = 0;
});

describe("AppInstallationService", () => {
  it("installs, lists, resolves, and uninstalls an app", async () => {
    const appDirectory = path.join(
      tmpdir(),
      `napp-install-app-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const appHomeDirectory = path.join(
      tmpdir(),
      `napp-home-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    cleanupPaths.push(appDirectory, appHomeDirectory);

    await new AppScaffoldService().scaffold(appDirectory);
    const appHomeService = new AppHomeService(appHomeDirectory);
    const installationService = new AppInstallationService(appHomeService);

    const installed = await installationService.install(appDirectory);
    const appList = await installationService.list();
    const appInfo = await installationService.info(installed.appId);
    const launch = await installationService.resolveLaunch(installed.appId, {});
    const uninstalled = await installationService.uninstall(installed.appId, false);

    expect(appList).toHaveLength(1);
    expect(appList[0]?.appId).toBe(installed.appId);
    expect(appInfo.activeVersion).toBe(installed.version);
    expect(launch.appDirectory).toBe(installed.installDirectory);
    expect(uninstalled.removedVersions).toEqual([installed.version]);
    await expect(access(installed.dataDirectory)).resolves.toBeUndefined();
    expect(await installationService.list()).toHaveLength(0);
  });

  it("installs and updates an app from registry metadata", async () => {
    const appHomeDirectory = createTemporaryPath("napp-registry-home");
    cleanupPaths.push(appHomeDirectory);
    const registryFixture = await createRegistryFixture();
    cleanupPaths.push(...registryFixture.cleanupPaths);
    try {
      const appHomeService = new AppHomeService(appHomeDirectory);
      const installationService = new AppInstallationService(appHomeService);

      const installed = await installationService.install(registryFixture.appId, {
        registryUrl: registryFixture.registryUrl,
      });
      expect(installed.sourceKind).toBe("registry");
      expect(installed.distributionMode).toBe("bundle");
      expect(installed.version).toBe("0.1.0");
      expect(installed.registryUrl).toBe(registryFixture.registryUrl);

      registryFixture.setLatestVersion("0.2.0");
      const updated = await installationService.update(registryFixture.appId, {
        registryUrl: registryFixture.registryUrl,
      });
      expect(updated.updated).toBe(true);
      expect(updated.previousVersion).toBe("0.1.0");
      expect(updated.version).toBe("0.2.0");

      const info = await installationService.info(registryFixture.appId);
      expect(info.activeVersion).toBe("0.2.0");
      expect(info.installedVersions.map((item) => item.version)).toEqual([
        "0.1.0",
        "0.2.0",
      ]);
    } finally {
      await closeServer(registryFixture.server);
    }
  });

  it("preserves publisher-owned data on reinstall and rejects a different publisher", async () => {
    const appHomeDirectory = createTemporaryPath("napp-publisher-owned-home");
    cleanupPaths.push(appHomeDirectory);
    const registryFixture = await createRegistryFixture();
    cleanupPaths.push(...registryFixture.cleanupPaths);
    try {
      const installationService = new AppInstallationService(
        new AppHomeService(appHomeDirectory),
      );
      const installed = await installationService.install(registryFixture.appId, {
        registryUrl: registryFixture.registryUrl,
      });
      const sentinelPath = path.join(installed.dataDirectory, "publisher-owned.json");
      await writeFile(sentinelPath, "{}\n");
      await installationService.uninstall(registryFixture.appId, false);

      await installationService.install(registryFixture.appId, {
        registryUrl: registryFixture.registryUrl,
      });
      await expect(access(sentinelPath)).resolves.toBeUndefined();
      await installationService.uninstall(registryFixture.appId, false);

      registryFixture.setPublisher({ id: "attacker", name: "Different Publisher" });
      await expect(installationService.install(registryFixture.appId, {
        registryUrl: registryFixture.registryUrl,
      })).rejects.toThrow("已绑定发布者 nextclaw");
      await expect(access(sentinelPath)).resolves.toBeUndefined();
      await expect(installationService.list()).resolves.toEqual([]);
    } finally {
      await closeServer(registryFixture.server);
    }
  });
});

describe("AppInstallationService updates and package lifecycle", () => {
  it("prepares an update without switching activeVersion when activation is deferred", async () => {
    const appHomeDirectory = createTemporaryPath("napp-registry-prepare-home");
    cleanupPaths.push(appHomeDirectory);
    const registryFixture = await createRegistryFixture();
    cleanupPaths.push(...registryFixture.cleanupPaths);
    try {
      const installationService = new AppInstallationService(
        new AppHomeService(appHomeDirectory),
      );
      await installationService.install(registryFixture.appId, {
        registryUrl: registryFixture.registryUrl,
      });
      registryFixture.setLatestVersion("0.2.0");

      const prepared = await installationService.update(registryFixture.appId, {
        registryUrl: registryFixture.registryUrl,
        activate: false,
      });

      expect(prepared).toMatchObject({
        previousVersion: "0.1.0",
        updated: true,
        version: "0.2.0",
      });
      await expect(installationService.info(registryFixture.appId)).resolves.toMatchObject({
        activeVersion: "0.1.0",
        installedVersions: expect.arrayContaining([
          expect.objectContaining({ version: "0.2.0" }),
        ]),
      });
    } finally {
      await closeServer(registryFixture.server);
    }
  });

  it("reuses an already installed inactive version during update", async () => {
    const appHomeDirectory = createTemporaryPath("napp-registry-reuse-home");
    cleanupPaths.push(appHomeDirectory);
    const registryFixture = await createRegistryFixture();
    cleanupPaths.push(...registryFixture.cleanupPaths);
    try {
      const installationService = new AppInstallationService(
        new AppHomeService(appHomeDirectory),
      );
      await installationService.install(registryFixture.appId, {
        registryUrl: registryFixture.registryUrl,
      });
      registryFixture.setLatestVersion("0.2.0");
      await installationService.update(registryFixture.appId, {
        registryUrl: registryFixture.registryUrl,
      });
      await installationService.rollback(registryFixture.appId, "0.1.0");

      const updated = await installationService.update(registryFixture.appId, {
        registryUrl: registryFixture.registryUrl,
        version: "0.2.0",
      });

      expect(updated).toMatchObject({
        previousVersion: "0.1.0",
        updated: true,
        version: "0.2.0",
      });
      await expect(installationService.info(registryFixture.appId)).resolves.toMatchObject({
        activeVersion: "0.2.0",
      });
    } finally {
      await closeServer(registryFixture.server);
    }
  });

  it("restores referenced uninstall staging and removes abandoned install staging", async () => {
    const appDirectory = createTemporaryPath("napp-reconcile-app");
    const appHomeDirectory = createTemporaryPath("napp-reconcile-home");
    cleanupPaths.push(appDirectory, appHomeDirectory);
    await new AppScaffoldService().scaffold(appDirectory);
    const installationService = new AppInstallationService(
      new AppHomeService(appHomeDirectory),
    );
    const installed = await installationService.install(appDirectory);
    const stagedInstall = `${installed.installDirectory}.uninstalling-test`;
    const abandonedInstall = `${installed.installDirectory}.staging-test`;
    const stagedData = `${installed.dataDirectory}.uninstalling-test`;
    await rename(installed.installDirectory, stagedInstall);
    await cp(stagedInstall, abandonedInstall, { recursive: true });
    await rename(installed.dataDirectory, stagedData);

    await installationService.reconcileFilesystem();

    await expect(access(installed.installDirectory)).resolves.toBeUndefined();
    await expect(access(installed.dataDirectory)).resolves.toBeUndefined();
    await expect(access(stagedInstall)).rejects.toThrow();
    await expect(access(stagedData)).rejects.toThrow();
    await expect(access(abandonedInstall)).rejects.toThrow();
  });

  it("retries a transient registry connection reset before installing", async () => {
    const appHomeDirectory = createTemporaryPath("napp-registry-retry-home");
    cleanupPaths.push(appHomeDirectory);
    const registryFixture = await createRegistryFixture();
    cleanupPaths.push(...registryFixture.cleanupPaths);
    try {
      registryFixture.failNextMetadataRequest();
      const installationService = new AppInstallationService(
        new AppHomeService(appHomeDirectory),
      );

      const installed = await installationService.install(registryFixture.appId, {
        registryUrl: registryFixture.registryUrl,
      });

      expect(installed.appId).toBe(registryFixture.appId);
      expect(registryFixture.getMetadataRequestCount()).toBe(2);
    } finally {
      await closeServer(registryFixture.server);
    }
  });

  it("rejects a remote bundle whose declared size exceeds the download budget", async () => {
    const appHomeDirectory = createTemporaryPath("napp-registry-large-home");
    cleanupPaths.push(appHomeDirectory);
    const registryFixture = await createRegistryFixture();
    cleanupPaths.push(...registryFixture.cleanupPaths);
    try {
      registryFixture.reportOversizedBundle();
      const installationService = new AppInstallationService(
        new AppHomeService(appHomeDirectory),
      );

      await expect(installationService.install(registryFixture.appId, {
        registryUrl: registryFixture.registryUrl,
      })).rejects.toThrow("远程 bundle 超过");
    } finally {
      await closeServer(registryFixture.server);
    }
  });
});

describe("AppInstallationService artifact lifecycle", () => {
  it("materializes source distributions before installing", async () => {
    const appDirectory = createTemporaryPath("napp-source-install-app");
    const appHomeDirectory = createTemporaryPath("napp-source-install-home");
    const bundlePath = `${createTemporaryPath("napp-source-install-bundle")}.napp`;
    cleanupPaths.push(appDirectory, appHomeDirectory, bundlePath);

    await new AppScaffoldService().scaffold(appDirectory, { template: "ts-http" });
    const build = async ({ appDirectory: buildDirectory }: { appDirectory: string; install: boolean }) => {
      await writeFile(path.join(buildDirectory, "main", "app.wasm"), Buffer.alloc(2048));
      return {
        appDirectory: buildDirectory,
        mainKind: "wasi-http-component",
        mainEntryPath: path.join(buildDirectory, "main", "app.wasm"),
        installedDependencies: true,
        built: true,
      };
    };
    await new AppBundleService().packAppDirectory({
      appDirectory,
      outputPath: bundlePath,
      mode: "source",
    });

    const appHomeService = new AppHomeService(appHomeDirectory);
    const installationService = new AppInstallationService(
      appHomeService,
      undefined,
      undefined,
      {
        build,
      } as AppBuildService,
    );

    const installed = await installationService.install(bundlePath);
    expect(installed.sourceKind).toBe("bundle");
    expect(installed.distributionMode).toBe("source");
    await expect(access(path.join(installed.installDirectory, "main", "src", "component.ts"))).resolves.toBeUndefined();
    const installedWasmBytes = await readFile(path.join(installed.installDirectory, "main", "app.wasm"));
    expect(installedWasmBytes.byteLength).toBe(2048);
  });

  it("keeps version directories immutable and rolls back by switching activeVersion", async () => {
    const version1Directory = createTemporaryPath("napp-rollback-v1");
    const version2Directory = createTemporaryPath("napp-rollback-v2");
    const appHomeDirectory = createTemporaryPath("napp-rollback-home");
    cleanupPaths.push(version1Directory, version2Directory, appHomeDirectory);
    await new AppScaffoldService().scaffold(version1Directory);
    await cp(version1Directory, version2Directory, { recursive: true });
    const appId = "nextclaw.rollback-demo";
    await writeManifestVersion(version1Directory, appId, "0.1.0");
    await writeManifestVersion(version2Directory, appId, "0.2.0");
    const installationService = new AppInstallationService(new AppHomeService(appHomeDirectory));

    const installedV1 = await installationService.install(version1Directory);
    await installationService.install(version2Directory);
    await expect(installationService.install(version2Directory)).rejects.toThrow("不能覆盖不可变版本");
    const rollback = await installationService.rollback(appId, "0.1.0");

    expect(rollback).toMatchObject({
      activeVersion: "0.1.0",
      previousVersion: "0.2.0",
      rolledBack: true,
    });
    expect((await installationService.info(appId)).activeVersion).toBe("0.1.0");
    expect((await stat(path.join(installedV1.installDirectory, "manifest.json"))).mode & 0o222)
      .toBe(0);
  });

  it("blocks activation when installed package contents were modified", async () => {
    const version1Directory = createTemporaryPath("napp-integrity-v1");
    const version2Directory = createTemporaryPath("napp-integrity-v2");
    const appHomeDirectory = createTemporaryPath("napp-integrity-home");
    cleanupPaths.push(version1Directory, version2Directory, appHomeDirectory);
    await new AppScaffoldService().scaffold(version1Directory);
    await cp(version1Directory, version2Directory, { recursive: true });
    const appId = "nextclaw.integrity-demo";
    await writeManifestVersion(version1Directory, appId, "0.1.0");
    await writeManifestVersion(version2Directory, appId, "0.2.0");
    const installationService = new AppInstallationService(new AppHomeService(appHomeDirectory));
    const installedV1 = await installationService.install(version1Directory);
    await installationService.install(version2Directory);
    const installedManifestPath = path.join(installedV1.installDirectory, "manifest.json");
    const originalManifest = await readFile(installedManifestPath, "utf8");
    await chmod(installedManifestPath, 0o644);
    await writeFile(installedManifestPath, `${originalManifest}\n`, "utf8");

    await expect(installationService.rollback(appId, "0.1.0"))
      .rejects.toThrow("完整性校验失败");
    await expect(installationService.info(appId)).resolves.toMatchObject({
      activeVersion: "0.2.0",
    });
  });

  it("installs schema v2 packages disabled and enables them explicitly", async () => {
    const appDirectory = createTemporaryPath("napp-components-install");
    const appHomeDirectory = createTemporaryPath("napp-components-home");
    cleanupPaths.push(appDirectory, appHomeDirectory);
    await createComponentPackage(appDirectory);
    const installationService = new AppInstallationService(new AppHomeService(appHomeDirectory));

    const installed = await installationService.install(appDirectory);
    expect(installed).toMatchObject({
      appId: "nextclaw.personal-organizer",
      enabled: false,
      manifestSchemaVersion: 2,
      primaryPanelId: "nextclaw-personal-organizer-todos",
    });
    expect(installed.components).toHaveLength(2);
    expect((await installationService.setEnabled(installed.appId, true)).enabled).toBe(true);
    expect((await installationService.list())[0]?.enabled).toBe(true);
  });

  it("blocks a data schema change when the package has no supported migration contract", async () => {
    const version1Directory = createTemporaryPath("napp-schema-v1");
    const version2Directory = createTemporaryPath("napp-schema-v2");
    const appHomeDirectory = createTemporaryPath("napp-schema-home");
    cleanupPaths.push(version1Directory, version2Directory, appHomeDirectory);
    await createComponentPackage(version1Directory, { version: "0.1.0", dataSchemaVersion: 1 });
    await createComponentPackage(version2Directory, { version: "0.2.0", dataSchemaVersion: 2 });
    const installationService = new AppInstallationService(new AppHomeService(appHomeDirectory));
    await installationService.install(version1Directory);

    await expect(installationService.install(version2Directory))
      .rejects.toThrow("没有受支持的迁移合同");
    await expect(installationService.info("nextclaw.personal-organizer"))
      .resolves.toMatchObject({ activeVersion: "0.1.0" });
  });

});

describe("AppInstallationService reliability", () => {

  it("serializes registry mutations across installation service instances", async () => {
    const appHomeDirectory = createTemporaryPath("napp-concurrent-home");
    const appDirectories = Array.from({ length: 4 }, (_, index) =>
      createTemporaryPath(`napp-concurrent-app-${index}`));
    cleanupPaths.push(appHomeDirectory, ...appDirectories);
    await Promise.all(appDirectories.map(async (directory) => {
      await new AppScaffoldService().scaffold(directory);
    }));
    const appHomeService = new AppHomeService(appHomeDirectory);

    const installed = await Promise.all(appDirectories.map(async (directory) =>
      await new AppInstallationService(appHomeService).install(directory)));

    const listedIds = (await new AppInstallationService(appHomeService).list())
      .map((entry) => entry.appId)
      .sort((left, right) => left.localeCompare(right));
    expect(listedIds).toEqual(installed.map((entry) => entry.appId).sort((left, right) =>
      left.localeCompare(right)));
  });

  it("restores code and data when uninstall cannot update the registry", async () => {
    const appDirectory = createTemporaryPath("napp-uninstall-restore-app");
    const appHomeDirectory = createTemporaryPath("napp-uninstall-restore-home");
    cleanupPaths.push(appDirectory, appHomeDirectory);
    await new AppScaffoldService().scaffold(appDirectory);
    const appHomeService = new AppHomeService(appHomeDirectory);
    const registryService = new class extends AppRegistryService {
      override removeApp = async (): Promise<never> => {
        throw new Error("simulated registry failure");
      };
    }(appHomeService);
    const installationService = new AppInstallationService(
      appHomeService,
      undefined,
      undefined,
      undefined,
      registryService,
    );
    const installed = await installationService.install(appDirectory);
    await writeFile(path.join(installed.dataDirectory, "sentinel.json"), "{}\n");

    await expect(installationService.uninstall(installed.appId, true)).rejects.toThrow(
      "simulated registry failure",
    );
    await expect(access(installed.installDirectory)).resolves.toBeUndefined();
    await expect(access(path.join(installed.dataDirectory, "sentinel.json"))).resolves.toBeUndefined();
    await expect(installationService.info(installed.appId)).resolves.toMatchObject({
      activeVersion: installed.version,
    });
  });
});

function createTemporaryPath(prefix: string): string {
  return path.join(
    tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}

type RegistryFixtureState = {
  latestVersion: "0.1.0" | "0.2.0";
  metadataRequestCount: number;
  metadataFailuresRemaining: number;
  oversizedBundle: boolean;
  publisher: { id: string; name: string; url?: string };
};

class RegistryFixture {
  constructor(
    readonly appId: string,
    readonly registryUrl: string,
    readonly server: ReturnType<typeof createServer>,
    readonly cleanupPaths: string[],
    private readonly state: RegistryFixtureState,
  ) {}

  setLatestVersion = (version: "0.1.0" | "0.2.0"): void => {
    this.state.latestVersion = version;
  };

  setPublisher = (publisher: { id: string; name: string; url?: string }): void => {
    this.state.publisher = publisher;
  };

  failNextMetadataRequest = (): void => {
    this.state.metadataFailuresRemaining += 1;
  };

  getMetadataRequestCount = (): number => this.state.metadataRequestCount;

  reportOversizedBundle = (): void => {
    this.state.oversizedBundle = true;
  };
}

async function createRegistryFixture(): Promise<RegistryFixture> {
  const version1Directory = createTemporaryPath("napp-registry-v1");
  const version2Directory = createTemporaryPath("napp-registry-v2");
  const version1BundlePath = createTemporaryPath("napp-registry-v1") + ".napp";
  const version2BundlePath = createTemporaryPath("napp-registry-v2") + ".napp";
  const cleanupPaths = [
    version1Directory,
    version2Directory,
    version1BundlePath,
    version2BundlePath,
  ];

  await new AppScaffoldService().scaffold(version1Directory);
  await cp(version1Directory, version2Directory, { recursive: true });
  const appId = "nextclaw.registry-demo";
  await writeManifestVersion(version1Directory, appId, "0.1.0");
  await writeManifestVersion(version2Directory, appId, "0.2.0");

  const bundleService = new AppBundleService();
  await bundleService.packAppDirectory({
    appDirectory: version1Directory,
    outputPath: version1BundlePath,
  });
  await bundleService.packAppDirectory({
    appDirectory: version2Directory,
    outputPath: version2BundlePath,
  });

  const version1BundleBytes = await readFile(version1BundlePath);
  const version2BundleBytes = await readFile(version2BundlePath);
  const version1Sha256 = createHash("sha256")
    .update(version1BundleBytes)
    .digest("hex");
  const version2Sha256 = createHash("sha256")
    .update(version2BundleBytes)
    .digest("hex");
  const state: RegistryFixtureState = {
    latestVersion: "0.1.0",
    metadataRequestCount: 0,
    metadataFailuresRemaining: 0,
    oversizedBundle: false,
    publisher: {
      id: "nextclaw",
      name: "NextClaw Official",
      url: "https://nextclaw.com",
    },
  };
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname === `/${encodeURIComponent(appId)}`) {
      state.metadataRequestCount += 1;
      if (state.metadataFailuresRemaining > 0) {
        state.metadataFailuresRemaining -= 1;
        request.socket.destroy();
        return;
      }
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          name: appId,
          description: "Registry Demo",
          "dist-tags": {
            latest: state.latestVersion,
          },
          versions: {
            "0.1.0": {
              name: appId,
              version: "0.1.0",
              description: "Registry Demo",
              publisher: state.publisher,
              dist: {
                kind: "bundle",
                bundle: "./-/registry-demo-0.1.0.napp",
                sha256: version1Sha256,
              },
            },
            "0.2.0": {
              name: appId,
              version: "0.2.0",
              description: "Registry Demo",
              publisher: state.publisher,
              dist: {
                kind: "bundle",
                bundle: "./-/registry-demo-0.2.0.napp",
                sha256: version2Sha256,
              },
            },
          },
        }),
      );
      return;
    }
    if (requestUrl.pathname === "/-/registry-demo-0.1.0.napp") {
      response.setHeader("content-type", "application/octet-stream");
      if (state.oversizedBundle) {
        response.setHeader("content-length", String(25 * 1024 * 1024 + 1));
      }
      response.end(version1BundleBytes);
      return;
    }
    if (requestUrl.pathname === "/-/registry-demo-0.2.0.napp") {
      response.setHeader("content-type", "application/octet-stream");
      response.end(version2BundleBytes);
      return;
    }
    response.writeHead(404, {
      "content-type": "text/plain",
    });
    response.end("not found");
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("registry test server address unavailable");
  }
  return new RegistryFixture(
    appId,
    `http://127.0.0.1:${address.port}/`,
    server,
    cleanupPaths,
    state,
  );
}

async function writeManifestVersion(
  appDirectory: string,
  appId: string,
  version: "0.1.0" | "0.2.0",
): Promise<void> {
  const manifestPath = path.join(appDirectory, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as Record<string, unknown>;
  manifest.id = appId;
  manifest.name = "Registry Demo";
  manifest.version = version;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function createComponentPackage(
  appDirectory: string,
  options: { version?: string; dataSchemaVersion?: number } = {},
): Promise<void> {
  const panelDirectory = path.join(appDirectory, "panels", "nextclaw-personal-organizer-todos.panel");
  const serviceDirectory = path.join(appDirectory, "services", "nextclaw-personal-organizer-data");
  await mkdir(panelDirectory, { recursive: true });
  await mkdir(serviceDirectory, { recursive: true });
  await writeFile(path.join(panelDirectory, "index.html"), "<!doctype html><title>Todo</title>");
  await writeFile(path.join(panelDirectory, "panel-app.json"), JSON.stringify({
    id: "nextclaw-personal-organizer-todos",
    title: "Todo",
    entry: "index.html",
    actions: ["nextclaw-personal-organizer-data.todo-list"],
  }));
  await writeFile(path.join(serviceDirectory, "server.mjs"), "export {};\n");
  await writeFile(path.join(serviceDirectory, "service-app.json"), JSON.stringify({
    id: "nextclaw-personal-organizer-data",
    title: "Personal Organizer Data",
    command: "node",
    args: ["server.mjs"],
    actions: { "todo-list": { risk: "read" } },
  }));
  await writeFile(path.join(appDirectory, "manifest.json"), JSON.stringify({
    schemaVersion: 2,
    id: "nextclaw.personal-organizer",
    name: "Personal Organizer",
    version: options.version ?? "0.1.0",
    ...(options.dataSchemaVersion
      ? { storage: { scope: "global", schemaVersion: options.dataSchemaVersion } }
      : {}),
    presentation: { primaryPanel: "nextclaw-personal-organizer-todos" },
    components: [
      { kind: "panel", path: "panels/nextclaw-personal-organizer-todos.panel" },
      { kind: "service", path: "services/nextclaw-personal-organizer-data" },
    ],
  }));
  await writeFile(path.join(appDirectory, "marketplace.json"), JSON.stringify({
    slug: "personal-organizer",
    summary: "Personal organizer",
    summaryI18n: { en: "Personal organizer" },
    author: "NextClaw",
    tags: ["personal"],
  }));
}
