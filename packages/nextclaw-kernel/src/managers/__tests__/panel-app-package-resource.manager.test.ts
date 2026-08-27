import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import { PanelAppManager } from "@kernel/managers/panel-app.manager.js";
import { CapabilityGrantManager } from "@kernel/features/capability-grants/index.js";
import type { AppPackageComponentSource } from "@kernel/types/app-package.types.js";
import type { PanelAppError } from "@kernel/types/panel-app.types.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-panel-package-resource-test-"));
  tempDirs.push(directory);
  return directory;
}

function createPackagePanelComponent(sourcePath: string): AppPackageComponentSource {
  const instanceDirectory = join(dirname(sourcePath), "instance");
  return {
    kind: "panel",
    id: "stable-panel",
    packageId: "publisher.demo-package",
    packageVersion: "1.0.0",
    sourcePath,
    manifestPath: join(sourcePath, "panel-app.json"),
    dataDirectory: join(instanceDirectory, "data"),
    instanceId: "default",
    storage: {
      layout: "instance-v1",
      layoutVersion: 1,
      instanceId: "default",
      instanceDirectory,
      dataDirectory: join(instanceDirectory, "data"),
      configDirectory: join(instanceDirectory, "config"),
      stateDirectory: join(instanceDirectory, "state"),
      cacheDirectory: join(instanceDirectory, "cache"),
      temporaryDirectory: join(instanceDirectory, "temporary"),
      logsDirectory: join(instanceDirectory, "logs"),
    },
    runtimeProfile: "panel-only",
    isolation: "sandboxed",
  };
}

function createManager(
  workspacePath: string,
  listPackageComponentSources: () => Promise<AppPackageComponentSource[]>,
): PanelAppManager {
  const configPath = join(createTempDir(), "config.json");
  saveConfig(ConfigSchema.parse({
    agents: { defaults: { workspace: workspacePath } },
  }), configPath);
  return new PanelAppManager({
    configManager: new ConfigManager({
      configPath,
      channels: { load: vi.fn(), reload: vi.fn() } as never,
      providerManager: { load: vi.fn() } as never,
    }),
    listPackageComponentSources,
    capabilityGrantManager: new CapabilityGrantManager(
      join(createTempDir(), "capability-grants.json"),
    ),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("PanelAppManager package resources", () => {
  it("restores an active package panel by stable and legacy resource ids", async () => {
    const workspacePath = createTempDir();
    const packagePath = join(createTempDir(), "stable-panel.panel");
    mkdirSync(packagePath, { recursive: true });
    writeFileSync(join(packagePath, "panel-app.json"), JSON.stringify({
      id: "stable-panel",
      title: "Stable Panel",
      entry: "index.html",
    }));
    writeFileSync(join(packagePath, "index.html"), "<!doctype html><h1>Package Panel</h1>");
    const packageComponent = createPackagePanelComponent(packagePath);
    let activeComponents = [packageComponent];
    const manager = createManager(workspacePath, async () => activeComponents);

    const [entry] = (await manager.listPanelApps()).entries;

    expect(entry).toEqual(expect.objectContaining({
      appId: "stable-panel",
      contentPath: "/api/panel-apps/stable-panel/content",
      mainSidebar: false,
      sourceKind: "package",
    }));
    await manager.updatePanelAppPreferences(entry.id, { mainSidebar: true });
    expect(entry.contentPath).not.toContain("path=");
    await expect(manager.getPanelAppContent(entry.appId)).resolves.toEqual(expect.objectContaining({
      appId: "stable-panel",
      html: expect.stringContaining("Package Panel"),
    }));
    await expect(manager.getPanelAppContent(entry.id)).resolves.toEqual(expect.objectContaining({
      appId: "stable-panel",
    }));

    activeComponents = [];
    await expect(manager.listPanelApps()).resolves.toMatchObject({ entries: [] });
    await expect(manager.getPanelAppContent(entry.appId)).rejects.toMatchObject({
      code: "PANEL_APP_NOT_FOUND",
    } satisfies Partial<PanelAppError>);

    activeComponents = [packageComponent];
    await expect(manager.listPanelApps()).resolves.toMatchObject({
      entries: [expect.objectContaining({
        appId: "stable-panel",
        mainSidebar: true,
        mainSidebarOrder: 0,
      })],
    });
    await expect(manager.getPanelAppContent(entry.appId)).resolves.toEqual(expect.objectContaining({
      appId: "stable-panel",
    }));

    await manager.removePackageComponentState([packageComponent]);
    await expect(manager.listPanelApps()).resolves.toMatchObject({
      entries: [expect.objectContaining({
        appId: "stable-panel",
        mainSidebar: false,
      })],
    });
  });
});
