import { RemoteAppAdapter } from "./remote-app.adapter.js";
import { isTerminalRemoteConnectorError } from "./remote-connector-error.js";
import { RemoteRelayBridge, type RelayRequestFrame } from "./remote-relay-bridge.js";
import { RemotePlatformClient, delay, redactWsUrl } from "./remote-platform-client.js";
import type {
  RegisteredRemoteDevice,
  RemoteConnectorRunOptions,
  RemoteLogger,
  RemoteRunContext
} from "./types.js";

export class RemoteConnector {
  constructor(
    private readonly deps: {
      platformClient: RemotePlatformClient;
      relayBridgeFactory?: (localOrigin: string) => RemoteRelayBridge;
      logger?: RemoteLogger;
    }
  ) {}

  private get logger(): RemoteLogger {
    return this.deps.logger ?? console;
  }

  private async connectOnce(params: {
    wsUrl: string;
    relayBridge: RemoteRelayBridge;
    signal?: AbortSignal;
    statusStore?: RemoteConnectorRunOptions["statusStore"];
    displayName: string;
    deviceId: string;
    platformBase: string;
    localOrigin: string;
  }): Promise<"closed" | "aborted"> {
    return await new Promise<"closed" | "aborted">((resolve, reject) => {
      const socket = new WebSocket(params.wsUrl);
      const appAdapter = new RemoteAppAdapter(params.localOrigin, socket);
      let settled = false;
      let aborted = false;

      const cleanup = () => {
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
        params.statusStore?.write({
          enabled: true,
          state: "connected",
          deviceId: params.deviceId,
          deviceName: params.displayName,
          platformBase: params.platformBase,
          localOrigin: params.localOrigin,
          lastConnectedAt: new Date().toISOString(),
          lastError: null
        });
        this.logger.info(`✓ Remote connector connected: ${redactWsUrl(params.wsUrl)}`);
        void appAdapter.start().catch((error) => {
          this.logger.error(`Remote event bridge error: ${error instanceof Error ? error.message : String(error)}`);
        });
      });

      socket.addEventListener("message", (event) => {
        this.handleSocketMessage({
          data: event.data,
          relayBridge: params.relayBridge,
          appAdapter,
          socket
        });
      });

      socket.addEventListener("close", () => {
        appAdapter.stop();
        finishResolve(aborted ? "aborted" : "closed");
      });

      socket.addEventListener("error", () => {
        appAdapter.stop();
        if (aborted) {
          finishResolve("aborted");
          return;
        }
        finishReject(new Error("Remote connector websocket failed."));
      });
    });
  }

  private handleSocketMessage(params: {
    data: unknown;
    relayBridge: RemoteRelayBridge;
    appAdapter: RemoteAppAdapter;
    socket: WebSocket;
  }): void {
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
          params.socket.send(JSON.stringify({
            type: "response.error",
            requestId: frame.requestId,
            message: error instanceof Error ? error.message : String(error)
          }));
          return;
        }
        if (frame.type === "client.request") {
          params.socket.send(JSON.stringify({
            type: "client.request.error",
            clientId: frame.clientId,
            id: frame.id,
            message: error instanceof Error ? error.message : String(error)
          }));
          return;
        }
        params.socket.send(JSON.stringify({
          type: "client.stream.error",
          clientId: frame.clientId,
          streamId: frame.streamId,
          message: error instanceof Error ? error.message : String(error)
        }));
      }
    })();
  }

  private parseRelayFrame(data: unknown): (
    | RelayRequestFrame
    | {
      type: "client.request";
      clientId: string;
      id: string;
      target: { method: string; path: string; body?: unknown };
    }
    | {
      type: "client.stream.open";
      clientId: string;
      streamId: string;
      target: { method: string; path: string; body?: unknown };
    }
    | {
      type: "client.stream.cancel";
      clientId: string;
      streamId: string;
    }
  ) | null {
    try {
      const frame = JSON.parse(String(data ?? ""));
      if (typeof frame !== "object" || !frame || typeof frame.type !== "string") {
        return null;
      }
      if (frame.type === "request") {
        return frame as RelayRequestFrame;
      }
      if (
        frame.type === "client.request"
        || frame.type === "client.stream.open"
        || frame.type === "client.stream.cancel"
      ) {
        return frame as {
          type: "client.request";
          clientId: string;
          id: string;
          target: { method: string; path: string; body?: unknown };
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private async ensureDevice(params: {
    device: RegisteredRemoteDevice | null;
    context: RemoteRunContext;
  }): Promise<RegisteredRemoteDevice> {
    if (params.device) {
      return params.device;
    }
    const device = await this.deps.platformClient.registerDevice({
      platformBase: params.context.platformBase,
      token: params.context.token,
      deviceInstallId: params.context.deviceInstallId,
      displayName: params.context.displayName,
      localOrigin: params.context.localOrigin
    });
    this.logger.info(`✓ Remote instance registered: ${device.displayName} (${device.id})`);
    this.logger.info(`✓ Local origin: ${params.context.localOrigin}`);
    this.logger.info(`✓ Platform: ${params.context.platformBase}`);
    return device;
  }

  private writeRemoteState(
    statusStore: RemoteConnectorRunOptions["statusStore"],
    next: Parameters<NonNullable<RemoteConnectorRunOptions["statusStore"]>["write"]>[0]
  ): void {
    statusStore?.write(next);
  }

  private async runCycle(params: {
    device: RegisteredRemoteDevice | null;
    context: RemoteRunContext;
    relayBridge: RemoteRelayBridge;
    opts: RemoteConnectorRunOptions;
  }): Promise<{ device: RegisteredRemoteDevice | null; outcome: "aborted" | "retry" | "stop" }> {
    try {
      this.writeRemoteState(params.opts.statusStore, {
        enabled: true,
        state: "connecting",
        deviceId: params.device?.id,
        deviceName: params.context.displayName,
        platformBase: params.context.platformBase,
        localOrigin: params.context.localOrigin,
        lastError: null
      });
      const device = await this.ensureDevice({ device: params.device, context: params.context });
      const wsUrl =
        `${params.context.platformBase.replace(/^http/i, "ws")}/platform/remote/connect`
        + `?instanceId=${encodeURIComponent(device.id)}&token=${encodeURIComponent(params.context.token)}`;
      const outcome = await this.connectOnce({
        wsUrl,
        relayBridge: params.relayBridge,
        signal: params.opts.signal,
        statusStore: params.opts.statusStore,
        displayName: params.context.displayName,
        deviceId: device.id,
        platformBase: params.context.platformBase,
        localOrigin: params.context.localOrigin
      });
      if (outcome !== "aborted") {
        this.writeRemoteState(params.opts.statusStore, {
          enabled: true,
          state: "disconnected",
          deviceId: device.id,
          deviceName: params.context.displayName,
          platformBase: params.context.platformBase,
          localOrigin: params.context.localOrigin,
          lastError: null
        });
      }
      return { device, outcome: outcome === "aborted" ? "aborted" : "retry" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.writeRemoteState(params.opts.statusStore, {
        enabled: true,
        state: "error",
        deviceId: params.device?.id,
        deviceName: params.context.displayName,
        platformBase: params.context.platformBase,
        localOrigin: params.context.localOrigin,
        lastError: message
      });
      this.logger.error(`Remote connector error: ${message}`);
      return {
        device: params.device,
        outcome: isTerminalRemoteConnectorError(error) ? "stop" : "retry"
      };
    }
  }

  async run(opts: RemoteConnectorRunOptions = {}): Promise<void> {
    const context = this.deps.platformClient.resolveRunContext(opts);
    const relayBridge = (this.deps.relayBridgeFactory ?? ((localOrigin) => new RemoteRelayBridge(localOrigin)))(
      context.localOrigin
    );
    await relayBridge.ensureLocalUiHealthy();
    let device: RegisteredRemoteDevice | null = null;
    let preserveRuntimeError = false;

    while (!opts.signal?.aborted) {
      const cycle = await this.runCycle({ device, context, relayBridge, opts });
      device = cycle.device;
      if (cycle.outcome === "stop") {
        preserveRuntimeError = true;
        break;
      }
      if (cycle.outcome === "aborted" || !context.autoReconnect || opts.signal?.aborted) {
        break;
      }
      this.logger.warn("Remote connector disconnected. Reconnecting in 3s...");
      try {
        await delay(3_000, opts.signal);
      } catch {
        break;
      }
    }

    if (preserveRuntimeError) {
      return;
    }

    this.writeRemoteState(opts.statusStore, {
      enabled: opts.mode === "service" ? true : Boolean(context.config.remote.enabled),
      state: opts.signal?.aborted ? "disconnected" : "disabled",
      deviceId: device?.id,
      deviceName: context.displayName,
      platformBase: context.platformBase,
      localOrigin: context.localOrigin,
      lastError: null
    });
  }
}
