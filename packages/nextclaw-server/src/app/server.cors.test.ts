import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { AutomationManager } from "@nextclaw/kernel";
import { EventBus } from "@nextclaw/shared";
import { startUiServer } from "./server.js";
import { createRouterTestKernel } from "@nextclaw-server/app/tests/router-test-kernel.js";

async function reservePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to resolve test port.")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForServer(baseUrl: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until the listener is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for UI server: ${baseUrl}`);
}

function createTestGateway(params: {
  configPath: string;
  port: number;
  corsOrigins?: Parameters<typeof startUiServer>[0]["corsOrigins"];
  uiStaticDir?: string | null;
}): Parameters<typeof startUiServer>[0] {
  const {
    configPath,
    corsOrigins,
    port,
    uiStaticDir = null,
  } = params;
  const unavailable = async (): Promise<never> => {
    throw new Error("test gateway capability unavailable");
  };
  const updateSnapshot = {
    status: "blocked",
    installationKind: "unknown",
    channel: "stable",
    hostVersion: null,
    currentVersion: null,
    availableVersion: null,
    downloadedVersion: null,
    minimumHostVersion: null,
    releaseNotesUrl: null,
    lastCheckedAt: null,
    progress: null,
    canAutoDownload: false,
    canApplyInApp: false,
    requiresRestart: false,
    blockReason: "unsupported-installation",
    recoveryCommand: null,
    errorMessage: null,
    preferences: {
      automaticChecks: false,
      autoDownload: false,
    },
  } as const;
  return {
    uiConfig: {
      enabled: true,
      host: "127.0.0.1",
      open: false,
      port,
    },
    uiStaticDir,
    ...(corsOrigins ? { corsOrigins } : {}),
    configPath,
    appEventBus: new EventBus(),
    kernel: createRouterTestKernel(),
    productVersion: "test",
    applyLiveConfigReload: async () => {},
    initializeAgentHomeDirectory: () => {},
    marketplace: {},
    cron: new AutomationManager({ storePath: `${configPath}.cron.json` }),
    remoteAccess: {
      getStatus: unavailable,
      login: unavailable,
      startBrowserAuth: unavailable,
      pollBrowserAuth: unavailable,
      logout: unavailable,
      updateProfile: unavailable,
      updateSettings: unavailable,
      runDoctor: unavailable,
      controlService: unavailable,
    },
    runtimeControl: {
      getControl: unavailable,
      startService: unavailable,
      restartService: unavailable,
      stopService: unavailable,
    },
    runtimeUpdate: {
      getState: () => updateSnapshot,
      checkForUpdates: () => updateSnapshot,
      downloadUpdate: () => updateSnapshot,
      applyDownloadedUpdate: () => updateSnapshot,
      updatePreferences: () => updateSnapshot,
      updateChannel: () => updateSnapshot,
    },
    bootstrapStatus: {
      getStatus: () => ({
        phase: "ready",
        ncpAgent: { state: "ready" },
        pluginHydration: { state: "ready", loadedPluginCount: 0, totalPluginCount: 0 },
        channels: { state: "ready", enabled: [] },
        remote: { state: "disabled" },
      }),
    },
    plugins: {
      getChannelBindings: () => [],
      getUiMetadata: () => [],
    },
  };
}

describe("ui server api cors", () => {
  const handles: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    while (handles.length > 0) {
      const handle = handles.pop();
      if (handle) {
        await handle.close();
      }
    }
  });

  it("returns explicit cors headers for allowed origins and preflight requests", async () => {
    const port = await reservePort();
    const configPath = join(mkdtempSync(join(tmpdir(), "nextclaw-server-cors-")), "config.json");
    const handle = await startUiServer(createTestGateway({
      configPath,
      port,
      corsOrigins: ["http://127.0.0.1:5174"]
    }));
    handles.push(handle);

    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForServer(baseUrl);

    const preflight = await fetch(`${baseUrl}/api/health`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:5174",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "Content-Type"
      }
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5174");
    expect(preflight.headers.get("access-control-allow-credentials")).toBe("true");
    expect(preflight.headers.get("access-control-allow-methods")).toContain("GET");
    expect(preflight.headers.get("access-control-allow-headers")).toBe("Content-Type");

    const response = await fetch(`${baseUrl}/api/health`, {
      headers: {
        Origin: "http://127.0.0.1:5174"
      }
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://127.0.0.1:5174");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("uses the built-in localhost policy and omits cors headers for disallowed origins", async () => {
    const port = await reservePort();
    const configPath = join(mkdtempSync(join(tmpdir(), "nextclaw-server-default-cors-")), "config.json");
    const handle = await startUiServer(createTestGateway({
      configPath,
      port,
    }));
    handles.push(handle);

    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForServer(baseUrl);

    const localhostResponse = await fetch(`${baseUrl}/api/health`, {
      headers: {
        Origin: "http://localhost:5174"
      }
    });
    expect(localhostResponse.headers.get("access-control-allow-origin")).toBe("http://localhost:5174");

    const disallowedResponse = await fetch(`${baseUrl}/api/health`, {
      headers: {
        Origin: "https://example.com"
      }
    });
    expect(disallowedResponse.status).toBe(200);
    expect(disallowedResponse.headers.get("access-control-allow-origin")).toBeNull();
    expect(disallowedResponse.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("does not serve index.html for /_remote runtime probes in local ui mode", async () => {
    const port = await reservePort();
    const rootDir = mkdtempSync(join(tmpdir(), "nextclaw-server-remote-probe-"));
    const staticDir = join(rootDir, "ui-dist");
    mkdirSync(staticDir, { recursive: true });
    writeFileSync(join(staticDir, "index.html"), "<!doctype html><html><body>ui shell</body></html>");
    const configPath = join(rootDir, "config.json");
    const handle = await startUiServer(createTestGateway({
      configPath,
      port,
      uiStaticDir: staticDir,
    }));
    handles.push(handle);

    const baseUrl = `http://127.0.0.1:${port}`;
    await waitForServer(baseUrl);

    const runtimeResponse = await fetch(`${baseUrl}/_remote/runtime`);
    expect(runtimeResponse.status).toBe(404);

    const pageResponse = await fetch(`${baseUrl}/chat`);
    expect(pageResponse.status).toBe(200);
    expect(await pageResponse.text()).toContain("ui shell");
  });

  it("rejects startup when the target port is already in use", async () => {
    const port = await reservePort();
    const configPath = join(mkdtempSync(join(tmpdir(), "nextclaw-server-port-conflict-")), "config.json");
    const firstHandle = await startUiServer(createTestGateway({
      configPath,
      port,
    }));
    handles.push(firstHandle);

    await expect(
      startUiServer(createTestGateway({
        configPath,
        port,
      }))
    ).rejects.toThrow(/EADDRINUSE|address already in use/i);
  });
});
