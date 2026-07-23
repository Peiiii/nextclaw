import { describe, expect, it, vi } from "vitest";
import { RemoteConnector, type RegisteredRemoteDevice, type RemoteRuntimeState } from "@nextclaw/remote";

class FakeRemoteConnectorSocket {
  readyState = 1;
  readonly sentFrames: string[] = [];
  readonly closeCalls: Array<{ code?: number; reason?: string }> = [];
  private readonly listeners = new Map<string, Array<(event: unknown) => void>>();

  addEventListener = (type: string, listener: (event: unknown) => void): void => {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(listener);
    this.listeners.set(type, handlers);
  };

  close = (code?: number, reason?: string): void => {
    this.readyState = 3;
    this.closeCalls.push({ code, reason });
  };

  send = (data: string): void => {
    this.sentFrames.push(data);
  };

  emit = (type: string, event: unknown): void => {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  };
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
  it("records acknowledged connector heartbeats", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-23T00:00:00.000Z"));
      const statusWrites: Array<Omit<RemoteRuntimeState, "mode" | "updatedAt">> = [];
      const logger = createLogger();
      const socket = new FakeRemoteConnectorSocket();
      const platformClient = {
        resolveRunContext: vi.fn().mockReturnValue({
          ...createRunContext(),
          autoReconnect: false
        }),
        registerDevice: vi.fn<() => Promise<RegisteredRemoteDevice>>().mockResolvedValue(createDevice())
      };
      const connector = new RemoteConnector({
        platformClient: platformClient as never,
        relayBridgeFactory: () =>
          ({
            ensureLocalUiHealthy: vi.fn().mockResolvedValue(undefined)
          }) as never,
        logger,
        createConnectionId: () => "connection-a",
        createSocket: () => {
          queueMicrotask(() => {
            socket.emit("open", {});
          });
          return socket as unknown as WebSocket;
        }
      });

      const runTask = connector.run({
        mode: "service",
        autoReconnect: false,
        statusStore: createStatusWriter(statusWrites)
      });

      await vi.advanceTimersByTimeAsync(0);
      socket.emit("message", {
        data: JSON.stringify({
          type: "connector.ready",
          connectionId: "connection-a",
          protocolVersion: 1,
          heartbeatAck: true
        })
      });
      await vi.advanceTimersByTimeAsync(25_000);
      const ping = JSON.parse(socket.sentFrames.at(-1) ?? "{}");
      socket.emit("message", {
        data: JSON.stringify({
          type: "connector.pong",
          connectionId: "connection-a",
          heartbeatId: ping.heartbeatId,
          sentAt: ping.sentAt,
          serverAt: "2026-07-23T00:00:25.000Z"
        })
      });
      socket.emit("close", {
        code: 1000,
        reason: "",
        wasClean: true
      });
      await runTask;

      expect(ping).toMatchObject({
        type: "connector.ping",
        connectionId: "connection-a",
        sentAt: "2026-07-23T00:00:25.000Z"
      });
      expect(ping.heartbeatId).toEqual(expect.any(String));
      expect(statusWrites).toContainEqual(expect.objectContaining({
        state: "connected",
        connection: expect.objectContaining({
          connectionId: "connection-a",
          heartbeatSupported: true,
          lastHeartbeatAckAt: "2026-07-23T00:00:25.000Z",
          lastHeartbeatLatencyMs: 0
        })
      }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps compatibility with a relay that does not advertise heartbeat acknowledgements", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-23T00:00:00.000Z"));
      const statusWrites: Array<Omit<RemoteRuntimeState, "mode" | "updatedAt">> = [];
      const logger = createLogger();
      const socket = new FakeRemoteConnectorSocket();
      const platformClient = {
        resolveRunContext: vi.fn().mockReturnValue({
          ...createRunContext(),
          autoReconnect: false
        }),
        registerDevice: vi.fn<() => Promise<RegisteredRemoteDevice>>().mockResolvedValue(createDevice())
      };
      const connector = new RemoteConnector({
        platformClient: platformClient as never,
        relayBridgeFactory: () =>
          ({
            ensureLocalUiHealthy: vi.fn().mockResolvedValue(undefined)
          }) as never,
        logger,
        createConnectionId: () => "connection-legacy",
        createSocket: () => {
          queueMicrotask(() => socket.emit("open", {}));
          return socket as unknown as WebSocket;
        }
      });

      const runTask = connector.run({
        mode: "service",
        autoReconnect: false,
        statusStore: createStatusWriter(statusWrites)
      });
      await vi.advanceTimersByTimeAsync(100_000);

      expect(socket.sentFrames).toHaveLength(4);
      expect(socket.closeCalls).toHaveLength(0);
      expect(statusWrites.at(-1)?.connection).toMatchObject({
        heartbeatSupported: false
      });

      socket.emit("close", { code: 1000, reason: "", wasClean: true });
      await runTask;
    } finally {
      vi.useRealTimers();
    }
  });

  it("records and reconnects after an advertised heartbeat times out", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-23T00:00:00.000Z"));
      const statusWrites: Array<Omit<RemoteRuntimeState, "mode" | "updatedAt">> = [];
      const logger = createLogger();
      const socket = new FakeRemoteConnectorSocket();
      const platformClient = {
        resolveRunContext: vi.fn().mockReturnValue({
          ...createRunContext(),
          autoReconnect: false
        }),
        registerDevice: vi.fn<() => Promise<RegisteredRemoteDevice>>().mockResolvedValue(createDevice())
      };
      const connector = new RemoteConnector({
        platformClient: platformClient as never,
        relayBridgeFactory: () =>
          ({
            ensureLocalUiHealthy: vi.fn().mockResolvedValue(undefined)
          }) as never,
        logger,
        createConnectionId: () => "connection-timeout",
        createSocket: () => {
          queueMicrotask(() => socket.emit("open", {}));
          return socket as unknown as WebSocket;
        }
      });

      const runTask = connector.run({
        mode: "service",
        autoReconnect: false,
        statusStore: createStatusWriter(statusWrites)
      });
      await vi.advanceTimersByTimeAsync(0);
      socket.emit("message", {
        data: JSON.stringify({
          type: "connector.ready",
          connectionId: "connection-timeout",
          protocolVersion: 1,
          heartbeatAck: true
        })
      });
      await vi.advanceTimersByTimeAsync(100_000);
      await runTask;

      expect(socket.closeCalls).toContainEqual({
        code: 4000,
        reason: "Remote connector heartbeat timed out"
      });
      expect(statusWrites).toContainEqual(expect.objectContaining({
        state: "error",
        connection: expect.objectContaining({
          disconnectCount: 1,
          lastDisconnect: expect.objectContaining({
            source: "heartbeat_timeout",
            connectionId: "connection-timeout"
          })
        })
      }));
    } finally {
      vi.useRealTimers();
    }
  });

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
    expect(logger.error).toHaveBeenCalledWith(
      "Remote connector error: Invalid or expired token.",
      expect.objectContaining({ event: "remote.connector.connect_failed" })
    );
    expect(statusWrites.at(-1)).toMatchObject({
      enabled: true,
      state: "error",
      lastError: "Invalid or expired token."
    });
  });
});

describe("RemoteConnector reconnect backoff", () => {
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
    expect(logger.error).toHaveBeenLastCalledWith(
      "Remote connector error: connect ECONNREFUSED 127.0.0.1:443",
      expect.objectContaining({ event: "remote.connector.connect_failed" })
    );
    expect(statusWrites.at(-1)).toMatchObject({
      enabled: true,
      state: "disconnected",
      lastError: null
    });
  });

  it("resets failed handshake backoff after a websocket connection opens", async () => {
    const statusWrites: Array<Omit<RemoteRuntimeState, "mode" | "updatedAt">> = [];
    const logger = createLogger();
    const delayCalls: number[] = [];
    const abortController = new AbortController();
    const platformClient = {
      resolveRunContext: vi.fn().mockReturnValue(createRunContext()),
      registerDevice: vi.fn<() => Promise<RegisteredRemoteDevice>>().mockResolvedValue(createDevice())
    };
    let socketAttempt = 0;
    const connector = new RemoteConnector({
      platformClient: platformClient as never,
      relayBridgeFactory: () =>
        ({
          ensureLocalUiHealthy: vi.fn().mockResolvedValue(undefined)
        }) as never,
      logger,
      delayFn: vi.fn(async (delayMs: number) => {
        delayCalls.push(delayMs);
        if (delayCalls.length === 4) {
          abortController.abort();
        }
      }),
      random: () => 0.5,
      createSocket: () => {
        socketAttempt += 1;
        const socket = new FakeRemoteConnectorSocket();
        queueMicrotask(() => {
          if (socketAttempt < 4) {
            socket.emit("error", {
              error: new Error("connect ECONNREFUSED 127.0.0.1:443")
            });
            return;
          }
          socket.emit("open", {});
          socket.emit("close", {
            code: 1006,
            reason: "",
            wasClean: false
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

    expect(delayCalls).toEqual([3_000, 6_000, 12_000, 3_000]);
    expect(statusWrites.some((entry) => entry.state === "connected")).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(4);
  });

  it("retains a recovered 1006 disconnect in runtime diagnostics", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-07-23T00:00:00.000Z"));
      const statusWrites: Array<Omit<RemoteRuntimeState, "mode" | "updatedAt">> = [];
      const abortController = new AbortController();
      const platformClient = {
        resolveRunContext: vi.fn().mockReturnValue(createRunContext()),
        registerDevice: vi.fn<() => Promise<RegisteredRemoteDevice>>().mockResolvedValue(createDevice())
      };
      let socketAttempt = 0;
      let connectionAttempt = 0;
      const connector = new RemoteConnector({
        platformClient: platformClient as never,
        relayBridgeFactory: () =>
          ({
            ensureLocalUiHealthy: vi.fn().mockResolvedValue(undefined)
          }) as never,
        logger: createLogger(),
        delayFn: vi.fn(async () => undefined),
        random: () => 0.5,
        createConnectionId: () => `connection-${++connectionAttempt}`,
        createSocket: () => {
          const socket = new FakeRemoteConnectorSocket();
          socketAttempt += 1;
          queueMicrotask(() => {
            if (socketAttempt === 1) {
              socket.emit("open", {});
              vi.setSystemTime(new Date("2026-07-23T00:00:01.000Z"));
              socket.emit("close", {
                code: 1006,
                reason: "",
                wasClean: false
              });
              return;
            }
            if (socketAttempt === 2) {
              vi.setSystemTime(new Date("2026-07-23T00:00:04.000Z"));
              socket.emit("open", {});
              vi.setSystemTime(new Date("2026-07-23T00:00:05.000Z"));
              socket.emit("close", {
                code: 1000,
                reason: "",
                wasClean: true
              });
              return;
            }
            vi.setSystemTime(new Date("2026-07-23T00:00:08.000Z"));
            socket.emit("open", {});
            queueMicrotask(() => {
              abortController.abort();
              socket.emit("close", {
                code: 1000,
                reason: "Remote connector aborted",
                wasClean: true
              });
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

      expect(statusWrites.at(-1)?.connection).toMatchObject({
        connectionId: "connection-3",
        disconnectCount: 1,
        lastDisconnect: {
          source: "close",
          connectionId: "connection-1",
          at: "2026-07-23T00:00:01.000Z",
          code: 1006,
          reason: null,
          wasClean: false,
          connectedDurationMs: 1000
        },
        lastRecoveredAt: "2026-07-23T00:00:04.000Z",
        lastRecoveryDurationMs: 3000
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("RemoteConnector terminal websocket errors", () => {
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
    expect(logger.error).toHaveBeenCalledWith(
      "Remote connector error: Unexpected server response: 403",
      expect.objectContaining({ event: "remote.connector.connect_failed" })
    );
    expect(statusWrites.at(-1)).toMatchObject({
      enabled: true,
      state: "error",
      lastError: "Unexpected server response: 403"
    });
  });

  it("stops reconnecting when the platform replaces the connector with a newer session", async () => {
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
          socket.emit("open", {});
          socket.emit("close", {
            code: 1012,
            reason: "Replaced by a newer connector session.",
            wasClean: true
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
    expect(logger.error).toHaveBeenCalledWith(
      "Remote connector error: Remote connector websocket closed (code 1012, clean): Replaced by a newer connector session.",
      expect.objectContaining({
        event: "remote.connector.disconnected",
        closeCode: 1012
      })
    );
    expect(statusWrites.at(-1)).toMatchObject({
      enabled: true,
      state: "error",
      lastError: "Remote connector websocket closed (code 1012, clean): Replaced by a newer connector session."
    });
  });
});
