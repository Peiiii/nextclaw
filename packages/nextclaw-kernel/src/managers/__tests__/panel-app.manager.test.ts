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

    expect(content).toEqual(expect.objectContaining({
      id: entry.id,
      fileName: "todo.panel.html",
      contentType: "text/html; charset=utf-8",
      serviceActions: [],
    }));
    expect(content.html).toContain("window.nextclaw");
    expect(content.html).toContain('entry.method === "invoke" ? data.data?.result : data.data');
    expect(content.html).not.toContain("<script src=\"/api/panel-app-bridge.js\"></script>");
    expect(content.html).toContain("<!doctype html><h1>Todo</h1>");
  });

  it("creates bridge sessions with service actions declared by the panel app", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    mkdirSync(panelsPath, { recursive: true });
    writeFileSync(
      join(panelsPath, "todo.panel.html"),
      [
        "<!doctype html>",
        "<html><head>",
        "<meta name=\"nextclaw-panel-actions\" content=\"notes.read notes.write\">",
        "</head><body></body></html>",
      ].join(""),
    );
    const manager = createPanelAppManager(workspacePath);
    const [entry] = (await manager.listPanelApps()).entries;

    const session = await manager.createPanelAppBridgeSession({
      id: entry.id,
      tabId: "tab-1",
    });

    expect(session.panelAppId).toBe(entry.id);
    expect(session.caller).toEqual({ surface: "panel-app", appId: entry.id });
    expect(session.declaredActions).toEqual(["notes.read", "notes.write"]);
    expect(manager.resolvePanelAppBridgeSession(session.token).id).toBe(session.id);
  });

  it("reads lightweight manifest metadata from panel app HTML", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    mkdirSync(panelsPath, { recursive: true });
    writeFileSync(
      join(panelsPath, "tomato.panel.html"),
      [
        "<!doctype html>",
        "<html><head>",
        "<title>Fallback Tomato</title>",
        "<meta name=\"nextclaw-panel-title\" content=\"番茄便签\">",
        "<meta name=\"nextclaw-panel-description\" content=\"轻量番茄钟和任务清单\">",
        "<meta name=\"nextclaw-panel-icon\" content=\"🍅\">",
        "</head><body></body></html>",
      ].join(""),
    );

    const [entry] = (await createPanelAppManager(workspacePath).listPanelApps()).entries;

    expect(entry).toEqual(expect.objectContaining({
      title: "番茄便签",
      description: "轻量番茄钟和任务清单",
      icon: "🍅",
    }));
  });

  it("uses standard favicon links when no panel icon shortcut is declared", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    mkdirSync(panelsPath, { recursive: true });
    writeFileSync(
      join(panelsPath, "iconic.panel.html"),
      [
        "<!doctype html>",
        "<html><head>",
        "<title>Iconic</title>",
        "<link rel=\"icon\" href=\"data:image/svg+xml,%3Csvg%3E%3C/svg%3E\">",
        "</head><body></body></html>",
      ].join(""),
    );

    const [entry] = (await createPanelAppManager(workspacePath).listPanelApps()).entries;

    expect(entry).toEqual(expect.objectContaining({
      title: "Iconic",
      icon: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
    }));
  });

  it("persists favorite and open state for launcher sorting", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    mkdirSync(panelsPath, { recursive: true });
    writeFileSync(join(panelsPath, "alpha.panel.html"), "<h1>Alpha</h1>");
    writeFileSync(join(panelsPath, "zed.panel.html"), "<h1>Zed</h1>");
    const manager = createPanelAppManager(workspacePath);
    const zed = (await manager.listPanelApps()).entries.find((entry) =>
      entry.fileName === "zed.panel.html"
    );

    expect(zed).toBeDefined();
    await manager.updatePanelAppPreferences(zed?.id ?? "", { favorite: true });
    const opened = await manager.recordPanelAppOpened(zed?.id ?? "");
    const refreshed = await manager.listPanelApps();

    expect(opened.favorite).toBe(true);
    expect(opened.openCount).toBe(1);
    expect(opened.lastOpenedAt).toEqual(expect.any(String));
    expect(refreshed.entries[0]).toEqual(expect.objectContaining({
      fileName: "zed.panel.html",
      favorite: true,
      openCount: 1,
    }));
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
