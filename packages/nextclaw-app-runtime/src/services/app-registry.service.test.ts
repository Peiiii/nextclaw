import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AppHomeService } from "#app-runtime/services/app-home.service.js";
import { AppInstanceStorageService } from "#app-runtime/services/app-instance-storage.service.js";
import { AppRegistryService } from "#app-runtime/services/app-registry.service.js";

const APP_ID = "nextclaw.secret-fixture";
const APP_VERSION = "0.1.0";
const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    cleanupPaths.splice(0).map(async (entryPath) => {
      await rm(entryPath, { recursive: true, force: true });
    }),
  );
});

describe("AppRegistryService Secret bindings", () => {
  it("stores only a declared slot's SecretRef and persists it across reload", async () => {
    const { appHome, registry } = await createFixture();

    const bound = await registry.bindSecret(APP_ID, "issue-api-token", {
      source: "env",
      provider: "local-env",
      id: "ISSUE_API_TOKEN",
    });
    expect(bound.secretBindings).toEqual({
      "issue-api-token": {
        source: "env",
        provider: "local-env",
        id: "ISSUE_API_TOKEN",
      },
    });

    const persisted = await readFile(appHome.getRegistryPath(), "utf8");
    expect(persisted).toContain("ISSUE_API_TOKEN");
    expect(persisted).not.toContain("runtime-only-secret");
    expect(
      (await new AppRegistryService(appHome).getApp(APP_ID))?.secretBindings,
    ).toEqual(bound.secretBindings);

    await expect(
      registry.bindSecret(APP_ID, "undeclared-slot", {
        source: "env",
        id: "UNDECLARED_TOKEN",
      }),
    ).rejects.toThrow("未声明 Secret slot");

    expect(await registry.unbindSecret(APP_ID, "issue-api-token")).toBe(true);
    expect(await registry.unbindSecret(APP_ID, "issue-api-token")).toBe(false);
    expect((await registry.getApp(APP_ID))?.secretBindings).toEqual({});
  });

  it("loads older registry records without secretBindings as empty bindings", async () => {
    const { appHome } = await createFixture();
    const registryJson = JSON.parse(
      await readFile(appHome.getRegistryPath(), "utf8"),
    ) as {
      apps: Record<string, Record<string, unknown>>;
    };
    delete registryJson.apps[APP_ID]?.secretBindings;
    await writeFile(
      appHome.getRegistryPath(),
      `${JSON.stringify(registryJson, null, 2)}\n`,
    );

    expect(
      (await new AppRegistryService(appHome).getApp(APP_ID))?.secretBindings,
    ).toEqual({});
  });

  it("drops bindings that are no longer declared by the activated version", async () => {
    const { appHome, registry } = await createFixture();
    const record = await registry.getApp(APP_ID);
    if (!record) throw new Error("Fixture registry app is missing.");
    const nextVersion = "0.2.0";
    await registry.upsertInstallation({
      appId: APP_ID,
      name: record.name,
      version: nextVersion,
      installDirectory: appHome.getInstallDirectory(APP_ID, nextVersion),
      defaultInstance: record.defaultInstance,
      sourceKind: "directory",
      sourceRef: "fixture-next",
      installedAt: new Date().toISOString(),
      permissions: { secrets: [] },
      manifestSchemaVersion: 2,
      dataSchemaVersion: 1,
      enabled: false,
      activate: false,
    });
    await registry.bindSecret(APP_ID, "issue-api-token", {
      source: "env",
      id: "ISSUE_API_TOKEN",
    });

    const activated = await registry.activateVersion(APP_ID, nextVersion);

    expect(activated.secretBindings).toEqual({});
  });

  it("rejects registry records that contain Secret plaintext", async () => {
    const { appHome, registry } = await createFixture();
    await registry.bindSecret(APP_ID, "issue-api-token", {
      source: "env",
      id: "ISSUE_API_TOKEN",
    });
    const registryJson = JSON.parse(
      await readFile(appHome.getRegistryPath(), "utf8"),
    ) as {
      apps: Record<
        string,
        { secretBindings: Record<string, Record<string, unknown>> }
      >;
    };
    const fixtureApp = registryJson.apps[APP_ID];
    if (!fixtureApp) {
      throw new Error("Fixture registry app is missing.");
    }
    fixtureApp.secretBindings["issue-api-token"] = {
      source: "env",
      id: "ISSUE_API_TOKEN",
      value: "runtime-only-secret",
    };
    await writeFile(
      appHome.getRegistryPath(),
      `${JSON.stringify(registryJson, null, 2)}\n`,
    );

    await expect(new AppRegistryService(appHome).load()).rejects.toThrow(
      "不能保存 Secret 明文",
    );
  });
});

describe("AppRegistryService document grants", () => {
  it("migrates legacy grants and drops them after declaration shrink, removal, and uninstall", async () => {
    const { appHome, registry } = await createFixture();
    await registry.setDocumentGrant(
      APP_ID,
      "notes",
      "/srv/notes",
      "read-write",
    );

    const registryJson = JSON.parse(
      await readFile(appHome.getRegistryPath(), "utf8"),
    ) as {
      apps: Record<string, { grants: Record<string, unknown> }>;
    };
    const fixtureApp = registryJson.apps[APP_ID];
    if (!fixtureApp) throw new Error("Fixture registry app is missing.");
    fixtureApp.grants.notes = "/srv/legacy-notes";
    await writeFile(
      appHome.getRegistryPath(),
      `${JSON.stringify(registryJson, null, 2)}\n`,
    );

    await expect(
      new AppRegistryService(appHome).getApp(APP_ID),
    ).resolves.toMatchObject({
      grants: {
        notes: {
          path: "/srv/legacy-notes",
          mode: "read-write",
        },
      },
    });

    const record = await registry.getApp(APP_ID);
    if (!record) throw new Error("Fixture registry app is missing.");
    await registry.upsertInstallation({
      appId: APP_ID,
      name: record.name,
      version: "0.2.0",
      installDirectory: appHome.getInstallDirectory(APP_ID, "0.2.0"),
      defaultInstance: record.defaultInstance,
      sourceKind: "directory",
      sourceRef: "fixture-read-only",
      installedAt: new Date().toISOString(),
      permissions: {
        documentAccess: [{ id: "notes", mode: "read" }],
      },
      manifestSchemaVersion: 2,
      dataSchemaVersion: 1,
      enabled: false,
      activate: false,
    });
    expect((await registry.activateVersion(APP_ID, "0.2.0")).grants).toEqual(
      {},
    );

    await registry.setDocumentGrant(
      APP_ID,
      "notes",
      "/srv/read-only-notes",
      "read",
    );
    await registry.upsertInstallation({
      appId: APP_ID,
      name: record.name,
      version: "0.3.0",
      installDirectory: appHome.getInstallDirectory(APP_ID, "0.3.0"),
      defaultInstance: record.defaultInstance,
      sourceKind: "directory",
      sourceRef: "fixture-no-documents",
      installedAt: new Date().toISOString(),
      permissions: {},
      manifestSchemaVersion: 2,
      dataSchemaVersion: 1,
      enabled: false,
      activate: false,
    });
    expect((await registry.activateVersion(APP_ID, "0.3.0")).grants).toEqual(
      {},
    );

    await registry.removeApp(APP_ID);
    await expect(registry.getApp(APP_ID)).resolves.toBeUndefined();
  });
});

async function createFixture(): Promise<{
  appHome: AppHomeService;
  registry: AppRegistryService;
}> {
  const appHomeDirectory = path.join(
    tmpdir(),
    `nextclaw-secret-registry-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  cleanupPaths.push(appHomeDirectory);
  const appHome = new AppHomeService(appHomeDirectory);
  const registry = new AppRegistryService(appHome);
  const defaultInstance = await new AppInstanceStorageService(
    appHome,
  ).materializeDefaultInstance({
    appId: APP_ID,
    dataSchemaVersion: 1,
  });
  await registry.upsertInstallation({
    appId: APP_ID,
    name: "Secret fixture",
    version: APP_VERSION,
    installDirectory: appHome.getInstallDirectory(APP_ID, APP_VERSION),
    defaultInstance,
    sourceKind: "directory",
    sourceRef: "fixture",
    installedAt: new Date().toISOString(),
    permissions: {
      documentAccess: [{ id: "notes", mode: "read-write" }],
      secrets: [
        {
          id: "issue-api-token",
          title: "Issue API token",
          description: "Used by the fixture only.",
          required: true,
        },
      ],
    },
    manifestSchemaVersion: 2,
    dataSchemaVersion: 1,
    enabled: false,
  });
  return { appHome, registry };
}
