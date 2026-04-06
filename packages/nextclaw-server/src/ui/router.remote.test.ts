import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import type { UiRemoteAccessHost } from "./ui-routes/types.js";
import { createUiRouter } from "./router.js";

const tempDirs: string[] = [];

function createTempConfigPath(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ui-remote-router-test-"));
  tempDirs.push(dir);
  return join(dir, "config.json");
}

function createRemoteHost(): UiRemoteAccessHost {
  return {
    getStatus: vi.fn(() => ({
      account: {
        loggedIn: true,
        email: "demo@example.com",
        role: "user",
        apiBase: "https://ai-gateway-api.nextclaw.io/v1",
        platformBase: "https://ai-gateway-api.nextclaw.io"
      },
      settings: {
        enabled: true,
        deviceName: "demo-device",
        platformApiBase: "https://ai-gateway-api.nextclaw.io/v1"
      },
      service: {
        running: true,
        pid: 1234,
        uiUrl: "http://127.0.0.1:55667",
        uiPort: 55667,
        currentProcess: false
      },
      localOrigin: "http://127.0.0.1:55667",
      configuredEnabled: true,
      platformBase: "https://ai-gateway-api.nextclaw.io",
      runtime: {
        enabled: true,
        mode: "service" as const,
        state: "connected" as const,
        deviceId: "device-123",
        deviceName: "demo-device",
        platformBase: "https://ai-gateway-api.nextclaw.io",
        localOrigin: "http://127.0.0.1:55667",
        lastConnectedAt: "2026-03-20T00:00:00.000Z",
        lastError: null,
        updatedAt: "2026-03-20T00:00:00.000Z"
      }
    })),
    login: vi.fn(async () => ({
      account: {
        loggedIn: true
      },
      settings: {
        enabled: true,
        deviceName: "demo-device",
        platformApiBase: ""
      },
      service: {
        running: false,
        currentProcess: false
      },
      localOrigin: "http://127.0.0.1:55667",
      configuredEnabled: true,
      runtime: null
    })),
    startBrowserAuth: vi.fn(async () => ({
      sessionId: "session-123",
      verificationUri: "https://ai-gateway-api.nextclaw.io/platform/auth/browser?sessionId=session-123",
      expiresAt: "2026-03-20T01:00:00.000Z",
      intervalMs: 1500
    })),
    pollBrowserAuth: vi.fn(async () => ({
      status: "authorized" as const,
      email: "demo@example.com",
      role: "user"
    })),
    logout: vi.fn(() => ({
      account: {
        loggedIn: false
      },
      settings: {
        enabled: true,
        deviceName: "demo-device",
        platformApiBase: ""
      },
      service: {
        running: false,
        currentProcess: false
      },
      localOrigin: "http://127.0.0.1:55667",
      configuredEnabled: true,
      runtime: null
    })),
    updateSettings: vi.fn(async () => ({
      account: {
        loggedIn: false
      },
      settings: {
        enabled: false,
        deviceName: "",
        platformApiBase: ""
      },
      service: {
        running: false,
        currentProcess: false
      },
      localOrigin: "http://127.0.0.1:55667",
      configuredEnabled: false,
      runtime: null
    })),
    runDoctor: vi.fn(async () => ({
      generatedAt: "2026-03-20T00:00:00.000Z",
      checks: [
        {
          name: "remote-enabled",
          ok: true,
          detail: "enabled in config"
        }
      ],
      snapshot: {
        configuredEnabled: true,
        runtime: null
      }
    })),
    controlService: vi.fn(async (action) => ({
      accepted: true,
      action,
      message: `service ${action}`
    }))
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  vi.restoreAllMocks();
});

describe("remote access routes", () => {
  it("returns remote status payload", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const remoteAccess = createRemoteHost();
    const app = createUiRouter({
      configPath,
      publish: () => {},
      remoteAccess
    });

    const response = await app.request("http://localhost/api/remote/status");
    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        account: {
          loggedIn: boolean;
        };
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.account.loggedIn).toBe(true);
    expect(remoteAccess.getStatus).toHaveBeenCalledOnce();
  });

  it("accepts login, settings, doctor, and service actions", async () => {
    const configPath = createTempConfigPath();
    saveConfig(ConfigSchema.parse({}), configPath);
    const remoteAccess = createRemoteHost();
    const app = createUiRouter({
      configPath,
      publish: () => {},
      remoteAccess
    });

    const loginResponse = await app.request("http://localhost/api/remote/login", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        email: "demo@example.com",
        password: "password123"
      })
    });
    expect(loginResponse.status).toBe(200);
    expect(remoteAccess.login).toHaveBeenCalledWith({
      email: "demo@example.com",
      password: "password123",
      apiBase: undefined
    });

    const authStartResponse = await app.request("http://localhost/api/remote/auth/start", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        apiBase: "https://ai-gateway-api.nextclaw.io/v1"
      })
    });
    expect(authStartResponse.status).toBe(200);
    expect(remoteAccess.startBrowserAuth).toHaveBeenCalledWith({
      apiBase: "https://ai-gateway-api.nextclaw.io/v1"
    });

    const authPollResponse = await app.request("http://localhost/api/remote/auth/poll", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sessionId: "session-123",
        apiBase: "https://ai-gateway-api.nextclaw.io/v1"
      })
    });
    expect(authPollResponse.status).toBe(200);
    expect(remoteAccess.pollBrowserAuth).toHaveBeenCalledWith({
      sessionId: "session-123",
      apiBase: "https://ai-gateway-api.nextclaw.io/v1"
    });

    const settingsResponse = await app.request("http://localhost/api/remote/settings", {
      method: "PUT",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        enabled: false,
        deviceName: " ",
        platformApiBase: " "
      })
    });
    expect(settingsResponse.status).toBe(200);
    expect(remoteAccess.updateSettings).toHaveBeenCalledWith({
      enabled: false,
      deviceName: "",
      platformApiBase: ""
    });

    const doctorResponse = await app.request("http://localhost/api/remote/doctor");
    expect(doctorResponse.status).toBe(200);
    expect(remoteAccess.runDoctor).toHaveBeenCalledOnce();

    const controlResponse = await app.request("http://localhost/api/remote/service/restart", {
      method: "POST"
    });
    expect(controlResponse.status).toBe(200);
    expect(remoteAccess.controlService).toHaveBeenCalledWith("restart");
  });
});
