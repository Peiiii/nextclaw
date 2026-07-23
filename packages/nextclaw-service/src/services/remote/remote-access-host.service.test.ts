import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { spawn } from "node:child_process";
import { managedServiceStateStore } from "@nextclaw-service/stores/managed-service-state.store.js";
import { RemoteAccessHost } from "./remote-access-host.service.js";

const originalNextclawHome = process.env.NEXTCLAW_HOME;

function createHost() {
  const serviceCommands = {
    startService: vi.fn().mockResolvedValue(undefined),
    stopService: vi.fn().mockResolvedValue(undefined),
    requestManagedServiceRestart: vi.fn().mockResolvedValue(undefined)
  };
  const remoteCommands = {
    getStatusView: vi.fn(),
    updateConfig: vi.fn(),
    getDoctorView: vi.fn()
  };
  const host = new RemoteAccessHost({
    serviceCommands: serviceCommands as never,
    requestManagedServiceRestart: serviceCommands.requestManagedServiceRestart,
    remoteCommands: remoteCommands as never,
    platformAuthCommands: {
      loginResult: vi.fn(),
      startBrowserAuth: vi.fn(),
      pollBrowserAuth: vi.fn(),
      logout: vi.fn()
    } as never
  });
  return { host, serviceCommands, remoteCommands };
}

function createPlatformToken(payload: Record<string, unknown>): string {
  return `nca.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
}

function createConnectionDiagnostics() {
  return {
    observedSince: "2026-03-22T00:00:00.000Z",
    connectionId: "connection-a",
    connectedAt: null,
    heartbeatSupported: true,
    lastHeartbeatSentAt: "2026-03-22T00:01:00.000Z",
    lastHeartbeatAckAt: "2026-03-22T00:01:00.010Z",
    lastHeartbeatLatencyMs: 10,
    disconnectCount: 1,
    consecutiveFailures: 1,
    reconnectAttempt: 1,
    nextReconnectAt: "2026-03-22T00:01:03.000Z",
    lastDisconnect: {
      source: "close",
      connectionId: "connection-a",
      at: "2026-03-22T00:01:00.000Z",
      code: 1006,
      reason: null,
      wasClean: false,
      connectedDurationMs: 60_000
    },
    lastRecoveredAt: null,
    lastRecoveryDurationMs: null
  } as const;
}

describe("RemoteAccessHost service control", () => {
  let tempHome = "";

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), "nextclaw-remote-access-host-test-"));
    process.env.NEXTCLAW_HOME = tempHome;
  });

  afterEach(() => {
    if (originalNextclawHome) {
      process.env.NEXTCLAW_HOME = originalNextclawHome;
    } else {
      delete process.env.NEXTCLAW_HOME;
    }
    if (tempHome) {
      rmSync(tempHome, { recursive: true, force: true });
      tempHome = "";
    }
    vi.restoreAllMocks();
  });

  it("does not treat the builtin free key as a logged-in platform session", () => {
    saveConfig(ConfigSchema.parse({
      providers: {
        nextclaw: {
          apiKey: "nc_free_test_builtin",
          apiBase: "https://ai-gateway-api.nextclaw.io/v1"
        }
      }
    }));
    const { host, remoteCommands } = createHost();
    remoteCommands.getStatusView.mockReturnValue({
      configuredEnabled: false,
      runtime: null,
      localOrigin: "http://127.0.0.1:55667",
      deviceName: "test-device",
      platformBase: "https://ai-gateway-api.nextclaw.io/v1"
    });
    vi.spyOn(managedServiceStateStore, "read").mockReturnValue(null);

    const status = host.getStatus();

    expect(status.account.loggedIn).toBe(false);
    expect(status.account.email).toBeUndefined();
  });

  it("does not treat an expired platform session token as logged in", () => {
    saveConfig(ConfigSchema.parse({
      providers: {
        nextclaw: {
          apiKey: createPlatformToken({
            email: "expired@example.com",
            role: "user",
            exp: Math.floor(Date.now() / 1000) - 60
          }),
          apiBase: "https://ai-gateway-api.nextclaw.io/v1"
        }
      }
    }));
    const { host, remoteCommands } = createHost();
    remoteCommands.getStatusView.mockReturnValue({
      configuredEnabled: true,
      runtime: {
        enabled: true,
        mode: "service",
        state: "disconnected",
        deviceId: null,
        deviceName: null,
        platformBase: "https://ai-gateway-api.nextclaw.io",
        localOrigin: "http://127.0.0.1:55667",
        lastConnectedAt: null,
        lastError: "Invalid or expired token.",
        connection: createConnectionDiagnostics(),
        updatedAt: "2026-03-22T00:00:00.000Z"
      },
      localOrigin: "http://127.0.0.1:55667",
      deviceName: "test-device",
      platformBase: "https://ai-gateway-api.nextclaw.io"
    });
    vi.spyOn(managedServiceStateStore, "read").mockReturnValue(null);

    const status = host.getStatus();

    expect(status.account.loggedIn).toBe(false);
    expect(status.account.email).toBeUndefined();
    expect(status.runtime?.lastError).toBe("Invalid or expired token.");
    expect(status.runtime?.connection?.lastDisconnect?.code).toBe(1006);
  });

  it("routes current-process restart through the managed service restart coordinator", async () => {
    saveConfig(ConfigSchema.parse({
      ui: {
        enabled: true,
        host: "0.0.0.0",
        port: 19199,
        open: false
      }
    }));
    vi.spyOn(managedServiceStateStore, "read").mockReturnValue({
      pid: process.pid,
      startedAt: "2026-03-20T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:19199",
      apiUrl: "http://127.0.0.1:19199/api",
      uiHost: "0.0.0.0",
      uiPort: 19199,
      logPath: "/tmp/service.log"
    });
    const { host, serviceCommands } = createHost();

    const result = await host.controlService("restart");

    expect(serviceCommands.requestManagedServiceRestart).toHaveBeenCalledWith({
      uiPort: 19199
    });
    expect(serviceCommands.stopService).not.toHaveBeenCalled();
    expect(serviceCommands.startService).not.toHaveBeenCalled();
    expect(result).toEqual({
      accepted: true,
      action: "restart",
      message: "Restart scheduled. This page may disconnect for a few seconds."
    });
  });

  it("restarts an external managed service by stopping then starting it", async () => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000);"], {
      stdio: "ignore"
    });
    saveConfig(ConfigSchema.parse({
      ui: {
        enabled: true,
        host: "0.0.0.0",
        port: 19199,
        open: false
      }
    }));
    vi.spyOn(managedServiceStateStore, "read").mockReturnValue({
      pid: child.pid ?? -1,
      startedAt: "2026-03-20T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:19199",
      apiUrl: "http://127.0.0.1:19199/api",
      uiHost: "0.0.0.0",
      uiPort: 19199,
      logPath: "/tmp/service.log"
    });
    const { host, serviceCommands } = createHost();

    try {
      const result = await host.controlService("restart");

      expect(serviceCommands.stopService).toHaveBeenCalledOnce();
      expect(serviceCommands.startService).toHaveBeenCalledWith({
        uiOverrides: {
          enabled: true,
          host: "0.0.0.0",
          open: false,
          port: 19199
        },
        open: false
      });
      expect(serviceCommands.requestManagedServiceRestart).not.toHaveBeenCalled();
      expect(result).toEqual({
        accepted: true,
        action: "restart",
        message: "Managed service restarted."
      });
    } finally {
      child.kill("SIGKILL");
    }
  });

  it("replaces a stale leased managed service process instead of treating it as healthy", async () => {
    saveConfig(ConfigSchema.parse({
      ui: {
        enabled: true,
        host: "0.0.0.0",
        port: 19199,
        open: false
      }
    }));
    vi.spyOn(managedServiceStateStore, "read").mockReturnValue({
      pid: process.pid,
      startedAt: "2026-03-20T00:00:00.000Z",
      uiUrl: "http://127.0.0.1:19199",
      apiUrl: "http://127.0.0.1:19199/api",
      uiHost: "0.0.0.0",
      uiPort: 19199,
      logPath: "/tmp/service.log",
      lease: {
        ownerPid: process.pid,
        heartbeatAt: "2000-01-01T00:00:00.000Z",
        heartbeatIntervalMs: 1000,
        ttlMs: 2000
      }
    });
    const { host, serviceCommands } = createHost();

    const result = await host.controlService("restart");

    expect(serviceCommands.stopService).toHaveBeenCalledOnce();
    expect(serviceCommands.startService).toHaveBeenCalledWith({
      uiOverrides: {
        enabled: true,
        host: "0.0.0.0",
        open: false,
        port: 19199
      },
      open: false
    });
    expect(result).toEqual({
      accepted: true,
      action: "restart",
      message: "Stale managed service process replaced."
    });
  });
});
