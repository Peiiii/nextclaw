import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { AppInstallationService } from "../install/app-installation.service.js";
import { AppHomeService } from "../paths/app-home.service.js";
import { AppGrantService } from "./app-grant.service.js";
import { AppRegistryService } from "../registry/app-registry.service.js";

describe("AppGrantService", () => {
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

  it("grants and revokes document scopes for an installed app", async () => {
    const appHomeDirectory = path.join(
      tmpdir(),
      `napp-grants-home-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const notesDirectory = path.join(
      tmpdir(),
      `napp-grants-notes-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    cleanupPaths.push(appHomeDirectory, notesDirectory);

    const appDirectory = fileURLToPath(
      new URL("../../../../apps/examples/hello-notes", import.meta.url),
    );
    await mkdir(notesDirectory, { recursive: true });
    const appHomeService = new AppHomeService(appHomeDirectory);
    const installationService = new AppInstallationService(appHomeService);
    const installed = await installationService.install(appDirectory);
    const grantService = new AppGrantService(new AppRegistryService(appHomeService));

    const beforeGrant = await grantService.summarize(installed.appId);
    expect(beforeGrant.documentAccess[0]?.granted).toBe(false);

    const granted = await grantService.grantDocumentScope({
      appId: installed.appId,
      scopeId: "notes",
      directoryPath: notesDirectory,
    });
    expect(granted.grantedPath).toBe(path.resolve(notesDirectory));

    const afterGrant = await grantService.summarize(installed.appId);
    expect(afterGrant.documentAccess[0]?.granted).toBe(true);
    expect(afterGrant.documentAccess[0]?.grantedPath).toBe(path.resolve(notesDirectory));

    const revoked = await grantService.revokeDocumentScope({
      appId: installed.appId,
      scopeId: "notes",
    });
    expect(revoked.removed).toBe(true);

    const afterRevoke = await grantService.summarize(installed.appId);
    expect(afterRevoke.documentAccess[0]?.granted).toBe(false);
  });
});
