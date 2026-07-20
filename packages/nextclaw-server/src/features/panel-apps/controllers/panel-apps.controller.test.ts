import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { ConfigManager, PanelAppError, PanelAppManager } from "@nextclaw/kernel";
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

function createTestApp(
  panelAppManager: UiKernelHost["panelAppManager"],
  options: { panelAppClientSdkScript?: () => Promise<string> | string } = {},
) {
  return createUiRouter({
    configPath: createTempConfigPath(),
    appEventBus: new EventBus(),
    ...options,
    kernel: createRouterTestKernel({ panelAppManager }),
  });
}

function createTestPanelAppManager(workspacePath: string): PanelAppManager {
  const configPath = createTempConfigPath();
  saveConfig(ConfigSchema.parse({
    agents: { defaults: { workspace: workspacePath } },
  }), configPath);
  return new PanelAppManager({
    configManager: new ConfigManager({
      configPath,
      channels: { load: async () => undefined, reload: async () => undefined } as never,
      providerManager: { load: async () => undefined } as never,
    }),
  });
}

function createPanelAppEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "demo",
    appId: "demo",
    fileName: "demo.panel.html",
    kind: "single-file",
    title: "demo",
    contentPath: "/api/panel-apps/demo/content",
    updatedAt: "2026-05-26T00:00:00.000Z",
    sizeBytes: 12,
    favorite: false,
    clientDeclared: false,
    clientGranted: false,
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
    let requestedSource: [string, string | undefined] | undefined;
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async (id: string, path?: string) => {
        requestedSource = [id, path];
        return {
          capabilities: [],
          appId: "demo",
          clientDeclared: false,
          clientGranted: false,
          id: "demo",
          fileName: "demo.panel.html",
          html: "<!doctype html><h1>Demo</h1>",
          serviceActions: [],
          contentType: "text/html; charset=utf-8" as const,
        };
      },
    } as never);

    const response = await app.request(
      "http://localhost/api/panel-apps/demo/content?path=%2Ftmp%2Fexternal-demo.panel",
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("<!doctype html><h1>Demo</h1>");
    expect(requestedSource).toEqual(["demo", "/tmp/external-demo.panel"]);
  });

  it("serves external folder content and signed assets through the assembled routes", async () => {
    const workspacePath = mkdtempSync(join(tmpdir(), "nextclaw-panel-app-workspace-test-"));
    const appPath = join(workspacePath, "external-demo.panel");
    tempDirs.push(workspacePath);
    mkdirSync(appPath, { recursive: true });
    writeFileSync(
      join(appPath, "panel-app.json"),
      JSON.stringify({ id: "external-demo", title: "External Demo", entry: "index.html" }),
    );
    writeFileSync(join(appPath, "index.html"), "<!doctype html><script src=\"app.js\"></script>");
    writeFileSync(join(appPath, "app.js"), "window.externalDemo = true;");
    const app = createTestApp(createTestPanelAppManager(workspacePath));

    const contentResponse = await app.request(
      `http://localhost/api/panel-apps/external-demo/content?${new URLSearchParams({ path: appPath })}`,
    );
    const html = await contentResponse.text();
    const token = /\/api\/panel-app-assets\/([^/]+)\//.exec(html)?.[1];
    const assetResponse = await app.request(
      `http://localhost/api/panel-app-assets/${token}/app.js`,
    );

    expect(contentResponse.status).toBe(200);
    expect(token).toBeTruthy();
    expect(assetResponse.status).toBe(200);
    expect(await assetResponse.text()).toBe("window.externalDemo = true;");
  });

  it("serves the configured panel app client SDK browser script", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
    } as never, {
      panelAppClientSdkScript: () => "window.NextClawClient = function NextClawClient() {};",
    });

    const response = await app.request("http://localhost/api/panel-app-client-sdk.js");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/javascript; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(await response.text()).toContain("window.NextClawClient");
  });

  it("serves panel app assets without wrapping them as JSON", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () => {
        throw new Error("not used");
      },
      getPanelAppAsset: async (_id: string, assetPath: string) => ({
        content: Buffer.from(`asset:${assetPath}`),
        contentType: "text/css; charset=utf-8" as const,
      }),
    } as never);

    const response = await app.request("http://localhost/api/panel-apps/demo/assets/styles/app.css");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(await response.text()).toBe("asset:styles/app.css");
  });
});

describe("tokenized panel app asset routes", () => {
  it("serves tokenized panel app assets without wrapping them as JSON", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () => {
        throw new Error("not used");
      },
      getPanelAppAssetByToken: async (token: string, assetPath: string) => ({
        content: Buffer.from(`token:${token}:${assetPath}`),
        contentType: "application/javascript; charset=utf-8" as const,
      }),
    } as never);

    const response = await app.request("http://localhost/api/panel-app-assets/token-1/scripts/app.js");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/javascript; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(await response.text()).toBe("token:token-1:scripts/app.js");
  });

  it("maps tokenized panel app asset errors to route errors", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () => {
        throw new Error("not used");
      },
      getPanelAppAssetByToken: async () => {
        throw new PanelAppError("PANEL_APP_ASSET_TOKEN_INVALID", "invalid panel app asset token");
      },
    } as never);

    const response = await app.request("http://localhost/api/panel-app-assets/bad-token/app.js");
    const payload = await response.json() as { ok: false; error: { code: string } };

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("PANEL_APP_ASSET_TOKEN_INVALID");
  });
});

describe("panel app asset error routes", () => {
  it("maps panel app asset errors to route errors", async () => {
    const app = createTestApp({
      listPanelApps: async () => ({
        workspacePath: "",
        panelsPath: "",
        entries: [],
      }),
      getPanelAppContent: async () => {
        throw new Error("not used");
      },
      getPanelAppAsset: async () => {
        throw new PanelAppError("PANEL_APP_INVALID_ASSET_PATH", "invalid panel app asset path");
      },
    } as never);

    const response = await app.request("http://localhost/api/panel-apps/demo/assets/..%2Fsecret");
    const payload = await response.json() as { ok: false; error: { code: string } };

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("PANEL_APP_INVALID_ASSET_PATH");
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

  it("deletes panel apps through the manager", async () => {
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
      recordPanelAppOpened: async () => {
        throw new Error("not used");
      },
      deletePanelApp: async (id: string) => ({
        deleted: true,
        fileName: "demo.panel.html",
        id,
      }),
    } as never);

    const response = await app.request("http://localhost/api/panel-apps/demo", {
      method: "DELETE",
    });
    const payload = await response.json() as {
      ok: true;
      data: { deleted: true; fileName: string; id: string };
    };

    expect(response.status).toBe(200);
    expect(payload.data).toEqual({
      deleted: true,
      fileName: "demo.panel.html",
      id: "demo",
    });
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
});

describe("panel app agent routes", () => {
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
