import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { AppPackageOperationManager } from "@kernel/managers/app-package-operation.manager.js";

const tempDirectories: string[] = [];
const builtInAppsDirectory = resolve(
  import.meta.dirname,
  "../../../../nextclaw/resources/apps",
);

function createTempDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-app-package-test-"));
  tempDirectories.push(directory);
  return directory;
}

function createKernel(
  appsDirectory = builtInAppsDirectory,
  homeDirectory = createTempDirectory(),
): NextclawKernel {
  const workspaceDirectory = join(homeDirectory, "workspace");
  const configPath = join(homeDirectory, "config.json");
  saveConfig(
    ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: workspaceDirectory,
        },
      },
    }),
    configPath,
  );
  return new NextclawKernel({
    builtInAppsDirectory: appsDirectory,
    configPath,
    homeDir: homeDirectory,
    productVersion: "0.32.0",
  });
}

afterEach(() => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop();
    if (directory) {
      rmSync(directory, { force: true, recursive: true });
    }
  }
});

describe("AppPackageManager runtime projection", () => {
  it("marks persisted active operations as interrupted after process recovery", async () => {
    const storeDirectory = createTempDirectory();
    const storePath = join(storeDirectory, "operations.json");
    writeFileSync(storePath, `${JSON.stringify({
      schemaVersion: 1,
      entries: [{
        id: "operation-before-restart",
        action: "install",
        source: "nextclaw.example",
        appId: "nextclaw.example",
        status: "downloading",
        completedSteps: 2,
        totalSteps: 5,
        createdAt: "2026-08-13T00:00:00.000Z",
        updatedAt: "2026-08-13T00:00:01.000Z",
      }],
    }, null, 2)}\n`);
    const manager = new AppPackageOperationManager({
      storePath,
      execute: async () => ({ appId: "nextclaw.example" }),
    });

    await expect(manager.list()).resolves.toMatchObject({
      entries: [{
        id: "operation-before-restart",
        status: "interrupted",
        error: "NextClaw 在操作完成前退出，请重试。",
      }],
    });
    expect(JSON.parse(readFileSync(storePath, "utf8"))).toMatchObject({
      entries: [{ status: "interrupted" }],
    });
  });

  it("deduplicates concurrent write operations for the same app", async () => {
    const storeDirectory = createTempDirectory();
    let finishExecution: (() => void) | undefined;
    const executionGate = new Promise<void>((resolveExecution) => {
      finishExecution = resolveExecution;
    });
    const manager = new AppPackageOperationManager({
      storePath: join(storeDirectory, "operations.json"),
      execute: async (input) => {
        await executionGate;
        return {
          appId: input.action === "install" ? input.source : input.appId,
        };
      },
    });

    const [first, duplicate] = await Promise.all([
      manager.start({ action: "update", appId: "nextclaw.example" }),
      manager.start({ action: "rollback", appId: "nextclaw.example", version: "0.1.0" }),
    ]);

    expect(duplicate.id).toBe(first.id);
    expect((await manager.list()).entries).toHaveLength(1);
    finishExecution?.();
  });

  it("runs uninstall asynchronously and keeps a built-in app suppressed after restart", async () => {
    const homeDirectory = createTempDirectory();
    const kernel = createKernel(builtInAppsDirectory, homeDirectory);

    try {
      await expect(kernel.appPackageManager.listPackages()).resolves.toMatchObject({
        entries: [expect.objectContaining({ id: "nextclaw.personal-organizer" })],
      });
      const accepted = await kernel.appPackageManager.startOperation({
        action: "uninstall",
        appId: "nextclaw.personal-organizer",
        purgeData: false,
      });
      expect(accepted.status).toBe("queued");

      let completed = accepted;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        completed = (await kernel.appPackageManager.listOperations()).entries
          .find((entry) => entry.id === accepted.id) ?? completed;
        if (completed.status === "succeeded" || completed.status === "failed") break;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
      }
      expect(completed).toMatchObject({
        action: "uninstall",
        status: "succeeded",
        result: { appId: "nextclaw.personal-organizer", dataRemoved: false },
      });
    } finally {
      await kernel.serviceAppManager.dispose();
    }

    const restartedKernel = createKernel(builtInAppsDirectory, homeDirectory);
    try {
      await expect(restartedKernel.appPackageManager.listPackages()).resolves.toEqual({
        entries: [],
      });
    } finally {
      await restartedKernel.serviceAppManager.dispose();
    }
  });

  it("rejects enabling a package that requires a newer NextClaw version", async () => {
    const incompatibleAppsDirectory = createTempDirectory();
    const packageDirectory = join(incompatibleAppsDirectory, "incompatible-organizer");
    cpSync(join(builtInAppsDirectory, "nextclaw-personal-organizer"), packageDirectory, {
      recursive: true,
    });
    const manifestPath = join(packageDirectory, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.engines = { nextclaw: ">=99.0.0" };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const kernel = createKernel(incompatibleAppsDirectory);

    try {
      await expect(kernel.appPackageManager.enable("nextclaw.personal-organizer"))
        .rejects.toMatchObject({ code: "APP_PACKAGE_INCOMPATIBLE" });
      await expect(kernel.appPackageManager.getPackage("nextclaw.personal-organizer"))
        .resolves.toMatchObject({ enabled: false });
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  });
});

describe("AppPackageManager package projection lifecycle", () => {
  it("projects the official package into panel and service runtimes with stable data", async () => {
    const kernel = createKernel();

    try {
      const initialPackages = await kernel.appPackageManager.listPackages();
      expect(initialPackages.entries).toEqual([
        expect.objectContaining({
          activeVersion: "0.1.1",
          builtIn: true,
          components: expect.arrayContaining([
            expect.objectContaining({ kind: "panel" }),
            expect.objectContaining({ kind: "service" }),
          ]),
          enabled: false,
          id: "nextclaw.personal-organizer",
        }),
      ]);
      await expect(kernel.panelAppManager.listPanelApps()).resolves.toMatchObject({
        entries: [],
      });
      await expect(kernel.serviceAppManager.listServiceApps()).resolves.toMatchObject({
        entries: [],
      });

      const enabledPackage = await kernel.appPackageManager.enable(
        "nextclaw.personal-organizer",
      );
      expect(enabledPackage.enabled).toBe(true);
      expect(enabledPackage.components).toHaveLength(5);

      const panels = await kernel.panelAppManager.listPanelApps();
      expect(panels.entries).toHaveLength(4);
      expect(panels.entries.map((entry) => entry.appId).sort()).toEqual([
        "nextclaw-personal-organizer-calendar",
        "nextclaw-personal-organizer-favorites",
        "nextclaw-personal-organizer-notes",
        "nextclaw-personal-organizer-todos",
      ]);
      expect(panels.entries.map((entry) => entry.icon).sort()).toEqual([
        "✓",
        "□",
        "◇",
        "✎",
      ].sort());
      expect(panels.entries).toEqual(expect.arrayContaining([
        expect.objectContaining({
          packageId: "nextclaw.personal-organizer",
          sourceKind: "package",
        }),
      ]));
      await expect(kernel.serviceAppManager.listServiceApps()).resolves.toMatchObject({
        entries: [expect.objectContaining({
          id: "nextclaw-personal-organizer-data",
          packageId: "nextclaw.personal-organizer",
          sourceKind: "package",
        })],
      });

      const session = await kernel.panelAppManager.createPanelAppBridgeSession({
        id: "nextclaw-personal-organizer-todos",
      });
      const createAction = "nextclaw-personal-organizer-data.todo_create";
      const listAction = "nextclaw-personal-organizer-data.todo_list";
      await kernel.serviceAppManager.grantServiceActions(
        [createAction, listAction],
        {
          caller: session.caller,
          declaredActions: session.declaredActions,
        },
      );

      const created = await kernel.serviceAppManager.invokeServiceAction(
        createAction,
        {
          caller: session.caller,
          declaredActions: session.declaredActions,
          input: { title: "验证组合包纵向链路" },
        },
      );
      expect(created.result).toMatchObject({
        structuredContent: {
          item: {
            completed: false,
            title: "验证组合包纵向链路",
          },
        },
      });
      expect(existsSync(join(enabledPackage.dataDirectory, "todos.json"))).toBe(true);

      await kernel.appPackageManager.disable("nextclaw.personal-organizer");
      expect(() => kernel.panelAppManager.resolvePanelAppBridgeSession(session.token))
        .toThrowError(expect.objectContaining({
          code: "PANEL_APP_BRIDGE_SESSION_NOT_FOUND",
        }));
      await expect(kernel.panelAppManager.listPanelApps()).resolves.toMatchObject({
        entries: [],
      });

      await kernel.appPackageManager.enable("nextclaw.personal-organizer");
      const restoredSession = await kernel.panelAppManager.createPanelAppBridgeSession({
        id: "nextclaw-personal-organizer-todos",
      });
      const listed = await kernel.serviceAppManager.invokeServiceAction(listAction, {
        caller: restoredSession.caller,
        declaredActions: restoredSession.declaredActions,
        input: { status: "all" },
      });
      expect(listed.result).toMatchObject({
        structuredContent: {
          items: [expect.objectContaining({ title: "验证组合包纵向链路" })],
        },
      });
      expect(JSON.parse(readFileSync(
        join(enabledPackage.dataDirectory, "todos.json"),
        "utf8",
      ))).toMatchObject({
        schemaVersion: 1,
        items: [expect.objectContaining({ title: "验证组合包纵向链路" })],
      });

      const notesSession = await kernel.panelAppManager.createPanelAppBridgeSession({
        id: "nextclaw-personal-organizer-notes",
      });
      const noteSaveAction = "nextclaw-personal-organizer-data.note_save";
      await kernel.serviceAppManager.grantServiceAction(noteSaveAction, {
        caller: notesSession.caller,
        declaredActions: notesSession.declaredActions,
      });
      await expect(kernel.serviceAppManager.invokeServiceAction(noteSaveAction, {
        caller: notesSession.caller,
        declaredActions: notesSession.declaredActions,
        input: {
          id: "../escape",
          title: "路径边界",
          content: "不应写出 notes 目录",
        },
      })).rejects.toThrow("note id is invalid");
      expect(existsSync(join(enabledPackage.dataDirectory, "escape.md"))).toBe(false);

      const openedPanel = await kernel.panelAppManager.recordPanelAppOpened(
        panels.entries.find((entry) =>
          entry.appId === "nextclaw-personal-organizer-todos")?.id ?? "",
      );
      await assertUninstallCleanup({
        dataDirectory: enabledPackage.dataDirectory,
        kernel,
        openedPanelId: openedPanel.id,
        panelsPath: panels.panelsPath,
      });
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  });
});

async function assertUninstallCleanup({
  dataDirectory,
  kernel,
  openedPanelId,
  panelsPath,
}: {
  dataDirectory: string;
  kernel: NextclawKernel;
  openedPanelId: string;
  panelsPath: string;
}): Promise<void> {
  expect(await kernel.serviceAppManager.listServiceActionGrants()).not.toHaveLength(0);
  const uninstalled = await kernel.appPackageManager.uninstall(
    "nextclaw.personal-organizer",
    false,
  );
  expect(uninstalled).toMatchObject({
    dataRemoved: false,
    removedVersions: ["0.1.1"],
  });
  await expect(kernel.serviceAppManager.listServiceActionGrants()).resolves.toEqual([]);
  await expect(kernel.panelAppManager.listPanelApps()).resolves.toMatchObject({ entries: [] });
  await expect(kernel.appPackageManager.getPackage("nextclaw.personal-organizer"))
    .rejects.toMatchObject({ code: "APP_PACKAGE_NOT_FOUND" });
  expect(existsSync(dataDirectory)).toBe(true);
  const storedPanelState = JSON.parse(readFileSync(
    join(panelsPath, ".panel-apps.state.json"),
    "utf8",
  )) as { apps: Record<string, unknown> };
  expect(storedPanelState.apps).not.toHaveProperty(openedPanelId);
}
