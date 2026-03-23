import { describe, expect, it, vi } from "vitest";
import { RemoteConnector, type RegisteredRemoteDevice, type RemoteRuntimeState } from "@nextclaw/remote";

class FakeRemoteConnectorSocket {
  readonly readyState = 1;
  private readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(listener);
    this.listeners.set(type, handlers);
  }

  close(): void {}

  send(): void {}

  emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

function createRunContext() {
  return {
    config: {
      remote: {
        enabled: true,
        autoReconnect: true
      }
    },
    platformBase: "https://ai-gateway-api.nextclaw.io",
    token: "nca.valid.sig",
    localOrigin: "http://127.0.0.1:55667",
    displayName: "dev-machine",
    deviceInstallId: "device-install-id",
    autoReconnect: true
  };
}

function createDevice(): RegisteredRemoteDevice {
  return {
    id: "device-1",
    deviceInstallId: "device-install-id",
    displayName: "dev-machine",
    platform: "nextclaw",
    appVersion: "0.13.36",
    localOrigin: "http://127.0.0.1:55667",
    status: "online",
    lastSeenAt: "2026-03-23T00:00:00.000Z",
    createdAt: "2026-03-23T00:00:00.000Z",
    updatedAt: "2026-03-23T00:00:00.000Z"
  };
}

function createLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function createStatusWriter(statusWrites: Array<Omit<RemoteRuntimeState, "mode" | "updatedAt">>) {
  return {
    write(next: Omit<RemoteRuntimeState, "mode" | "updatedAt">) {
      statusWrites.push(next);
    }
  };
}

describe("RemoteConnector runtime policy", () => {
  it("stops reconnecting and preserves the runtime error when the platform rejects the token", async () => {
    const statusWrites: Array<Omit<RemoteRuntimeState, "mode" | "updatedAt">> = [];
    const logger = createLogger();
    const platformClient = {
      resolveRunContext: vi.fn().mockReturnValue(createRunContext()),
      registerDevice: vi.fn<() => Promise<RegisteredRemoteDevice>>().mockRejectedValue(new Error("Invalid or expired token."))
    };
    const connector = new RemoteConnector({
      platformClient: platformClient as never,
      relayBridgeFactory: () =>
        ({
          ensureLocalUiHealthy: vi.fn().mockResolvedValue(undefined)
        }) as never,
      logger
    });

    await connector.run({
      mode: "service",
      autoReconnect: true,
      statusStore: createStatusWriter(statusWrites)
    });

    expect(platformClient.registerDevice).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("Remote connector error: Invalid or expired token.");
    expect(statusWrites.at(-1)).toMatchObject({
      enabled: true,
      state: "error",
      lastError: "Invalid or expired token."
    });
  });

  it("keeps backing off transient websocket failures until the 30 minute cap", async () => {
    const statusWrites: Array<Omit<RemoteRuntimeState, "mode" | "updatedAt">> = [];
    const logger = createLogger();
    const delayCalls: number[] = [];
    const abortController = new AbortController();
    const platformClient = {
      resolveRunContext: vi.fn().mockReturnValue(createRunContext()),
      registerDevice: vi.fn<() => Promise<RegisteredRemoteDevice>>().mockResolvedValue(createDevice())
    };
    const connector = new RemoteConnector({
      platformClient: platformClient as never,
      relayBridgeFactory: () =>
        ({
          ensureLocalUiHealthy: vi.fn().mockResolvedValue(undefined)
        }) as never,
      logger,
      delayFn: vi.fn(async (delayMs: number) => {
        delayCalls.push(delayMs);
        if (delayCalls.length >= 11) {
          abortController.abort();
        }
      }),
      random: () => 0.5,
      createSocket: () => {
        const socket = new FakeRemoteConnectorSocket();
        queueMicrotask(() => {
          socket.emit("error", {
            error: new Error("connect ECONNREFUSED 127.0.0.1:443")
          });
        });
        return socket as unknown as WebSocket;
      }
    });

    await connector.run({
      mode: "service",
      autoReconnect: true,
      signal: abortController.signal,
      statusStore: createStatusWriter(statusWrites)
    });

    expect(platformClient.registerDevice).toHaveBeenCalledTimes(1);
    expect(delayCalls).toEqual([3_000, 6_000, 12_000, 24_000, 48_000, 96_000, 192_000, 384_000, 768_000, 1_536_000, 1_800_000]);
    expect(logger.warn).toHaveBeenCalledTimes(11);
    expect(logger.error).toHaveBeenLastCalledWith("Remote connector error: connect ECONNREFUSED 127.0.0.1:443");
    expect(statusWrites.at(-1)).toMatchObject({
      enabled: true,
      state: "disconnected",
      lastError: null
    });
  });

  it("treats websocket handshake rejection as a terminal error", async () => {
    const statusWrites: Array<Omit<RemoteRuntimeState, "mode" | "updatedAt">> = [];
    const logger = createLogger();
    const delayFn = vi.fn(async () => undefined);
    const platformClient = {
      resolveRunContext: vi.fn().mockReturnValue(createRunContext()),
      registerDevice: vi.fn<() => Promise<RegisteredRemoteDevice>>().mockResolvedValue(createDevice())
    };
    const connector = new RemoteConnector({
      platformClient: platformClient as never,
      relayBridgeFactory: () =>
        ({
          ensureLocalUiHealthy: vi.fn().mockResolvedValue(undefined)
        }) as never,
      logger,
      delayFn,
      createSocket: () => {
        const socket = new FakeRemoteConnectorSocket();
        queueMicrotask(() => {
          socket.emit("error", {
            error: new Error("Unexpected server response: 403")
          });
        });
        return socket as unknown as WebSocket;
      }
    });

    await connector.run({
      mode: "service",
      autoReconnect: true,
      statusStore: createStatusWriter(statusWrites)
    });

    expect(delayFn).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("Remote connector error: Unexpected server response: 403");
    expect(statusWrites.at(-1)).toMatchObject({
      enabled: true,
      state: "error",
      lastError: "Unexpected server response: 403"
    });
  });
});
