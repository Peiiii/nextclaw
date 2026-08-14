import { access, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AppHomeService,
  AppInstanceStorageService,
} from "@nextclaw/app-runtime";
import { AppDataManager } from "@kernel/managers/app-data.manager.js";

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.map(async (entry) =>
    await rm(entry, { recursive: true, force: true })));
  cleanupPaths.length = 0;
});

describe("AppDataManager", () => {
  it("projects package and workspace instances as active or retained", async () => {
    const fixture = await createFixture();
    fixture.packageActive = true;

    const result = await fixture.manager.list();

    expect(result.diagnostics).toEqual([]);
    expect(result.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        appId: "example.notes",
        displayName: "Notes",
        source: "package",
        lifecycle: "active",
        actions: { deleteRetainedData: false },
      }),
      expect.objectContaining({
        appId: "workspace.search",
        displayName: "workspace.search",
        source: "workspace-service",
        lifecycle: "retained",
        actions: { deleteRetainedData: true },
      }),
    ]));
  });

  it("requires matching confirmation and refuses active data", async () => {
    const fixture = await createFixture();
    fixture.packageActive = true;
    const packageEntry = (await fixture.manager.list()).entries
      .find((entry) => entry.source === "package");
    expect(packageEntry).toBeTruthy();

    await expect(fixture.manager.deleteRetained(packageEntry!.id, "wrong.id"))
      .rejects.toMatchObject({ code: "APP_DATA_CONFIRMATION_MISMATCH" });
    await expect(fixture.manager.deleteRetained(packageEntry!.id, packageEntry!.appId))
      .rejects.toMatchObject({ code: "APP_DATA_ACTIVE" });
    await expect(access(fixture.packageInstanceDirectory)).resolves.toBeUndefined();
  });

  it("permanently removes a retained instance and its inventory entry", async () => {
    const fixture = await createFixture();
    const retained = (await fixture.manager.list()).entries
      .find((entry) => entry.source === "package");
    expect(retained?.lifecycle).toBe("retained");

    await expect(fixture.manager.deleteRetained(retained!.id, retained!.appId))
      .resolves.toMatchObject({ deleted: true, appId: "example.notes" });

    await expect(access(fixture.packageInstanceDirectory)).rejects.toThrow();
    expect((await fixture.manager.list()).entries.some((entry) => entry.id === retained!.id))
      .toBe(false);
  });

  it("removes retained workspace data only within the current workspace scope", async () => {
    const fixture = await createFixture();
    const retained = (await fixture.manager.list()).entries
      .find((entry) => entry.source === "workspace-service");
    expect(retained?.lifecycle).toBe("retained");

    await expect(fixture.manager.deleteRetained(retained!.id, retained!.appId))
      .resolves.toMatchObject({ deleted: true, appId: "workspace.search" });

    await expect(access(fixture.workspaceInstanceDirectory)).rejects.toThrow();
  });

  it("rejects malformed opaque ids before any filesystem deletion", async () => {
    const fixture = await createFixture();
    const malformedPayload = Buffer.from(JSON.stringify({
      version: 1,
      source: "package",
      appId: "../escape",
      instanceId: "default",
    }), "utf8").toString("base64url");

    await expect(fixture.manager.deleteRetained(
      `ad1.${malformedPayload}`,
      "../escape",
    )).rejects.toMatchObject({ code: "APP_DATA_INVALID_ID" });

    await expect(access(fixture.packageInstanceDirectory)).resolves.toBeUndefined();
  });
});

async function createFixture() {
  const root = createTemporaryPath("nextclaw-app-data-manager");
  const appHome = path.join(root, "home", "apps");
  const workspace = path.join(root, "workspace");
  cleanupPaths.push(root);
  const appHomeService = new AppHomeService(appHome);
  const storageService = new AppInstanceStorageService(appHomeService);
  const packageInstance = await storageService.materializeDefaultInstance({
    appId: "example.notes",
    publisherId: "example",
  });
  await writeFile(path.join(packageInstance.storage.dataDirectory, "notes.json"), "[]", "utf8");
  const workspaceInstance = await storageService.materialize({
    appId: "workspace.search",
    instanceId: "default",
    instanceDirectory: path.join(
      workspace,
      ".nextclaw",
      "app-instances",
      "workspace.search",
      "default",
    ),
  });
  await writeFile(path.join(workspaceInstance.storage.cacheDirectory, "index"), "x", "utf8");
  const fixture = {
    packageActive: false,
    workspaceActive: false,
    packageInstanceDirectory: packageInstance.storage.instanceDirectory,
    workspaceInstanceDirectory: workspaceInstance.storage.instanceDirectory,
    manager: undefined as unknown as AppDataManager,
  };
  fixture.manager = new AppDataManager({
    appHomeDirectory: appHome,
    getWorkspacePath: () => workspace,
    listInstalledPackageOwners: async () => fixture.packageActive
      ? [{ id: "example.notes", name: "Notes" }]
      : [],
    listWorkspaceDataOwners: async () => fixture.workspaceActive
      ? [{ id: "workspace.search", title: "Workspace Search" }]
      : [],
  });
  return fixture;
}

function createTemporaryPath(prefix: string): string {
  return path.join(
    tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
}
