import { mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { AppInstallationService } from "#app-runtime/services/app-installation.service.js";
import { AppHomeService } from "#app-runtime/services/app-home.service.js";
import { AppManifestService } from "#app-runtime/services/app-manifest.service.js";
import { AppGrantService } from "./app-grant.service.js";
import { AppRegistryService } from "#app-runtime/services/app-registry.service.js";

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
    const grantService = new AppGrantService(
      new AppRegistryService(appHomeService),
    );

    const beforeGrant = await grantService.summarize(installed.appId);
    expect(beforeGrant.documentAccess[0]?.granted).toBe(false);

    const granted = await grantService.grantDocumentScope({
      appId: installed.appId,
      scopeId: "notes",
      directoryPath: notesDirectory,
    });
    const canonicalNotesDirectory = await realpath(notesDirectory);
    expect(granted.grantedPath).toBe(canonicalNotesDirectory);

    const afterGrant = await grantService.summarize(installed.appId);
    expect(afterGrant.documentAccess[0]?.granted).toBe(true);
    expect(afterGrant.documentAccess[0]?.grantedPath).toBe(
      canonicalNotesDirectory,
    );

    const revoked = await grantService.revokeDocumentScope({
      appId: installed.appId,
      scopeId: "notes",
    });
    expect(revoked.removed).toBe(true);

    const afterRevoke = await grantService.summarize(installed.appId);
    expect(afterRevoke.documentAccess[0]?.granted).toBe(false);
  });

  it("uses the same document grant owner for a schema v2 package", async () => {
    const appHomeDirectory = path.join(
      tmpdir(),
      `napp-v2-grants-home-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const notesDirectory = path.join(
      tmpdir(),
      `napp-v2-grants-notes-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    const appDirectory = path.join(
      tmpdir(),
      `napp-v2-grants-package-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    cleanupPaths.push(appHomeDirectory, notesDirectory, appDirectory);
    await mkdir(notesDirectory, { recursive: true });
    await createSchemaV2Package(appDirectory);
    await expect(
      new AppManifestService().load(appDirectory),
    ).resolves.toBeDefined();

    const appHomeService = new AppHomeService(appHomeDirectory);
    const installed = await new AppInstallationService(appHomeService).install(
      appDirectory,
    );
    const grantService = new AppGrantService(
      new AppRegistryService(appHomeService),
    );

    await expect(
      grantService.summarize(installed.appId),
    ).resolves.toMatchObject({
      documentAccess: [{ id: "notes", mode: "read", granted: false }],
    });
    await expect(
      grantService.grantDocumentScope({
        appId: installed.appId,
        scopeId: "notes",
        directoryPath: notesDirectory,
        mode: "read-write",
      }),
    ).rejects.toThrow("只声明了 read");
    await grantService.grantDocumentScope({
      appId: installed.appId,
      scopeId: "notes",
      directoryPath: notesDirectory,
      mode: "read",
    });
    await expect(
      grantService.summarize(installed.appId),
    ).resolves.toMatchObject({
      documentAccess: [
        {
          id: "notes",
          mode: "read",
          effectiveMode: "read",
          status: "granted",
          granted: true,
        },
      ],
    });
  });
});

async function createSchemaV2Package(appDirectory: string): Promise<void> {
  const panelDirectory = path.join(
    appDirectory,
    "panels",
    "nextclaw-fixture-v2-grants-panel.panel",
  );
  const serviceDirectory = path.join(
    appDirectory,
    "services",
    "nextclaw-fixture-v2-grants-service",
  );
  await mkdir(panelDirectory, { recursive: true });
  await mkdir(serviceDirectory, { recursive: true });
  await writeFile(
    path.join(panelDirectory, "index.html"),
    "<!doctype html><title>Fixture</title>",
  );
  await writeFile(
    path.join(panelDirectory, "panel-app.json"),
    JSON.stringify({
      id: "nextclaw-fixture-v2-grants-panel",
      title: "Fixture",
      entry: "index.html",
    }),
  );
  await writeFile(path.join(serviceDirectory, "server.mjs"), "export {};\n");
  await writeFile(
    path.join(serviceDirectory, "service-app.json"),
    JSON.stringify({
      id: "nextclaw-fixture-v2-grants-service",
      title: "Fixture Service",
      command: "node",
      args: ["server.mjs"],
      actions: { read: { risk: "read" } },
    }),
  );
  await writeFile(
    path.join(appDirectory, "manifest.json"),
    JSON.stringify({
      schemaVersion: 2,
      id: "nextclaw.fixture-v2-grants",
      name: "Fixture V2 grants",
      version: "0.1.0",
      presentation: { primaryPanel: "nextclaw-fixture-v2-grants-panel" },
      permissions: { documentAccess: [{ id: "notes", mode: "read" }] },
      components: [
        {
          kind: "panel",
          path: "panels/nextclaw-fixture-v2-grants-panel.panel",
        },
        {
          kind: "service",
          path: "services/nextclaw-fixture-v2-grants-service",
        },
      ],
    }),
  );
  await writeFile(
    path.join(appDirectory, "marketplace.json"),
    JSON.stringify({
      slug: "fixture-v2-grants",
      summary: "Fixture package for document grant ownership.",
      author: "NextClaw",
      tags: ["fixture"],
    }),
  );
}
