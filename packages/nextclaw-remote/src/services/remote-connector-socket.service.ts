import {
  RemoteAppAdapter,
  type ConnectorClientCommand,
} from "./remote-app.service.js";
import {
  createRemoteConnectorCloseError,
  createRemoteConnectorTransportError,
} from "../utils/remote-connector-error.utils.js";
import {
  parseRemoteConnectorControlFrame,
} from "../utils/remote-connector-diagnostics.utils.js";
import { readRemoteConnectorSocketErrorMessage } from "../remote-connector-websocket-error.utils.js";
import {
  RemoteRelayBridge,
  type RelayRequestFrame,
} from "./remote-relay-bridge.service.js";
import type { RemoteLogger } from "../types/remote.types.js";

const CONNECTOR_KEEPALIVE_INTERVAL_MS = 25_000;
const CONNECTOR_KEEPALIVE_TIMEOUT_MS = 65_000;

type RemoteConnectorSocketConnectParams = {
  wsUrl: string;
  connectionId: string;
  relayBridge: RemoteRelayBridge;
  signal?: AbortSignal;
  deviceId: string;
  localOrigin: string;
  onConnected: (connectedAt: string) => void;
  onHeartbeatCapability: () => void;
  onHeartbeatSent: (sentAt: string) => void;
  onHeartbeatAcknowledged: (params: {
    sentAt: string;
    acknowledgedAt: string;
    latencyMs: number;
  }) => void;
};

type RemoteConnectorSocketDeps = {
  logger: RemoteLogger;
  createSocket: (wsUrl: string) => WebSocket;
  now: () => Date;
};

type PendingHeartbeat = {
  id: string;
  sentAt: string;
  sentAtMs: number;
};

type RemoteConnectorCloseEvent = {
  code?: unknown;
  reason?: unknown;
  wasClean?: unknown;
};

class RemoteConnectorSocketSession {
  private readonly socket: WebSocket;
  private readonly appAdapter: RemoteAppAdapter;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private connectedAt: string | null = null;
  private heartbeatSupported = false;
  private pendingHeartbeat: PendingHeartbeat | null = null;
  private settled = false;
  private aborted = false;

  constructor(
    private readonly deps: RemoteConnectorSocketDeps,
    private readonly params: RemoteConnectorSocketConnectParams,
    private readonly resolve: (value: "closed" | "aborted") => void,
    private readonly reject: (error: Error) => void,
  ) {
    this.socket = deps.createSocket(params.wsUrl);
    this.appAdapter = new RemoteAppAdapter(params.localOrigin, this.socket);
  }

  start = (): void => {
    this.socket.addEventListener("open", this.onOpen);
    this.socket.addEventListener("message", this.onMessage);
    this.socket.addEventListener("close", this.onClose);
    this.socket.addEventListener("error", this.onError);
    const { signal } = this.params;
    if (signal?.aborted) {
      this.onAbort();
    } else {
      signal?.addEventListener("abort", this.onAbort, { once: true });
    }
  };

  private cleanup = (): void => {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
    this.params.signal?.removeEventListener("abort", this.onAbort);
  };

  private finishResolve = (value: "closed" | "aborted"): void => {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.cleanup();
    this.resolve(value);
  };

  private finishReject = (error: Error): void => {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.cleanup();
    this.reject(error);
  };

  private onAbort = (): void => {
    this.aborted = true;
    try {
      this.socket.close(1000, "Remote connector aborted");
    } catch {
      this.finishResolve("aborted");
    }
  };

  private onOpen = (): void => {
    this.connectedAt = this.deps.now().toISOString();
    this.params.onConnected(this.connectedAt);
    this.keepaliveTimer = setInterval(
      this.sendHeartbeat,
      CONNECTOR_KEEPALIVE_INTERVAL_MS,
    );
    this.deps.logger.info("Remote connector connected.", {
      event: "remote.connector.connected",
      connectionId: this.params.connectionId,
      deviceId: this.params.deviceId,
      connectedAt: this.connectedAt,
    });
    void this.appAdapter.start().catch((error) => {
      this.deps.logger.error(
        `Remote event bridge error: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  };

  private sendHeartbeat = (): void => {
    if (this.socket.readyState !== 1) {
      return;
    }
    const now = this.deps.now();
    if (this.isHeartbeatTimedOut(now)) {
      this.rejectHeartbeatTimeout(now);
      return;
    }
    if (this.heartbeatSupported && this.pendingHeartbeat) {
      return;
    }
    const heartbeat: PendingHeartbeat = {
      id: crypto.randomUUID(),
      sentAt: now.toISOString(),
      sentAtMs: now.getTime(),
    };
    try {
      this.socket.send(JSON.stringify({
        type: "connector.ping",
        connectionId: this.params.connectionId,
        heartbeatId: heartbeat.id,
        sentAt: heartbeat.sentAt,
      }));
      this.pendingHeartbeat = this.heartbeatSupported ? heartbeat : null;
      this.params.onHeartbeatSent(heartbeat.sentAt);
    } catch {
      // Let the close/error event drive reconnect behavior.
    }
  };

  private isHeartbeatTimedOut = (now: Date): boolean => {
    return Boolean(
      this.heartbeatSupported &&
      this.pendingHeartbeat &&
      now.getTime() - this.pendingHeartbeat.sentAtMs >=
        CONNECTOR_KEEPALIVE_TIMEOUT_MS,
    );
  };

  private rejectHeartbeatTimeout = (now: Date): void => {
    const error = createRemoteConnectorTransportError({
      message: `Remote connector heartbeat timed out after ${CONNECTOR_KEEPALIVE_TIMEOUT_MS}ms.`,
      source: "heartbeat_timeout",
      connectionId: this.params.connectionId,
      connectedAt: this.connectedAt,
      now,
    });
    try {
      this.socket.close(4000, "Remote connector heartbeat timed out");
    } catch {
      // The rejected cycle still enters the canonical reconnect path.
    }
    this.finishReject(error);
  };

  private onMessage = (event: MessageEvent): void => {
    const controlFrame = parseRemoteConnectorControlFrame(event.data);
    if (
      controlFrame?.type === "connector.ready" &&
      controlFrame.connectionId === this.params.connectionId &&
      controlFrame.heartbeatAck
    ) {
      this.heartbeatSupported = true;
      this.params.onHeartbeatCapability();
      return;
    }
    if (
      controlFrame?.type === "connector.pong" &&
      controlFrame.connectionId === this.params.connectionId &&
      this.pendingHeartbeat?.id === controlFrame.heartbeatId
    ) {
      this.acknowledgeHeartbeat();
      return;
    }
    this.handleSocketMessage(event.data);
  };

  private acknowledgeHeartbeat = (): void => {
    if (!this.pendingHeartbeat) {
      return;
    }
    const acknowledgedAt = this.deps.now();
    this.params.onHeartbeatAcknowledged({
      sentAt: this.pendingHeartbeat.sentAt,
      acknowledgedAt: acknowledgedAt.toISOString(),
      latencyMs: Math.max(
        0,
        acknowledgedAt.getTime() - this.pendingHeartbeat.sentAtMs,
      ),
    });
    this.pendingHeartbeat = null;
  };

  private onClose = (event: Event): void => {
    this.appAdapter.stop();
    const closeError = createRemoteConnectorCloseError({
      event: event as RemoteConnectorCloseEvent,
      connectionId: this.params.connectionId,
      connectedAt: this.connectedAt,
      now: this.deps.now(),
    });
    if (!this.aborted && closeError) {
      this.finishReject(closeError);
      return;
    }
    this.finishResolve(this.aborted ? "aborted" : "closed");
  };

  private onError = (event: Event): void => {
    this.appAdapter.stop();
    if (this.aborted) {
      this.finishResolve("aborted");
      return;
    }
    const message = readRemoteConnectorSocketErrorMessage(event);
    this.finishReject(
      this.connectedAt
        ? createRemoteConnectorTransportError({
            message,
            source: "socket_error",
            connectionId: this.params.connectionId,
            connectedAt: this.connectedAt,
            now: this.deps.now(),
          })
        : new Error(message),
    );
  };

  private handleSocketMessage = (data: unknown): void => {
    void (async () => {
      const frame = this.parseRelayFrame(data);
      if (!frame) {
        return;
      }
      try {
        if (frame.type === "request") {
          await this.params.relayBridge.forward(frame, this.socket);
          return;
        }
        await this.appAdapter.handle(frame);
      } catch (error) {
        this.sendFrameError(frame, error);
      }
    })();
  };

  private sendFrameError = (
    frame: RelayRequestFrame | ConnectorClientCommand,
    error: unknown,
  ): void => {
    const message = error instanceof Error ? error.message : String(error);
    if (frame.type === "request") {
      this.socket.send(JSON.stringify({
        type: "response.error",
        requestId: frame.requestId,
        message,
      }));
      return;
    }
    if (frame.type === "client.request") {
      this.socket.send(JSON.stringify({
        type: "client.request.error",
        clientId: frame.clientId,
        id: frame.id,
        message,
      }));
      return;
    }
    this.socket.send(JSON.stringify({
      type: "client.stream.error",
      clientId: frame.clientId,
      streamId: frame.streamId,
      message,
    }));
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
}

export class RemoteConnectorSocketService {
  constructor(private readonly deps: RemoteConnectorSocketDeps) {}

  connect = async (
    params: RemoteConnectorSocketConnectParams,
  ): Promise<"closed" | "aborted"> => {
    return await new Promise<"closed" | "aborted">((resolve, reject) => {
      new RemoteConnectorSocketSession(
        this.deps,
        params,
        resolve,
        reject,
      ).start();
    });
  };
}
