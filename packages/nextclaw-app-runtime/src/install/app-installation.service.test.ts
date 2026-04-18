import { access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppHomeService } from "../paths/app-home.service.js";
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
});
