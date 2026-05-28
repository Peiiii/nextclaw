import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { PanelAppError } from "@nextclaw/kernel";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";
import type { UiKernelHost } from "@nextclaw-server/app/types/router-options.types.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-panel-apps-route-test-"));
  tempDirs.push(dir);
  const configPath = join(dir, "config.json");
  saveConfig(ConfigSchema.parse({}), configPath);
  return configPath;
}

function createTestApp(panelAppManager: UiKernelHost["panelAppManager"]) {
  return createUiRouter({
    configPath: createTempConfigPath(),
    appEventBus: new EventBus(),
    kernel: createRouterTestKernel({ panelAppManager }),
  });
}

function createPanelAppEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "demo",
    fileName: "demo.panel.html",
    title: "demo",
    contentPath: "/api/panel-apps/demo/content",
    updatedAt: "2026-05-26T00:00:00.000Z",
    sizeBytes: 12,
    favorite: false,
    openCount: 0,
    ...overrides,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("panel apps routes", () => {
  it("lists panel apps through the thin server route", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "/tmp/workspace",
        panelsPath: "/tmp/workspace/panels",
        entries: [createPanelAppEntry()],
      }),
      getPanelAppContent: async () => {
        throw new Error("not used");
      },
    } as never);

    const response = await app.request("http://localhost/api/panel-apps");
    const payload = await response.json() as {
      ok: true;
      data: { entries: Array<{ fileName: string }> };
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.entries[0]?.fileName).toBe("demo.panel.html");
  });

  it("serves panel app HTML content without wrapping it as JSON", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () => ({
        capabilities: [],
        id: "demo",
        fileName: "demo.panel.html",
        html: "<!doctype html><h1>Demo</h1>",
        serviceActions: [],
        contentType: "text/html; charset=utf-8" as const,
      }),
    } as never);

    const response = await app.request("http://localhost/api/panel-apps/demo/content");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("<!doctype html><h1>Demo</h1>");
  });

  it("updates panel app preferences through the manager", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () => {
        throw new Error("not used");
      },
      updatePanelAppPreferences: async (id: string, preferences: { favorite?: boolean }) =>
        createPanelAppEntry({ id, favorite: preferences.favorite }),
      recordPanelAppOpened: async () => {
        throw new Error("not used");
      },
    } as never);

    const response = await app.request("http://localhost/api/panel-apps/demo/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ favorite: true }),
    });
    const payload = await response.json() as {
      ok: true;
      data: { favorite: boolean };
    };

    expect(response.status).toBe(200);
    expect(payload.data.favorite).toBe(true);
  });

  it("records panel app opens through the manager", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () => {
        throw new Error("not used");
      },
      updatePanelAppPreferences: async () => {
        throw new Error("not used");
      },
      recordPanelAppOpened: async (id: string) =>
        createPanelAppEntry({
          id,
          lastOpenedAt: "2026-05-27T10:00:00.000Z",
          openCount: 1,
        }),
    } as never);

    const response = await app.request("http://localhost/api/panel-apps/demo/open", {
      method: "POST",
    });
    const payload = await response.json() as {
      ok: true;
      data: { lastOpenedAt: string; openCount: number };
    };

    expect(response.status).toBe(200);
    expect(payload.data.openCount).toBe(1);
    expect(payload.data.lastOpenedAt).toBe("2026-05-27T10:00:00.000Z");
  });

  it("maps panel app manager errors to route errors", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () => {
        throw new PanelAppError("PANEL_APP_NOT_FOUND", "panel app not found");
      },
    } as never);

    const response = await app.request("http://localhost/api/panel-apps/missing/content");
    const payload = await response.json() as { ok: false; error: { code: string } };

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("PANEL_APP_NOT_FOUND");
  });

  it("sends panel app agent requests with the bridge session header", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () => {
        throw new Error("not used");
      },
      sendAgentMessage: async (token: string, payload: unknown) => ({
        runId: "run-1",
        sessionId: `session-for-${token}`,
        userMessageId: JSON.stringify(payload),
      }),
    } as never);

    const response = await app.request("http://localhost/api/panel-app-agent/send", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nextclaw-panel-bridge-session": "token-1",
      },
      body: JSON.stringify({
        payload: {
          content: [{ type: "text", text: "hello" }],
        },
      }),
    });
    const payload = await response.json() as {
      ok: true;
      data: { sessionId: string };
    };

    expect(response.status).toBe(200);
    expect(payload.data.sessionId).toBe("session-for-token-1");
  });

  it("maps panel app agent authorization errors to 401", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () => {
        throw new Error("not used");
      },
      generateAgentObject: async () => {
        throw new PanelAppError("AUTHORIZATION_REQUIRED", "authorization required");
      },
    } as never);

    const response = await app.request("http://localhost/api/panel-app-agent/generate-object", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nextclaw-panel-bridge-session": "token-1",
      },
      body: JSON.stringify({
        input: {
          peerId: "demo",
          prompt: "return json",
          schema: { type: "object" },
        },
      }),
    });
    const payload = await response.json() as { ok: false; error: { code: string } };

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("AUTHORIZATION_REQUIRED");
  });
});
