import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { CapabilityGrantManager } from "@kernel/features/capability-grants/index.js";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import { PanelAppManager } from "@kernel/managers/panel-app.manager.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-panel-app-deletion-test-"));
  tempDirs.push(dir);
  return dir;
}

function createPanelAppManager(
  workspacePath: string,
  capabilityGrantManager = new CapabilityGrantManager(join(createTempDir(), "capability-grants.json")),
): PanelAppManager {
  const configPath = join(createTempDir(), "config.json");
  saveConfig(ConfigSchema.parse({ agents: { defaults: { workspace: workspacePath } } }), configPath);
  return new PanelAppManager({
    configManager: new ConfigManager({
      configPath,
      channels: { load: vi.fn(), reload: vi.fn() } as never,
      providerManager: { load: vi.fn() } as never,
    }),
    capabilityGrantManager,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("PanelAppManager deletion", () => {
  it("deletes single-file panel apps and clears launcher state", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    const filePath = join(panelsPath, "delete-me.panel.html");
    mkdirSync(panelsPath, { recursive: true });
    writeFileSync(filePath, "<h1>Delete Me</h1>");
    const manager = createPanelAppManager(workspacePath);
    const [entry] = (await manager.listPanelApps()).entries;

    await manager.updatePanelAppPreferences(entry.id, { favorite: true, mainSidebar: true });
    await expect(manager.deletePanelApp(entry.id)).resolves.toEqual({
      deleted: true,
      fileName: "delete-me.panel.html",
      id: entry.id,
    });
    expect(existsSync(filePath)).toBe(false);
    await expect(manager.listPanelApps()).resolves.toEqual({
      workspacePath,
      panelsPath,
      entries: [],
      unavailablePackages: [],
    });
    expect(JSON.parse(readFileSync(join(panelsPath, ".panel-apps.state.json"), "utf8")))
      .toMatchObject({ mainSidebarAppIds: [] });
  });

  it("restores source, launcher state, and grants when deletion fails", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    const filePath = join(panelsPath, "recover-me.panel.html");
    mkdirSync(panelsPath, { recursive: true });
    writeFileSync(filePath, '<meta name="nextclaw-app-id" content="recover-me"><h1>Recover Me</h1>');
    const capabilityGrantManager = new CapabilityGrantManager(join(createTempDir(), "capability-grants.json"));
    const manager = createPanelAppManager(workspacePath, capabilityGrantManager);
    const [entry] = (await manager.listPanelApps()).entries;
    await manager.updatePanelAppPreferences(entry.id, { favorite: true, mainSidebar: true });
    await capabilityGrantManager.grant({
      subject: { type: "panel-app", id: entry.appId },
      resource: { type: "nextclaw.client", target: { appId: entry.appId } },
      access: ["connect"],
      declarationFingerprint: "recover-me-client",
    });
    vi.spyOn(capabilityGrantManager, "revoke").mockImplementationOnce(async (filter) => {
      await capabilityGrantManager.revokeMatching((grant) =>
        grant.subject.type === filter.subject?.type && grant.subject.id === filter.subject?.id,
      );
      throw new Error("revoke failed after write");
    });

    await expect(manager.deletePanelApp(entry.id)).rejects.toThrow("revoke failed after write");
    expect(existsSync(filePath)).toBe(true);
    await expect(manager.listPanelApps()).resolves.toMatchObject({
      entries: [expect.objectContaining({ appId: entry.appId, favorite: true, mainSidebar: true })],
    });
    await expect(capabilityGrantManager.list({ subject: { type: "panel-app", id: entry.appId } }))
      .resolves.toHaveLength(1);
  });

  it("deletes folder panel apps and clears launcher state", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    const appPath = join(panelsPath, "delete-folder.panel");
    mkdirSync(appPath, { recursive: true });
    writeFileSync(
      join(appPath, "panel-app.json"),
      JSON.stringify({ id: "delete-folder", title: "Delete Folder", entry: "index.html" }),
    );
    writeFileSync(join(appPath, "index.html"), "<!doctype html>");
    const manager = createPanelAppManager(workspacePath);
    const [entry] = (await manager.listPanelApps()).entries;

    await manager.updatePanelAppPreferences(entry.id, { favorite: true });
    await expect(manager.deletePanelApp(entry.id)).resolves.toEqual({
      deleted: true,
      fileName: "delete-folder.panel",
      id: entry.id,
    });
    expect(existsSync(appPath)).toBe(false);
    await expect(manager.listPanelApps()).resolves.toEqual({
      workspacePath,
      panelsPath,
      entries: [],
      unavailablePackages: [],
    });
  });
});
