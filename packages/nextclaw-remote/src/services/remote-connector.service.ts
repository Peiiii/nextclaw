import {
  isTerminalRemoteConnectorError,
  RemoteConnectorDisconnectError,
} from "../utils/remote-connector-error.utils.js";
import { RemoteConnectorSocketService } from "./remote-connector-socket.service.js";
import { RemoteRelayBridge } from "./remote-relay-bridge.service.js";
import {
  formatReconnectDelay,
  resolveReconnectDelayMs,
} from "../remote-connector-retry.utils.js";
import {
  delay,
  type RemotePlatformClient,
} from "./remote-platform-client.service.js";
import {
  createRemoteConnectorRuntime,
  recordRemoteConnected,
  recordRemoteCycleClosed,
  recordRemoteDisconnect,
  recordRemoteHeartbeatAcknowledged,
  recordRemoteHeartbeatCapability,
  recordRemoteHeartbeatSent,
  recordRemoteReconnectScheduled,
  startRemoteConnectionCycle,
  type RemoteConnectorRuntimeDiagnostics,
} from "../utils/remote-connector-diagnostics.utils.js";
import type {
  RegisteredRemoteDevice,
  RemoteConnectorRunOptions,
  RemoteLogger,
  RemoteRunContext,
  RemoteRuntimeState,
} from "../types/remote.types.js";

type RemoteConnectorCycleResult = {
  device: RegisteredRemoteDevice | null;
  runtime: RemoteConnectorRuntimeDiagnostics;
  lastError: string | null;
  outcome: "aborted" | "retry" | "stop";
  retryFailure: boolean;
};

export class RemoteConnector {
  constructor(
    private readonly deps: {
      platformClient: RemotePlatformClient;
      relayBridgeFactory?: (localOrigin: string) => RemoteRelayBridge;
      logger?: RemoteLogger;
      createSocket?: (wsUrl: string) => WebSocket;
      delayFn?: typeof delay;
      random?: () => number;
      now?: () => Date;
      createConnectionId?: () => string;
    },
  ) {}
  private get logger(): RemoteLogger {
    return this.deps.logger ?? console;
  }
  private get delayFn(): typeof delay {
    return this.deps.delayFn ?? delay;
  }
  private get random(): () => number {
    return this.deps.random ?? Math.random;
  }
  private get now(): () => Date {
    return this.deps.now ?? (() => new Date());
  }
  private get createConnectionId(): () => string {
    return this.deps.createConnectionId ?? (() => crypto.randomUUID());
  }
  private createSocket = (wsUrl: string): WebSocket => {
    return this.deps.createSocket?.(wsUrl) ?? new WebSocket(wsUrl);
  };
  private writeRuntimeStatus = (params: {
    opts: RemoteConnectorRunOptions;
    context: RemoteRunContext;
    runtime: RemoteConnectorRuntimeDiagnostics;
    state: RemoteRuntimeState["state"];
    deviceId?: string;
    lastError: string | null;
    enabled?: boolean;
  }): void => {
    const { context, deviceId, enabled, lastError, opts, runtime, state } =
      params;
    opts.statusStore?.write({
      enabled: enabled ?? true,
      state,
      deviceId,
      deviceName: context.displayName,
      platformBase: context.platformBase,
      localOrigin: context.localOrigin,
      lastConnectedAt: runtime.lastConnectedAt,
      lastError,
      connection: runtime.connection,
    });
  };

  private ensureDevice = async (params: {
    device: RegisteredRemoteDevice | null;
    context: RemoteRunContext;
  }): Promise<RegisteredRemoteDevice> => {
    const { context, device } = params;
    if (device) {
      return device;
    }
    const registeredDevice = await this.deps.platformClient.registerDevice({
      platformBase: context.platformBase,
      token: context.token,
      deviceInstallId: context.deviceInstallId,
      displayName: context.displayName,
      localOrigin: context.localOrigin,
    });
    this.logger.info(
      `✓ Remote instance registered: ${registeredDevice.displayName} (${registeredDevice.id})`,
    );
    this.logger.info(`✓ Local origin: ${context.localOrigin}`);
    this.logger.info(`✓ Platform: ${context.platformBase}`);
    return registeredDevice;
  };

  private runCycle = async (params: {
    device: RegisteredRemoteDevice | null;
    context: RemoteRunContext;
    relayBridge: RemoteRelayBridge;
    opts: RemoteConnectorRunOptions;
    runtime: RemoteConnectorRuntimeDiagnostics;
  }): Promise<RemoteConnectorCycleResult> => {
    const { context, device: initialDevice, opts, relayBridge } = params;
    const connectionId = this.createConnectionId();
    let device = initialDevice;
    let runtime = startRemoteConnectionCycle(params.runtime, connectionId);
    let connectionEstablished = false;
    try {
      this.writeRuntimeStatus({
        opts,
        context,
        runtime,
        state: "connecting",
        deviceId: device?.id,
        lastError: null,
      });
      device = await this.ensureDevice({ device, context });
      const wsUrl =
        `${context.platformBase.replace(/^http/i, "ws")}/platform/remote/connect` +
        `?instanceId=${encodeURIComponent(device.id)}` +
        `&token=${encodeURIComponent(context.token)}` +
        `&connectionId=${encodeURIComponent(connectionId)}`;
      const socketService = new RemoteConnectorSocketService({
        logger: this.logger,
        createSocket: this.createSocket,
        now: this.now,
      });
      const outcome = await socketService.connect({
        wsUrl,
        connectionId,
        relayBridge,
        signal: opts.signal,
        deviceId: device.id,
        localOrigin: context.localOrigin,
        onConnected: (connectedAt) => {
          connectionEstablished = true;
          runtime = recordRemoteConnected(runtime, connectedAt);
          this.writeRuntimeStatus({
            opts,
            context,
            runtime,
            state: "connected",
            deviceId: device?.id,
            lastError: null,
          });
        },
        onHeartbeatCapability: () => {
          runtime = recordRemoteHeartbeatCapability(runtime);
          this.writeRuntimeStatus({
            opts,
            context,
            runtime,
            state: "connected",
            deviceId: device?.id,
            lastError: null,
          });
        },
        onHeartbeatSent: (sentAt) => {
          runtime = recordRemoteHeartbeatSent(runtime, sentAt);
          this.writeRuntimeStatus({
            opts,
            context,
            runtime,
            state: "connected",
            deviceId: device?.id,
            lastError: null,
          });
        },
        onHeartbeatAcknowledged: ({ acknowledgedAt, latencyMs }) => {
          runtime = recordRemoteHeartbeatAcknowledged(runtime, {
            acknowledgedAt,
            latencyMs,
          });
          this.writeRuntimeStatus({
            opts,
            context,
            runtime,
            state: "connected",
            deviceId: device?.id,
            lastError: null,
          });
        },
      });
      runtime = recordRemoteCycleClosed(runtime);
      this.writeRuntimeStatus({
        opts,
        context,
        runtime,
        state: "disconnected",
        deviceId: device.id,
        lastError: null,
      });
      return {
        device,
        runtime,
        lastError: null,
        outcome: outcome === "aborted" ? "aborted" : "retry",
        retryFailure: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof RemoteConnectorDisconnectError) {
        runtime = recordRemoteDisconnect(runtime, error.observation);
      }
      this.writeRuntimeStatus({
        opts,
        context,
        runtime,
        state: "error",
        deviceId: device?.id,
        lastError: message,
      });
      const disconnect =
        error instanceof RemoteConnectorDisconnectError
          ? error.observation
          : null;
      this.logger.error(`Remote connector error: ${message}`, {
        event: disconnect
          ? "remote.connector.disconnected"
          : "remote.connector.connect_failed",
        connectionId,
        deviceId: device?.id ?? null,
        disconnectSource: disconnect?.source ?? null,
        disconnectedAt: disconnect?.at ?? null,
        closeCode: disconnect?.code ?? null,
        closeReason: disconnect?.reason ?? null,
        wasClean: disconnect?.wasClean ?? null,
        connectedDurationMs: disconnect?.connectedDurationMs ?? null,
      });
      return {
        device,
        runtime,
        lastError: message,
        outcome: isTerminalRemoteConnectorError(error) ? "stop" : "retry",
        retryFailure: !connectionEstablished,
      };
    }
  };

  private scheduleReconnect = (params: {
    context: RemoteRunContext;
    opts: RemoteConnectorRunOptions;
    device: RegisteredRemoteDevice | null;
    runtime: RemoteConnectorRuntimeDiagnostics;
    cycle: RemoteConnectorCycleResult;
    consecutiveReconnectFailures: number;
  }): {
    runtime: RemoteConnectorRuntimeDiagnostics;
    reconnectDelayMs: number;
  } => {
    const {
      consecutiveReconnectFailures,
      context,
      cycle,
      device,
      opts,
    } = params;
    const reconnectDelayMs = resolveReconnectDelayMs(
      cycle.retryFailure ? consecutiveReconnectFailures : 1,
      this.random,
    );
    const nextReconnectAt = new Date(
      this.now().getTime() + reconnectDelayMs,
    ).toISOString();
    const runtime = recordRemoteReconnectScheduled(params.runtime, {
      consecutiveFailures: consecutiveReconnectFailures,
      reconnectAttempt: cycle.retryFailure
        ? consecutiveReconnectFailures
        : 1,
      nextReconnectAt,
    });
    this.writeRuntimeStatus({
      opts,
      context,
      runtime,
      state: cycle.lastError ? "error" : "disconnected",
      deviceId: device?.id,
      lastError: cycle.lastError,
    });
    this.logger.warn(
      `Remote connector disconnected. Reconnecting in ${formatReconnectDelay(reconnectDelayMs)}...`,
      {
        event: "remote.connector.reconnect_scheduled",
        connectionId: runtime.connection.connectionId,
        deviceId: device?.id ?? null,
        attempt: runtime.connection.reconnectAttempt,
        delayMs: reconnectDelayMs,
        nextReconnectAt,
      },
    );
    return { runtime, reconnectDelayMs };
  };

  run = async (opts: RemoteConnectorRunOptions = {}): Promise<void> => {
    const context = this.deps.platformClient.resolveRunContext(opts);
    const relayBridge = (
      this.deps.relayBridgeFactory ??
      ((localOrigin) => new RemoteRelayBridge(localOrigin))
    )(context.localOrigin);
    await relayBridge.ensureLocalUiHealthy();
    let device: RegisteredRemoteDevice | null = null;
    let preserveRuntimeError = false;
    let consecutiveReconnectFailures = 0;
    let runtime = createRemoteConnectorRuntime(this.now());

    while (!opts.signal?.aborted) {
      const cycle = await this.runCycle({
        device,
        context,
        relayBridge,
        opts,
        runtime,
      });
      device = cycle.device;
      runtime = cycle.runtime;
      consecutiveReconnectFailures = cycle.retryFailure
        ? consecutiveReconnectFailures + 1
        : 0;
      if (cycle.outcome === "stop") {
        preserveRuntimeError = true;
        break;
      }
      if (cycle.outcome === "aborted" || opts.signal?.aborted) {
        break;
      }
      if (!context.autoReconnect) {
        preserveRuntimeError = Boolean(cycle.lastError);
        break;
      }
      const reconnect = this.scheduleReconnect({
        context,
        opts,
        device,
        runtime,
        cycle,
        consecutiveReconnectFailures,
      });
      runtime = reconnect.runtime;
      try {
        await this.delayFn(reconnect.reconnectDelayMs, opts.signal);
      } catch {
        break;
      }
    }

    if (preserveRuntimeError) {
      return;
    }

    runtime = recordRemoteCycleClosed(runtime);
    this.writeRuntimeStatus({
      opts,
      context,
      runtime,
      enabled:
        opts.mode === "service" ? true : Boolean(context.config.remote.enabled),
      state: opts.signal?.aborted ? "disconnected" : "disabled",
      deviceId: device?.id,
      lastError: null,
    });
  };
}
