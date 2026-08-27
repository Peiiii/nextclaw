import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import {
  AppArtifactValidationService,
  AppBundleService,
  AppHomeService,
  AppInstallationService,
} from "@nextclaw/app-runtime";
import { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { AppPackageOperationManager } from "@kernel/managers/app-package-operation.manager.js";

const tempDirectories: string[] = [];
const builtInAppsDirectory = resolve(
  import.meta.dirname,
  "../../../../nextclaw/resources/apps",
);
const builtInOrganizerVersion = (
  JSON.parse(readFileSync(
    join(builtInAppsDirectory, "nextclaw-personal-organizer", "manifest.json"),
    "utf8",
  )) as { version: string }
).version;

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

async function assertFavoritesServiceActions(kernel: NextclawKernel): Promise<void> {
  const session = await kernel.panelAppManager.createPanelAppBridgeSession({
    id: "nextclaw-personal-organizer-favorites",
  });
  const saveAction = "nextclaw-personal-organizer-data.favorite_save";
  const listAction = "nextclaw-personal-organizer-data.favorite_list";
  await kernel.serviceAppManager.grantServiceActions([saveAction, listAction], {
    caller: session.caller,
    declaredActions: session.declaredActions,
  });
  await kernel.serviceAppManager.invokeServiceAction(saveAction, {
    caller: session.caller,
    declaredActions: session.declaredActions,
    input: { title: "NextClaw", url: "https://nextclaw.io" },
  });
  await expect(kernel.serviceAppManager.invokeServiceAction(listAction, {
    caller: session.caller,
    declaredActions: session.declaredActions,
    input: {},
  })).resolves.toMatchObject({
    result: {
      structuredContent: {
        items: [expect.objectContaining({ title: "NextClaw" })],
      },
    },
  });
}

async function assertCalendarServiceActions(kernel: NextclawKernel): Promise<void> {
  const session = await kernel.panelAppManager.createPanelAppBridgeSession({
    id: "nextclaw-personal-organizer-calendar",
  });
  const createAction = "nextclaw-personal-organizer-data.event_create";
  const listAction = "nextclaw-personal-organizer-data.event_list";
  await kernel.serviceAppManager.grantServiceActions([createAction, listAction], {
    caller: session.caller,
    declaredActions: session.declaredActions,
  });
  await kernel.serviceAppManager.invokeServiceAction(createAction, {
    caller: session.caller,
    declaredActions: session.declaredActions,
    input: {
      start: "2026-08-20T09:00:00.000Z",
      title: "验证日历纵向链路",
    },
  });
  await expect(kernel.serviceAppManager.invokeServiceAction(listAction, {
    caller: session.caller,
    declaredActions: session.declaredActions,
    input: {
      start: "2026-08-20T00:00:00.000Z",
      end: "2026-08-21T00:00:00.000Z",
    },
  })).resolves.toMatchObject({
    result: {
      structuredContent: {
        items: [expect.objectContaining({ title: "验证日历纵向链路" })],
      },
    },
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
  it("keeps package reads pure until startup reconciles built-in packages", async () => {
    const homeDirectory = createTempDirectory();
    const kernel = createKernel(builtInAppsDirectory, homeDirectory);
    const appsPath = join(homeDirectory, "apps");
    const packagePath = join(
      appsPath,
      "packages",
      "nextclaw.personal-organizer",
    );
    try {
      await expect(kernel.appPackageManager.listPackages()).resolves.toMatchObject({
        entries: [],
        hostTarget: expect.objectContaining({
          key: expect.any(String),
          operatingSystem: expect.stringMatching(/^(darwin|linux|win32)$/),
        }),
      });
      expect(existsSync(appsPath)).toBe(false);
      expect(existsSync(packagePath)).toBe(false);

      await kernel.appPackageManager.start();

      await expect(kernel.appPackageManager.listPackages()).resolves.toMatchObject({
        entries: [expect.objectContaining({ id: "nextclaw.personal-organizer" })],
      });
      expect(existsSync(packagePath)).toBe(true);
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  });

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
      await kernel.appPackageManager.start();
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
      await restartedKernel.appPackageManager.start();
      await expect(restartedKernel.appPackageManager.listPackages()).resolves.toMatchObject({
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
      await kernel.appPackageManager.start();
      await expect(kernel.appPackageManager.enable("nextclaw.personal-organizer"))
        .rejects.toMatchObject({ code: "APP_PACKAGE_INCOMPATIBLE" });
      await expect(kernel.appPackageManager.getPackage("nextclaw.personal-organizer"))
        .resolves.toMatchObject({ enabled: false });
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  });

  it("blocks activation when installed package content has been modified", async () => {
    const kernel = createKernel();
    try {
      await kernel.appPackageManager.start();
      const app = await kernel.appPackageManager.getPackage("nextclaw.personal-organizer");
      const componentManifestPath = app.components[0]?.manifestPath;
      expect(componentManifestPath).toBeTruthy();
      chmodSync(componentManifestPath!, 0o600);
      writeFileSync(
        componentManifestPath!,
        `${readFileSync(componentManifestPath!, "utf8")}\n`,
      );

      await expect(kernel.appPackageManager.enable("nextclaw.personal-organizer"))
        .rejects.toThrow("代码完整性校验失败");
      await expect(kernel.appPackageManager.getPackage("nextclaw.personal-organizer"))
        .resolves.toMatchObject({ enabled: false });
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  });

  it("keeps the active version unchanged when a rollback candidate probe fails", async () => {
    const homeDirectory = createTempDirectory();
    const kernel = createKernel(builtInAppsDirectory, homeDirectory);
    const candidateDirectory = createTempDirectory();
    const packageDirectory = join(candidateDirectory, "personal-organizer-next");
    cpSync(join(builtInAppsDirectory, "nextclaw-personal-organizer"), packageDirectory, {
      recursive: true,
    });
    const manifestPath = join(packageDirectory, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    const candidateVersion = "0.1.99";
    manifest.version = candidateVersion;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    try {
      await kernel.appPackageManager.start();
      await new AppInstallationService(new AppHomeService(join(homeDirectory, "apps"))).install(
        packageDirectory,
        {
          trustedPublisher: {
            id: "nextclaw",
            name: "NextClaw",
            url: "https://nextclaw.io",
          },
        },
      );
      await kernel.appPackageManager.enable("nextclaw.personal-organizer");
      kernel.appPackageManager.installRuntimeHooks({
        assertCanActivate: async (sources) => {
          if (sources[0]?.packageVersion === builtInOrganizerVersion) {
            throw new Error("candidate probe failed");
          }
        },
        beforeDeactivate: async () => undefined,
        beforeUninstall: async () => undefined,
      });

      await expect(kernel.appPackageManager.rollback(
        "nextclaw.personal-organizer",
        builtInOrganizerVersion,
      )).rejects.toThrow("candidate probe failed");
      await expect(kernel.appPackageManager.getPackage("nextclaw.personal-organizer"))
        .resolves.toMatchObject({ activeVersion: candidateVersion });
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  });

});

describe("AppPackageManager packed artifact lifecycle", () => {
  it("runs a packed napp through failed update recovery and preserved-data uninstall", async () => {
    const fixture = await PackedOrganizerRegistryFixture.create(createTempDirectory());
    const kernel = createKernel(fixture.emptyBuiltInsDirectory);

    try {
      const installed = await kernel.appPackageManager.install(
        "nextclaw.personal-organizer",
        fixture.registryUrl,
      );
      expect(installed).toMatchObject({ activeVersion: "0.1.0", enabled: false });
      const enabled = await kernel.appPackageManager.enable(installed.id);
      const session = await kernel.panelAppManager.createPanelAppBridgeSession({
        id: "nextclaw-personal-organizer-todos",
      });
      const createAction = "nextclaw-personal-organizer-data.todo_create";
      const listAction = "nextclaw-personal-organizer-data.todo_list";
      await kernel.serviceAppManager.grantServiceActions([createAction, listAction], {
        caller: session.caller,
        declaredActions: session.declaredActions,
      });
      await kernel.serviceAppManager.invokeServiceAction(createAction, {
        caller: session.caller,
        declaredActions: session.declaredActions,
        input: { title: "真实 napp 生命周期" },
      });
      const dataDirectory = enabled.dataDirectory;
      expect(existsSync(join(dataDirectory, "todos.json"))).toBe(true);

      fixture.setLatestVersion("0.2.0");
      await expect(kernel.appPackageManager.update(installed.id, {
        registryUrl: fixture.registryUrl,
      }))
        .rejects.toThrow(/启动探测失败|missing-candidate-runtime/);
      await expect(kernel.appPackageManager.getPackage(installed.id)).resolves.toMatchObject({
        activeVersion: "0.1.0",
        enabled: true,
        installedVersions: expect.arrayContaining(["0.1.0", "0.2.0"]),
      });
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
          items: [expect.objectContaining({ title: "真实 napp 生命周期" })],
        },
      });

      await expect(kernel.appPackageManager.uninstall(installed.id, false)).resolves.toMatchObject({
        dataRemoved: false,
        removedVersions: expect.arrayContaining(["0.1.0", "0.2.0"]),
      });
      expect(existsSync(join(dataDirectory, "todos.json"))).toBe(true);
    } finally {
      await kernel.serviceAppManager.dispose();
      await fixture.close();
    }
  }, 20_000);
});

describe("AppPackageManager package projection lifecycle", () => {
  it("keeps workspace panels available when an enabled package fails integrity checks", async () => {
    const homeDirectory = createTempDirectory();
    const kernel = createKernel(builtInAppsDirectory, homeDirectory);
    try {
      await kernel.appPackageManager.start();
      const appPackage = await kernel.appPackageManager.enable("nextclaw.personal-organizer");
      const manifestPath = appPackage.components[0]?.manifestPath;
      if (!manifestPath) throw new Error("package panel fixture is unavailable");
      chmodSync(manifestPath, 0o600);
      writeFileSync(manifestPath, "{ invalid");

      const workspacePanelPath = join(
        "workspace",
        "panels",
        "healthy.panel.html",
      );
      const workspacePanelFile = join(homeDirectory, workspacePanelPath);
      mkdirSync(join(workspacePanelFile, ".."), { recursive: true });
      writeFileSync(workspacePanelFile, "<title>Healthy Panel</title>");

      await expect(kernel.panelAppManager.listPanelApps()).resolves.toMatchObject({
        entries: [expect.objectContaining({ title: "Healthy Panel" })],
        unavailablePackages: [expect.objectContaining({ appId: "nextclaw.personal-organizer" })],
      });
    } finally {
      await kernel.serviceAppManager.dispose();
    }
  });

  it("projects the official package into panel and service runtimes with stable data", async () => {
    const kernel = createKernel();

    try {
      await kernel.appPackageManager.start();
      const initialPackages = await kernel.appPackageManager.listPackages();
      expect(initialPackages.entries).toEqual([
        expect.objectContaining({
          activeVersion: builtInOrganizerVersion,
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
      const panelIcons = panels.entries.map((entry) => entry.icon);
      expect(panelIcons).toEqual(expect.arrayContaining(["◇", "✎"]));
      expect(panelIcons.filter((icon) => icon?.includes("/assets/icon.svg"))).toHaveLength(2);
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

      await assertFavoritesServiceActions(kernel);
      await assertCalendarServiceActions(kernel);

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

type OrganizerFixtureVersion = "0.1.0" | "0.2.0";

class PackedOrganizerRegistryFixture {
  private latestVersion: OrganizerFixtureVersion = "0.1.0";
  private readonly server: ReturnType<typeof createServer>;
  private registryUrlValue = "";

  private constructor(
    readonly emptyBuiltInsDirectory: string,
    private readonly bundles: Record<OrganizerFixtureVersion, Buffer>,
  ) {
    this.server = createServer((request, response) => this.handleRequest(request, response));
  }

  static create = async (fixtureDirectory: string): Promise<PackedOrganizerRegistryFixture> => {
    const emptyBuiltInsDirectory = join(fixtureDirectory, "built-ins");
    mkdirSync(emptyBuiltInsDirectory);
    const bundles = {
      "0.1.0": await packOrganizerVersion(fixtureDirectory, "0.1.0", false),
      "0.2.0": await packOrganizerVersion(fixtureDirectory, "0.2.0", true),
    };
    await expect(new AppArtifactValidationService().validate({
      bytes: new Uint8Array(bundles["0.1.0"]),
    })).resolves.toMatchObject({
      metadata: {
        appId: "nextclaw.personal-organizer",
        version: "0.1.0",
      },
    });
    const fixture = new PackedOrganizerRegistryFixture(emptyBuiltInsDirectory, bundles);
    await fixture.listen();
    return fixture;
  };

  get registryUrl(): string {
    return this.registryUrlValue;
  }

  setLatestVersion = (version: OrganizerFixtureVersion): void => {
    this.latestVersion = version;
  };

  close = async (): Promise<void> => {
    await new Promise<void>((resolveClose, rejectClose) => {
      this.server.close((error) => error ? rejectClose(error) : resolveClose());
    });
  };

  private listen = async (): Promise<void> => {
    await new Promise<void>((resolveListen) => {
      this.server.listen(0, "127.0.0.1", resolveListen);
    });
    const address = this.server.address();
    if (!address || typeof address === "string") {
      throw new Error("test registry address unavailable");
    }
    this.registryUrlValue = `http://127.0.0.1:${address.port}/`;
  };

  private handleRequest = (request: IncomingMessage, response: ServerResponse): void => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/nextclaw.personal-organizer") {
      this.respondWithMetadata(response);
      return;
    }
    const version = requestUrl.pathname.match(/^\/-\/organizer-(0\.[12]\.0)\.napp$/)?.[1];
    const bundle = version
      ? this.bundles[version as OrganizerFixtureVersion]
      : undefined;
    if (bundle) {
      response.setHeader("content-type", "application/octet-stream");
      response.end(bundle);
      return;
    }
    response.writeHead(404).end();
  };

  private respondWithMetadata = (response: ServerResponse): void => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({
      name: "nextclaw.personal-organizer",
      "dist-tags": { latest: this.latestVersion },
      versions: {
        "0.1.0": this.createVersionRecord("0.1.0"),
        "0.2.0": this.createVersionRecord("0.2.0"),
      },
    }));
  };

  private createVersionRecord = (version: OrganizerFixtureVersion): Record<string, unknown> => ({
    name: "nextclaw.personal-organizer",
    version,
    publisher: {
      id: "nextclaw",
      name: "NextClaw",
      url: "https://nextclaw.io",
    },
    dist: {
      kind: "bundle",
      bundle: `./-/organizer-${version}.napp`,
      sha256: createHash("sha256").update(this.bundles[version]).digest("hex"),
    },
  });
}

async function packOrganizerVersion(
  fixtureDirectory: string,
  version: OrganizerFixtureVersion,
  brokenRuntime: boolean,
): Promise<Buffer> {
  const packageDirectory = join(fixtureDirectory, `source-${version}`);
  const bundlePath = join(fixtureDirectory, `organizer-${version}.napp`);
  cpSync(join(builtInAppsDirectory, "nextclaw-personal-organizer"), packageDirectory, {
    recursive: true,
  });
  writePackageVersion(packageDirectory, version);
  if (brokenRuntime) {
    breakOrganizerRuntime(packageDirectory);
  }
  await new AppBundleService().packAppDirectory({ appDirectory: packageDirectory, outputPath: bundlePath });
  return readFileSync(bundlePath);
}

function breakOrganizerRuntime(packageDirectory: string): void {
  const manifestPath = join(
    packageDirectory,
    "service-components/nextclaw-personal-organizer-data/service-app.json",
  );
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  manifest.args = ["missing-candidate-runtime.mjs"];
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function writePackageVersion(packageDirectory: string, version: string): void {
  const manifestPath = join(packageDirectory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
  manifest.version = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

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
    removedVersions: [builtInOrganizerVersion],
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
