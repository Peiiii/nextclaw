import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import { PanelAppManager } from "@kernel/managers/panel-app.manager.js";
import type { PanelAppError } from "@kernel/managers/panel-app.manager.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-panel-app-manager-test-"));
  tempDirs.push(dir);
  return dir;
}

function createPanelAppManager(workspacePath: string): PanelAppManager {
  const configPath = join(createTempDir(), "config.json");
  saveConfig(
    ConfigSchema.parse({
      agents: {
        defaults: {
          workspace: workspacePath,
        },
      },
    }),
    configPath,
  );
  const configManager = new ConfigManager({
    configPath,
    channels: {
      load: vi.fn(),
      reload: vi.fn(),
    } as never,
    providerManager: {
      load: vi.fn(),
    } as never,
  });
  return new PanelAppManager({ configManager });
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("PanelAppManager", () => {
  it("lists direct single-file panel apps from the NextClaw workspace", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    mkdirSync(panelsPath, { recursive: true });
    mkdirSync(join(panelsPath, "nested"));
    writeFileSync(join(panelsPath, "daily-board.panel.html"), "<h1>Daily</h1>");
    writeFileSync(join(panelsPath, "notes.html"), "<h1>Notes</h1>");
    writeFileSync(join(panelsPath, "nested", "deep.panel.html"), "<h1>Deep</h1>");

    const list = await createPanelAppManager(workspacePath).listPanelApps();

    expect(list.workspacePath).toBe(workspacePath);
    expect(list.panelsPath).toBe(panelsPath);
    expect(list.entries).toHaveLength(1);
    expect(list.entries[0]).toEqual(
      expect.objectContaining({
        fileName: "daily-board.panel.html",
        title: "daily board",
        contentPath: expect.stringMatching(/^\/api\/panel-apps\/.+\/content$/),
      }),
    );
  });

  it("returns panel app HTML content by stable encoded id", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    mkdirSync(panelsPath, { recursive: true });
    writeFileSync(join(panelsPath, "todo.panel.html"), "<!doctype html><h1>Todo</h1>");
    const manager = createPanelAppManager(workspacePath);
    const [entry] = (await manager.listPanelApps()).entries;

    const content = await manager.getPanelAppContent(entry.id);

    expect(content).toEqual({
      id: entry.id,
      fileName: "todo.panel.html",
      html: "<!doctype html><h1>Todo</h1>",
      contentType: "text/html; charset=utf-8",
    });
  });

  it("rejects invalid ids before reading from disk", async () => {
    const workspacePath = createTempDir();
    const manager = createPanelAppManager(workspacePath);

    await expect(manager.getPanelAppContent("not-a-valid-id")).rejects.toMatchObject({
      code: "PANEL_APP_INVALID_ID",
    } satisfies Partial<PanelAppError>);
  });

  it("returns an empty list when the panels directory is not created yet", async () => {
    const workspacePath = createTempDir();

    await expect(createPanelAppManager(workspacePath).listPanelApps()).resolves.toEqual({
      workspacePath,
      panelsPath: join(workspacePath, "panels"),
      entries: [],
    });
  });
});
