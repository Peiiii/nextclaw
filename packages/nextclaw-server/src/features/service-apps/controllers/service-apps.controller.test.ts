import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import type { PanelAppBridgeSession, ServiceActionCaller } from "@nextclaw/kernel";
import { EventBus } from "@nextclaw/shared";
import { createUiRouter } from "@nextclaw-server/app/router.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";
import type { UiKernelHost } from "@nextclaw-server/app/types/router-options.types.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-service-apps-route-test-"));
  tempDirs.push(dir);
  const configPath = join(dir, "config.json");
  saveConfig(ConfigSchema.parse({}), configPath);
  return configPath;
}

function createTestApp(params: {
  panelAppManager?: Partial<UiKernelHost["panelAppManager"]>;
  serviceAppManager?: Partial<UiKernelHost["serviceAppManager"]>;
}) {
  return createUiRouter({
    configPath: createTempConfigPath(),
    appEventBus: new EventBus(),
    kernel: createRouterTestKernel({
      panelAppManager: params.panelAppManager as UiKernelHost["panelAppManager"],
      serviceAppManager: params.serviceAppManager as UiKernelHost["serviceAppManager"],
    }),
  });
}

function createBridgeSession(): PanelAppBridgeSession {
  const caller: ServiceActionCaller = {
    surface: "panel-app",
    appId: "todo-panel",
  };
  return {
    id: "session-1",
    token: "bridge-token",
    panelAppId: "todo-panel",
    tabId: "tab-1",
    caller,
    declaredActions: ["notes.read"],
    createdAt: "2026-05-27T00:00:00.000Z",
    expiresAt: "2026-05-27T01:00:00.000Z",
  };
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

describe("service apps routes", () => {
  it("requires a panel bridge session before invoking service actions", async () => {
    const app = createTestApp({
      panelAppManager: {},
      serviceAppManager: {},
    });

    const response = await app.request("http://localhost/api/service-actions/notes.read/invoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: {} }),
    });
    const payload = await response.json() as { ok: false; error: { code: string } };

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe("PANEL_APP_BRIDGE_SESSION_REQUIRED");
  });

  it("passes bridge caller and declared actions into the service app manager", async () => {
    const bridgeSession = createBridgeSession();
    const invokeServiceAction = vi.fn(async () => ({
      actionId: "notes.read",
      result: { text: "hello" },
    }));
    const app = createTestApp({
      panelAppManager: {
        resolvePanelAppBridgeSession: () => bridgeSession,
      },
      serviceAppManager: {
        invokeServiceAction,
      },
    });

    const response = await app.request("http://localhost/api/service-actions/notes.read/invoke", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-nextclaw-panel-bridge-session": "bridge-token",
      },
      body: JSON.stringify({ input: { path: "memory.md" } }),
    });
    const payload = await response.json() as {
      ok: true;
      data: { result: { text: string } };
    };

    expect(response.status).toBe(200);
    expect(payload.data.result.text).toBe("hello");
    expect(invokeServiceAction).toHaveBeenCalledWith("notes.read", {
      caller: bridgeSession.caller,
      declaredActions: bridgeSession.declaredActions,
      input: { path: "memory.md" },
    });
  });

  it("uses POST for explicit service action discovery", async () => {
    const discoverServiceAppActions = vi.fn(async () => [{
      id: "notes.read",
      appId: "notes",
      name: "read",
      risk: "read" as const,
      runtimeState: "matched" as const,
    }]);
    const app = createTestApp({
      panelAppManager: {},
      serviceAppManager: {
        discoverServiceAppActions,
      },
    });

    const response = await app.request(
      "http://localhost/api/service-apps/notes/actions/discover",
      { method: "POST" },
    );
    const payload = await response.json() as {
      ok: true;
      data: { actions: Array<{ id: string; runtimeState: string }> };
    };

    expect(response.status).toBe(200);
    expect(payload.data.actions[0]).toEqual(expect.objectContaining({
      id: "notes.read",
      runtimeState: "matched",
    }));
    expect(discoverServiceAppActions).toHaveBeenCalledWith("notes");
  });

  it("passes optional app id filtering into action list queries", async () => {
    const listServiceActions = vi.fn(async () => []);
    const app = createTestApp({
      panelAppManager: {},
      serviceAppManager: {
        listServiceActions,
      },
    });

    const response = await app.request("http://localhost/api/service-actions?appId=notes");

    expect(response.status).toBe(200);
    expect(listServiceActions).toHaveBeenCalledWith({ appId: "notes" });
  });

  it("creates panel bridge sessions through the thin panel app route", async () => {
    const bridgeSession = createBridgeSession();
    const createPanelAppBridgeSession = vi.fn(async () => bridgeSession);
    const app = createTestApp({
      panelAppManager: {
        createPanelAppBridgeSession,
      },
      serviceAppManager: {},
    });

    const response = await app.request("http://localhost/api/panel-app-bridge-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ panelAppId: "todo-panel", tabId: "tab-1" }),
    });
    const payload = await response.json() as {
      ok: true;
      data: { token: string; panelAppId: string };
    };

    expect(response.status).toBe(200);
    expect(payload.data.token).toBe("bridge-token");
    expect(payload.data.panelAppId).toBe("todo-panel");
    expect(createPanelAppBridgeSession).toHaveBeenCalledWith({
      id: "todo-panel",
      tabId: "tab-1",
    });
  });

  it("lists and revokes service action grants for the status panel", async () => {
    const revokeServiceAction = vi.fn(async () => {});
    const app = createTestApp({
      panelAppManager: {},
      serviceAppManager: {
        listServiceActionGrants: async () => [{
          caller: { surface: "panel-app", appId: "todo-panel" },
          actionId: "notes.read",
          risk: "read",
          grantedAt: "2026-05-27T00:00:00.000Z",
        }],
        revokeServiceAction,
      },
    });

    const listResponse = await app.request("http://localhost/api/service-action-grants");
    const listPayload = await listResponse.json() as {
      ok: true;
      data: { grants: Array<{ actionId: string }> };
    };
    expect(listResponse.status).toBe(200);
    expect(listPayload.data.grants[0]?.actionId).toBe("notes.read");

    const revokeResponse = await app.request(
      "http://localhost/api/service-action-grants/notes.read?surface=panel-app&appId=todo-panel",
      { method: "DELETE" },
    );

    expect(revokeResponse.status).toBe(200);
    expect(revokeServiceAction).toHaveBeenCalledWith(
      { surface: "panel-app", appId: "todo-panel" },
      "notes.read",
    );
  });
});
