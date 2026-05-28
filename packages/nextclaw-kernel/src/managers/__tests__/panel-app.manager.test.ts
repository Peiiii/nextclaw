import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { NcpEventType } from "@nextclaw/ncp";
import { ConfigManager } from "@kernel/managers/config.manager.js";
import { PanelAppManager } from "@kernel/managers/panel-app.manager.js";
import type { PanelAppError } from "@kernel/types/panel-app.types.js";
import { STRUCTURED_RESULT_TOOL_NAME } from "@kernel/tools/structured-result.tools.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-panel-app-manager-test-"));
  tempDirs.push(dir);
  return dir;
}

function createPanelAppManager(
  workspacePath: string,
  options: {
    agentRunClient?: ConstructorParameters<typeof PanelAppManager>[0]["agentRunClient"];
  } = {},
): PanelAppManager {
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
  return new PanelAppManager({ configManager, agentRunClient: options.agentRunClient });
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

  it("lists folder panel apps from manifest directories", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    const appPath = join(panelsPath, "markdown-manager.panel");
    mkdirSync(appPath, { recursive: true });
    mkdirSync(join(panelsPath, "creating.panel"));
    writeFileSync(join(appPath, "index.html"), "<!doctype html><h1>Markdown</h1>");
    writeFileSync(join(appPath, "panel-app.json"), JSON.stringify({
      id: "markdown-manager",
      title: "Markdown 管理器",
      description: "整理本地 Markdown",
      icon: "assets/icon.svg",
      entry: "index.html",
      capabilities: ["agent:generateObject"],
      actions: ["workspace-files.list"],
    }));

    const list = await createPanelAppManager(workspacePath).listPanelApps();

    expect(list.entries).toHaveLength(1);
    expect(list.entries[0]).toEqual(expect.objectContaining({
      fileName: "markdown-manager.panel",
      kind: "folder",
      title: "Markdown 管理器",
      description: "整理本地 Markdown",
      icon: expect.stringMatching(/^\/api\/panel-apps\/.+\/assets\/assets\/icon\.svg$/),
      contentPath: expect.stringMatching(/^\/api\/panel-apps\/.+\/content$/),
    }));
  });

  it("uses the folder name as panel app id when manifest id is omitted", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    const appPath = join(panelsPath, "nav-directory.panel");
    mkdirSync(appPath, { recursive: true });
    writeFileSync(join(appPath, "index.html"), "<!doctype html><h1>Navigation</h1>");
    writeFileSync(join(appPath, "panel-app.json"), JSON.stringify({
      version: 1,
      title: "个人导航站",
      description: "按分类管理你的常用链接目录",
      icon: "🗂️",
      entry: "index.html",
      files: ["index.html", "styles.css", "app.js"],
    }));

    const [entry] = (await createPanelAppManager(workspacePath).listPanelApps()).entries;

    expect(entry).toEqual(expect.objectContaining({
      fileName: "nav-directory.panel",
      kind: "folder",
      title: "个人导航站",
      description: "按分类管理你的常用链接目录",
      icon: "🗂️",
    }));
  });

  it("rejects folder manifests whose explicit id does not match the directory name", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    const appPath = join(panelsPath, "real-name.panel");
    mkdirSync(appPath, { recursive: true });
    writeFileSync(join(appPath, "index.html"), "<!doctype html>");
    writeFileSync(join(appPath, "panel-app.json"), JSON.stringify({
      id: "other-name",
      title: "Mismatch",
      entry: "index.html",
    }));

    await expect(createPanelAppManager(workspacePath).listPanelApps()).rejects.toMatchObject({
      code: "PANEL_APP_MANIFEST_INVALID",
    } satisfies Partial<PanelAppError>);
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
      capabilities: [],
      contentType: "text/html; charset=utf-8",
      serviceActions: [],
    }));
    expect(content.html).toContain("window.nextclaw");
    expect(content.html).toContain('entry.method === "invoke" || entry.method === "agent.generateObject"');
    expect(content.html).not.toContain("<script src=\"/api/panel-app-bridge.js\"></script>");
    expect(content.html).toContain("<!doctype html><h1>Todo</h1>");
  });

  it("returns folder panel app HTML content with asset base and bridge injection", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    const appPath = join(panelsPath, "folder-demo.panel");
    mkdirSync(appPath, { recursive: true });
    writeFileSync(
      join(appPath, "panel-app.json"),
      JSON.stringify({
        id: "folder-demo",
        title: "Folder Demo",
        entry: "index.html",
        capabilities: ["agent:send"],
        actions: ["demo.run"],
      }),
    );
    writeFileSync(
      join(appPath, "index.html"),
      "<!doctype html><html><head><script src=\"app.js\"></script></head><body></body></html>",
    );
    const manager = createPanelAppManager(workspacePath);
    const [entry] = (await manager.listPanelApps()).entries;

    const content = await manager.getPanelAppContent(entry.id);

    expect(content).toEqual(expect.objectContaining({
      id: entry.id,
      fileName: "folder-demo.panel",
      capabilities: ["agent:send"],
      serviceActions: ["demo.run"],
    }));
    expect(content.html).toContain(`<base href="/api/panel-apps/${encodeURIComponent(entry.id)}/assets/">`);
    expect(content.html).toContain("window.nextclaw");
    expect(content.html).toContain("<script src=\"app.js\"></script>");
  });

  it("serves folder panel app assets and rejects traversal", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    const appPath = join(panelsPath, "asset-demo.panel");
    mkdirSync(appPath, { recursive: true });
    writeFileSync(
      join(appPath, "panel-app.json"),
      JSON.stringify({ id: "asset-demo", title: "Asset Demo", entry: "index.html" }),
    );
    writeFileSync(join(appPath, "index.html"), "<!doctype html>");
    writeFileSync(join(appPath, "app.js"), "window.loaded = true;");
    const manager = createPanelAppManager(workspacePath);
    const [entry] = (await manager.listPanelApps()).entries;

    await expect(manager.getPanelAppAsset(entry.id, "app.js")).resolves.toEqual({
      content: Buffer.from("window.loaded = true;"),
      contentType: "application/javascript; charset=utf-8",
    });
    await expect(manager.getPanelAppAsset(entry.id, "../secret.txt")).rejects.toMatchObject({
      code: "PANEL_APP_INVALID_ASSET_PATH",
    } satisfies Partial<PanelAppError>);
  });

  it("creates bridge sessions with declared service actions and agent capabilities", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    mkdirSync(panelsPath, { recursive: true });
    writeFileSync(
      join(panelsPath, "todo.panel.html"),
      [
        "<!doctype html>",
        "<html><head>",
        "<meta name=\"nextclaw-panel-actions\" content=\"notes.read notes.write\">",
        "<meta name=\"nextclaw-panel-capabilities\" content=\"agent:send agent:generateObject\">",
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
    expect(session.declaredCapabilities).toEqual(["agent:send", "agent:generateObject"]);
    expect(session.declaredActions).toEqual(["notes.read", "notes.write"]);
    expect(manager.resolvePanelAppBridgeSession(session.token).id).toBe(session.id);
  });
});

describe("PanelAppManager agent bridge", () => {
  it("sends panel app agent messages only after the declared capability is granted", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    const send = vi.fn().mockResolvedValue({
      runId: "run-1",
      sessionId: "session-1",
      userMessageId: "message-1",
    });
    mkdirSync(panelsPath, { recursive: true });
    writeFileSync(
      join(panelsPath, "sender.panel.html"),
      "<meta name=\"nextclaw-panel-capabilities\" content=\"agent:send\">",
    );
    const manager = createPanelAppManager(workspacePath, {
      agentRunClient: {
        send,
        sendAndStreamEvents: vi.fn(),
      },
    });
    const [entry] = (await manager.listPanelApps()).entries;
    const session = await manager.createPanelAppBridgeSession({
      id: entry.id,
      tabId: "tab-1",
    });

    await expect(manager.sendAgentMessage(session.token, {
      content: [{ type: "text", text: "hello" }],
    })).rejects.toMatchObject({ code: "AUTHORIZATION_REQUIRED" });

    await manager.grantAgentCapability(session.token, "agent:send");
    await expect(manager.sendAgentMessage(session.token, {
      content: [{ type: "text", text: "hello" }],
      peerId: "sender-thread",
    })).resolves.toEqual(expect.objectContaining({ sessionId: "session-1" }));
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      content: [{ type: "text", text: "hello" }],
      peerId: "sender-thread",
      metadata: expect.objectContaining({
        agent_peer_scope: `panel-app:${entry.id}`,
        panel_app_id: entry.id,
        panel_app_peer_id: "sender-thread",
        source_kind: "panel_app",
      }),
    }));
  });

  it("explains invalid agent capability declarations", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    mkdirSync(panelsPath, { recursive: true });
    writeFileSync(
      join(panelsPath, "wrong-capability.panel.html"),
      "<meta name=\"nextclaw-panel-capabilities\" content=\"agent.generateObject\">",
    );
    const manager = createPanelAppManager(workspacePath, {
      agentRunClient: {
        send: vi.fn(),
        sendAndStreamEvents: vi.fn(),
      },
    });
    const [entry] = (await manager.listPanelApps()).entries;
    const session = await manager.createPanelAppBridgeSession({
      id: entry.id,
      tabId: "tab-1",
    });

    await expect(manager.generateAgentObject(session.token, {
      peerId: "concept-map",
      prompt: "Explore it",
      schema: { type: "object" },
    })).rejects.toMatchObject({
      code: "PANEL_APP_CAPABILITY_NOT_DECLARED",
      message: expect.stringContaining("Use agent:generateObject, not agent.generateObject."),
    } satisfies Partial<PanelAppError>);
  });

  it("uses the structured result tool to resolve generateObject", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    let sentPayload: unknown;
    const sendAndStreamEvents = vi.fn(async function* (payload) {
      sentPayload = payload;
      yield {
        type: NcpEventType.MessageToolCallStart,
        payload: {
          sessionId: "session-1",
          toolCallId: "tool-1",
          toolName: STRUCTURED_RESULT_TOOL_NAME,
        },
      };
      yield {
        type: NcpEventType.MessageToolCallResult,
        payload: {
          sessionId: "session-1",
          toolCallId: "tool-1",
          content: { answer: 42 },
        },
      };
    });
    mkdirSync(panelsPath, { recursive: true });
    writeFileSync(
      join(panelsPath, "object.panel.html"),
      "<meta name=\"nextclaw-panel-capabilities\" content=\"agent:generateObject\">",
    );
    const manager = createPanelAppManager(workspacePath, {
      agentRunClient: {
        send: vi.fn(),
        sendAndStreamEvents,
      },
    });
    const [entry] = (await manager.listPanelApps()).entries;
    const session = await manager.createPanelAppBridgeSession({
      id: entry.id,
      tabId: "tab-1",
    });
    await manager.grantAgentCapability(session.token, "agent:generateObject");

    await expect(manager.generateAgentObject(session.token, {
      peerId: "mood-summary",
      prompt: "Summarize it",
      schema: {
        type: "object",
        properties: { answer: { type: "number" } },
        required: ["answer"],
      },
      context: { mood: "good" },
    })).resolves.toEqual({ result: { answer: 42 } });
    const sentRecord = sentPayload as Record<string, unknown>;
    const sentMessage = sentRecord.message as Record<string, unknown>;
    expect(sentPayload).toEqual(expect.objectContaining({
      peerId: "mood-summary",
      message: expect.objectContaining({
        metadata: expect.objectContaining({
          agent_peer_scope: `panel-app:${entry.id}`,
          panel_app_id: entry.id,
          panel_app_peer_id: "mood-summary",
          structured_result: expect.objectContaining({
            tool_name: STRUCTURED_RESULT_TOOL_NAME,
          }),
        }),
      }),
    }));
    expect(sentRecord).not.toHaveProperty("sessionId");
    expect(sentMessage).not.toHaveProperty("sessionId");
  });
});

describe("PanelAppManager metadata and state", () => {
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

  it("uses the latest created, opened, or modified timestamp for launcher sorting", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    mkdirSync(panelsPath, { recursive: true });
    const oldFavoritePath = join(panelsPath, "old-favorite.panel.html");
    const recentlyModifiedPath = join(panelsPath, "recently-modified.panel.html");
    writeFileSync(oldFavoritePath, "<h1>Old Favorite</h1>");
    writeFileSync(recentlyModifiedPath, "<h1>Recently Modified</h1>");
    utimesSync(
      oldFavoritePath,
      new Date("2026-01-01T00:00:00.000Z"),
      new Date("2026-01-01T00:00:00.000Z"),
    );
    utimesSync(
      recentlyModifiedPath,
      new Date("2030-01-01T00:00:00.000Z"),
      new Date("2030-01-01T00:00:00.000Z"),
    );
    const manager = createPanelAppManager(workspacePath);
    const oldFavorite = (await manager.listPanelApps()).entries.find((entry) =>
      entry.fileName === "old-favorite.panel.html"
    );

    expect(oldFavorite).toBeDefined();
    await manager.updatePanelAppPreferences(oldFavorite?.id ?? "", { favorite: true });
    const refreshed = await manager.listPanelApps();

    expect(refreshed.entries[0]).toEqual(expect.objectContaining({
      fileName: "recently-modified.panel.html",
      updatedAt: "2030-01-01T00:00:00.000Z",
    }));
  });

  it("deletes panel app files and clears launcher state", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    const filePath = join(panelsPath, "delete-me.panel.html");
    mkdirSync(panelsPath, { recursive: true });
    writeFileSync(filePath, "<h1>Delete Me</h1>");
    const manager = createPanelAppManager(workspacePath);
    const [entry] = (await manager.listPanelApps()).entries;

    await manager.updatePanelAppPreferences(entry.id, { favorite: true });
    const result = await manager.deletePanelApp(entry.id);

    expect(result).toEqual({
      deleted: true,
      fileName: "delete-me.panel.html",
      id: entry.id,
    });
    expect(existsSync(filePath)).toBe(false);
    await expect(manager.listPanelApps()).resolves.toEqual({
      workspacePath,
      panelsPath,
      entries: [],
    });
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
    const result = await manager.deletePanelApp(entry.id);

    expect(result).toEqual({
      deleted: true,
      fileName: "delete-folder.panel",
      id: entry.id,
    });
    expect(existsSync(appPath)).toBe(false);
    await expect(manager.listPanelApps()).resolves.toEqual({
      workspacePath,
      panelsPath,
      entries: [],
    });
  });

  it("surfaces invalid folder manifests clearly", async () => {
    const workspacePath = createTempDir();
    const panelsPath = join(workspacePath, "panels");
    const appPath = join(panelsPath, "broken.panel");
    mkdirSync(appPath, { recursive: true });
    writeFileSync(join(appPath, "panel-app.json"), "{ nope");

    await expect(createPanelAppManager(workspacePath).listPanelApps()).rejects.toMatchObject({
      code: "PANEL_APP_MANIFEST_INVALID",
    } satisfies Partial<PanelAppError>);
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
