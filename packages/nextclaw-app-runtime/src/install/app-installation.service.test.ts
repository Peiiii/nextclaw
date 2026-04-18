import { access, cp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppHomeService } from "../paths/app-home.service.js";
import { AppBundleService } from "../bundle/app-bundle.service.js";
import { AppScaffoldService } from "../scaffold/app-scaffold.service.js";
import { AppInstallationService } from "./app-installation.service.js";

describe("AppInstallationService", () => {
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
});

function createTemporaryPath(prefix: string): string {
  return path.join(
    tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}

async function createRegistryFixture(): Promise<{
  appId: string;
  registryUrl: string;
  server: ReturnType<typeof createServer>;
  setLatestVersion: (version: "0.1.0" | "0.2.0") => void;
  cleanupPaths: string[];
}> {
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
  let latestVersion: "0.1.0" | "0.2.0" = "0.1.0";
  const publisher = {
    id: "nextclaw",
    name: "NextClaw Official",
    url: "https://nextclaw.com",
  };
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname === `/${encodeURIComponent(appId)}`) {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          name: appId,
          description: "Registry Demo",
          "dist-tags": {
            latest: latestVersion,
          },
          versions: {
            "0.1.0": {
              name: appId,
              version: "0.1.0",
              description: "Registry Demo",
              publisher,
              dist: {
                bundle: "./-/registry-demo-0.1.0.napp",
                sha256: version1Sha256,
              },
            },
            "0.2.0": {
              name: appId,
              version: "0.2.0",
              description: "Registry Demo",
              publisher,
              dist: {
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
  return {
    appId,
    registryUrl: `http://127.0.0.1:${address.port}/`,
    server,
    setLatestVersion: (version) => {
      latestVersion = version;
    },
    cleanupPaths,
  };
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
