import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppScaffoldService } from "#app-runtime/services/app-scaffold.service.js";
import { AppPublishService } from "./app-publish.service.js";
import type { PlatformAuthStateService } from "./platform-auth-state.service.js";

describe("AppPublishService", () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
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

  it("packs an app and publishes marketplace payload", async () => {
    const workspaceDirectory = await mkdtemp(path.join(tmpdir(), "napp-publish-app-"));
    const appDirectory = path.join(workspaceDirectory, "app");
    cleanupPaths.push(workspaceDirectory);
    await new AppScaffoldService().scaffold(appDirectory);
    const readmePath = path.join(appDirectory, "README.md");
    const readmeContent = await readFile(readmePath, "utf-8");

    const publish = vi.fn().mockResolvedValue({
      created: true,
      item: {
        slug: "app",
        appId: "nextclaw.app",
        name: "App",
        latestVersion: "0.1.0",
        webUrl: "https://apps.nextclaw.io/apps/app",
        install: {
          kind: "registry",
          spec: "nextclaw.app",
          registry: "https://apps-registry.nextclaw.io/api/v1/apps/registry/",
        },
      },
      distribution: {
        path: "",
        sha256: "",
        mode: "source",
      },
      fileCount: 2,
    });
    const service = new AppPublishService(
      undefined,
      undefined,
      undefined,
      {
        publish,
      } as never,
      {
        readCurrentAuthState: () => ({
          token: "user-token",
          apiBaseUrl: "https://ai-gateway-api.nextclaw.io/v1",
        }),
      } as PlatformAuthStateService,
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          user: {
            id: "user-1",
            username: "alice",
            role: "user",
          },
        },
      }),
    }));

    const result = await service.publish({
      appDirectory,
    });

    expect(result.item.appId).toBe("nextclaw.app");
    expect(result.item.webUrl).toBe("https://apps.nextclaw.io/apps/app");
    expect(result.distribution.sha256).toHaveLength(64);
    expect(result.distribution.mode).toBe("source");
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]?.[0]).toMatchObject({
      payload: {
        appId: "nextclaw.app",
        slug: "app",
        distributionMode: "source",
        publisher: {
          id: "alice",
          name: "alice",
        },
        files: [
          expect.objectContaining({
            path: "marketplace.json",
          }),
          expect.objectContaining({
            path: "README.md",
            contentBase64: Buffer.from(readmeContent).toString("base64"),
          }),
          expect.objectContaining({
            path: "assets/icon.svg",
          }),
        ],
      },
    });
  });

  it("publishes ts-http manifests with wasi-http-component main", async () => {
    const workspaceDirectory = await mkdtemp(path.join(tmpdir(), "napp-publish-ts-http-"));
    const appDirectory = path.join(workspaceDirectory, "todo-app");
    cleanupPaths.push(workspaceDirectory);
    await new AppScaffoldService().scaffold(appDirectory, { template: "ts-http" });

    const publish = vi.fn().mockResolvedValue({
      created: true,
      item: {
        slug: "todo-app",
        appId: "nextclaw.todo-app",
        name: "Todo App",
        latestVersion: "0.1.0",
        install: {
          kind: "registry",
          spec: "nextclaw.todo-app",
          registry: "https://apps-registry.nextclaw.io/api/v1/apps/registry/",
        },
      },
      distribution: {
        path: "",
        sha256: "",
        mode: "source",
      },
      fileCount: 2,
    });
    const service = new AppPublishService(
      undefined,
      undefined,
      undefined,
      {
        publish,
      } as never,
      {
        readCurrentAuthState: () => ({
          token: "user-token",
          apiBaseUrl: "https://ai-gateway-api.nextclaw.io/v1",
        }),
      } as PlatformAuthStateService,
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          user: {
            id: "user-1",
            username: "alice",
            role: "user",
          },
        },
      }),
    }));

    await service.publish({
      appDirectory,
    });

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0]?.[0]).toMatchObject({
      payload: {
        appId: "nextclaw.todo-app",
        distributionMode: "source",
        manifest: {
          main: {
            kind: "wasi-http-component",
            entry: "main/app.wasm",
          },
        },
      },
    });
    expect(publish.mock.calls[0]?.[0]?.payload.manifest.main).not.toHaveProperty("export");
    expect(publish.mock.calls[0]?.[0]?.payload.manifest.main).not.toHaveProperty("action");
  });

});

describe("AppPublishService bundle mode", () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
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

  it("allows explicit bundle publishing mode", async () => {
    const workspaceDirectory = await mkdtemp(path.join(tmpdir(), "napp-publish-bundle-"));
    const appDirectory = path.join(workspaceDirectory, "todo-app");
    cleanupPaths.push(workspaceDirectory);
    await new AppScaffoldService().scaffold(appDirectory);

    const publish = vi.fn().mockResolvedValue({
      created: true,
      item: {
        slug: "todo-app",
        appId: "nextclaw.todo-app",
        name: "Todo App",
        latestVersion: "0.1.0",
        install: {
          kind: "registry",
          spec: "nextclaw.todo-app",
          registry: "https://apps-registry.nextclaw.io/api/v1/apps/registry/",
        },
      },
      distribution: {
        path: "",
        sha256: "",
        mode: "bundle",
      },
      fileCount: 2,
    });
    const service = new AppPublishService(
      undefined,
      undefined,
      undefined,
      {
        publish,
      } as never,
      {
        readCurrentAuthState: () => ({
          token: "user-token",
          apiBaseUrl: "https://ai-gateway-api.nextclaw.io/v1",
        }),
      } as PlatformAuthStateService,
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          user: {
            id: "user-1",
            username: "alice",
            role: "user",
          },
        },
      }),
    }));

    const result = await service.publish({
      appDirectory,
      mode: "bundle",
    });

    expect(result.distribution.mode).toBe("bundle");
    expect(publish.mock.calls[0]?.[0]?.payload.distributionMode).toBe("bundle");
  });

  it("publishes schema v2 component apps as bundles by default", async () => {
    const appDirectory = path.resolve(
      import.meta.dirname,
      "../../../nextclaw/resources/apps/nextclaw-personal-organizer",
    );
    const outputDirectory = await mkdtemp(path.join(tmpdir(), "napp-publish-component-app-"));
    cleanupPaths.push(outputDirectory);
    const publish = vi.fn().mockResolvedValue({
      created: true,
      item: {
        slug: "personal-organizer",
        appId: "nextclaw.personal-organizer",
        name: "个人空间",
        latestVersion: "0.1.0",
        install: {
          kind: "registry",
          spec: "nextclaw.personal-organizer",
          registry: "https://apps-registry.nextclaw.io/api/v1/apps/registry/",
        },
      },
      fileCount: 2,
    });
    const service = new AppPublishService(
      undefined,
      undefined,
      undefined,
      { publish } as never,
      {
        readCurrentAuthState: () => ({
          token: "admin-token",
          apiBaseUrl: "https://ai-gateway-api.nextclaw.io/v1",
        }),
      } as PlatformAuthStateService,
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          user: {
            id: "admin-1",
            username: "nextclaw-admin",
            role: "admin",
          },
        },
      }),
    }));

    const result = await service.publish({
      appDirectory,
      bundleOutputPath: path.join(outputDirectory, "artifact.napp"),
    });

    expect(result.distribution.mode).toBe("bundle");
    expect(publish.mock.calls[0]?.[0]).toMatchObject({
      payload: {
        appId: "nextclaw.personal-organizer",
        distributionMode: "bundle",
        visuals: {
          cover: "marketplace-assets/cover.webp",
          accentColor: "#74816B",
        },
        files: expect.arrayContaining([
          expect.objectContaining({ path: "marketplace-assets/cover.webp" }),
        ]),
        manifest: {
          schemaVersion: 2,
          components: expect.arrayContaining([
            expect.objectContaining({ kind: "panel" }),
            expect.objectContaining({ kind: "service" }),
          ]),
        },
      },
    });
  });

});
