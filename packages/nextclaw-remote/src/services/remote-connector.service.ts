import {
  RemoteAppAdapter,
  type ConnectorClientCommand,
} from "./remote-app.service.js";
import {
  describeUnexpectedRemoteConnectorClose,
  isTerminalRemoteConnectorError,
} from "../remote-connector-error.js";
import {
  RemoteRelayBridge,
  type RelayRequestFrame,
} from "./remote-relay-bridge.service.js";
import {
  formatReconnectDelay,
  resolveReconnectDelayMs,
} from "../remote-connector-retry.utils.js";
import { readRemoteConnectorSocketErrorMessage } from "../remote-connector-websocket-error.utils.js";
import {
  delay,
  redactWsUrl,
  type RemotePlatformClient,
} from "./remote-platform-client.service.js";
import type {
  RegisteredRemoteDevice,
  RemoteConnectorRunOptions,
  RemoteLogger,
  RemoteRunContext,
} from "../types.js";

const CONNECTOR_KEEPALIVE_INTERVAL_MS = 25_000;
const CONNECTOR_KEEPALIVE_FRAME = JSON.stringify({ type: "connector.ping" });

export class RemoteConnector {
  constructor(
    private readonly deps: {
      platformClient: RemotePlatformClient;
      relayBridgeFactory?: (localOrigin: string) => RemoteRelayBridge;
      logger?: RemoteLogger;
      createSocket?: (wsUrl: string) => WebSocket;
      delayFn?: typeof delay;
      random?: () => number;
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
  private createSocket = (wsUrl: string): WebSocket => {
    return this.deps.createSocket?.(wsUrl) ?? new WebSocket(wsUrl);
  };

  private connectOnce = async (params: {
    wsUrl: string;
    relayBridge: RemoteRelayBridge;
    signal?: AbortSignal;
    statusStore?: RemoteConnectorRunOptions["statusStore"];
    displayName: string;
    deviceId: string;
    platformBase: string;
    localOrigin: string;
    onConnected: () => void;
  }): Promise<"closed" | "aborted"> => {
    return await new Promise<"closed" | "aborted">((resolve, reject) => {
      const socket = this.createSocket(params.wsUrl);
      const appAdapter = new RemoteAppAdapter(params.localOrigin, socket);
      let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
      let settled = false;
      let aborted = false;
      const cleanup = () => {
        if (keepaliveTimer) {
          clearInterval(keepaliveTimer);
          keepaliveTimer = null;
        }
        params.signal?.removeEventListener("abort", onAbort);
      };
      const finishResolve = (value: "closed" | "aborted") => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(value);
      };

      const finishReject = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      };
      const onAbort = () => {
        aborted = true;
        try {
          socket.close(1000, "Remote connector aborted");
        } catch {
          finishResolve("aborted");
        }
      };

      if (params.signal) {
        if (params.signal.aborted) {
          onAbort();
        } else {
          params.signal.addEventListener("abort", onAbort, { once: true });
        }
      }

      socket.addEventListener("open", () => {
        params.onConnected();
        keepaliveTimer = setInterval(() => {
          if (socket.readyState !== 1) {
            return;
          }
          try {
            socket.send(CONNECTOR_KEEPALIVE_FRAME);
          } catch {
            // Let the close/error event drive reconnect behavior.
          }
        }, CONNECTOR_KEEPALIVE_INTERVAL_MS);
        params.statusStore?.write({
          enabled: true,
          state: "connected",
          deviceId: params.deviceId,
          deviceName: params.displayName,
          platformBase: params.platformBase,
          localOrigin: params.localOrigin,
          lastConnectedAt: new Date().toISOString(),
          lastError: null,
        });
        this.logger.info(
          `✓ Remote connector connected: ${redactWsUrl(params.wsUrl)}`,
        );
        void appAdapter.start().catch((error) => {
          this.logger.error(
            `Remote event bridge error: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      });

      socket.addEventListener("message", (event) => {
        this.handleSocketMessage({
          data: event.data,
          relayBridge: params.relayBridge,
          appAdapter,
          socket,
        });
      });

      socket.addEventListener("close", (event) => {
        appAdapter.stop();
        const closeMessage = describeUnexpectedRemoteConnectorClose(
          event ?? {},
        );
        if (!aborted && closeMessage) {
          finishReject(new Error(closeMessage));
          return;
        }
        finishResolve(aborted ? "aborted" : "closed");
      });

      socket.addEventListener("error", (event) => {
        appAdapter.stop();
        if (aborted) {
          finishResolve("aborted");
          return;
        }
        finishReject(new Error(readRemoteConnectorSocketErrorMessage(event)));
      });
    });
  };

  private handleSocketMessage = (params: {
    data: unknown;
    relayBridge: RemoteRelayBridge;
    appAdapter: RemoteAppAdapter;
    socket: WebSocket;
  }): void => {
    void (async () => {
      const frame = this.parseRelayFrame(params.data);
      if (!frame) {
        return;
      }
      try {
        if (frame.type === "request") {
          await params.relayBridge.forward(frame, params.socket);
          return;
        }
        await params.appAdapter.handle(frame);
      } catch (error) {
        if (frame.type === "request") {
          params.socket.send(
            JSON.stringify({
              type: "response.error",
              requestId: frame.requestId,
              message: error instanceof Error ? error.message : String(error),
            }),
          );
          return;
        }
        if (frame.type === "client.request") {
          params.socket.send(
            JSON.stringify({
              type: "client.request.error",
              clientId: frame.clientId,
              id: frame.id,
              message: error instanceof Error ? error.message : String(error),
            }),
          );
          return;
        }
        params.socket.send(
          JSON.stringify({
            type: "client.stream.error",
            clientId: frame.clientId,
            streamId: frame.streamId,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    })();
  };

  private parseRelayFrame = (
    data: unknown,
  ): RelayRequestFrame | ConnectorClientCommand | null => {
    try {
      const frame = JSON.parse(String(data ?? ""));
      if (
        typeof frame !== "object" ||
        !frame ||
        typeof frame.type !== "string"
      ) {
        return null;
      }
      if (frame.type === "request") {
        return frame as RelayRequestFrame;
      }
      if (
        frame.type === "client.request" ||
        frame.type === "client.stream.open" ||
        frame.type === "client.stream.cancel"
      ) {
        return frame as ConnectorClientCommand;
      }
      return null;
    } catch {
      return null;
    }
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
  }): Promise<{
    device: RegisteredRemoteDevice | null;
    outcome: "aborted" | "retry" | "stop";
    retryFailure: boolean;
  }> => {
    const { context, device: initialDevice, opts, relayBridge } = params;
    let device = initialDevice;
    let connectionEstablished = false;
    try {
      opts.statusStore?.write({
        enabled: true,
        state: "connecting",
        deviceId: initialDevice?.id,
        deviceName: context.displayName,
        platformBase: context.platformBase,
        localOrigin: context.localOrigin,
        lastError: null,
      });
      device = await this.ensureDevice({ device, context });
      const wsUrl =
        `${context.platformBase.replace(/^http/i, "ws")}/platform/remote/connect` +
        `?instanceId=${encodeURIComponent(device.id)}&token=${encodeURIComponent(context.token)}`;
      const outcome = await this.connectOnce({
        wsUrl,
        relayBridge,
        signal: opts.signal,
        statusStore: opts.statusStore,
        displayName: context.displayName,
        deviceId: device.id,
        platformBase: context.platformBase,
        localOrigin: context.localOrigin,
        onConnected: () => {
          connectionEstablished = true;
        },
      });
      if (outcome !== "aborted") {
        opts.statusStore?.write({
          enabled: true,
          state: "disconnected",
          deviceId: device.id,
          deviceName: context.displayName,
          platformBase: context.platformBase,
          localOrigin: context.localOrigin,
          lastError: null,
        });
      }
      return {
        device,
        outcome: outcome === "aborted" ? "aborted" : "retry",
        retryFailure: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      opts.statusStore?.write({
        enabled: true,
        state: "error",
        deviceId: initialDevice?.id,
        deviceName: context.displayName,
        platformBase: context.platformBase,
        localOrigin: context.localOrigin,
        lastError: message,
      });
      this.logger.error(`Remote connector error: ${message}`);
      return {
        device,
        outcome: isTerminalRemoteConnectorError(error) ? "stop" : "retry",
        retryFailure: !connectionEstablished,
      };
    }
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

    while (!opts.signal?.aborted) {
      const cycle = await this.runCycle({ device, context, relayBridge, opts });
      device = cycle.device;
      consecutiveReconnectFailures = cycle.retryFailure
        ? consecutiveReconnectFailures + 1
        : 0;
      if (cycle.outcome === "stop") {
        preserveRuntimeError = true;
        break;
      }
      if (
        cycle.outcome === "aborted" ||
        !context.autoReconnect ||
        opts.signal?.aborted
      ) {
        break;
      }
      const reconnectDelayMs = resolveReconnectDelayMs(
        cycle.retryFailure ? consecutiveReconnectFailures : 1,
        this.random,
      );
      this.logger.warn(
        `Remote connector disconnected. Reconnecting in ${formatReconnectDelay(reconnectDelayMs)}...`,
      );
      try {
        await this.delayFn(reconnectDelayMs, opts.signal);
      } catch {
        break;
      }
    }

    if (preserveRuntimeError) {
      return;
    }

    opts.statusStore?.write({
      enabled:
        opts.mode === "service" ? true : Boolean(context.config.remote.enabled),
      state: opts.signal?.aborted ? "disconnected" : "disabled",
      deviceId: device?.id,
      deviceName: context.displayName,
      platformBase: context.platformBase,
      localOrigin: context.localOrigin,
      lastError: null,
    });
  };
}
