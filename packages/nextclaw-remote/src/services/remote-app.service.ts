import type { UiServerEvent } from "@nextclaw/server";
import WebSocket, { type RawData } from "ws";
import { readRemoteAppStreamResult } from "../remote-app-stream.js";
import { RemoteRelayBridge } from "./remote-relay-bridge.service.js";

type RemoteTarget = {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export type ConnectorClientCommand =
  | { type: "client.request"; clientId: string; id: string; target: RemoteTarget }
  | { type: "client.stream.open"; clientId: string; streamId: string; target: RemoteTarget }
  | { type: "client.stream.cancel"; clientId: string; streamId: string };

function toWebSocketUrl(origin: string, path: string): string {
  const normalizedOrigin = origin.replace(/\/$/, "");
  if (normalizedOrigin.startsWith("https://")) {
    return `${normalizedOrigin.replace(/^https:/, "wss:")}${path}`;
  }
  if (normalizedOrigin.startsWith("http://")) {
    return `${normalizedOrigin.replace(/^http:/, "ws:")}${path}`;
  }
  return `${normalizedOrigin}${path}`;
}

function readErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body && "error" in body) {
    const typed = body as { error?: { message?: string } };
    if (typed.error?.message) {
      return typed.error.message;
    }
  }
  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }
  return fallback;
}

export class RemoteAppAdapter {
  private readonly relayBridge: RemoteRelayBridge;
  private readonly activeStreams = new Map<string, AbortController>();
  private localEventSocket: WebSocket | null = null;
  private eventReconnectTimer: NodeJS.Timeout | null = null;
  private shuttingDown = false;

  constructor(
    private readonly localOrigin: string,
    private readonly platformSocket: {
      readonly readyState: number;
      send(data: string): void;
    }
  ) {
    this.relayBridge = new RemoteRelayBridge(localOrigin);
  }

  start = async (): Promise<void> => {
    await this.ensureEventSocket();
  };

  stop = (): void => {
    this.shuttingDown = true;
    if (this.eventReconnectTimer) {
      clearTimeout(this.eventReconnectTimer);
      this.eventReconnectTimer = null;
    }
    this.localEventSocket?.close();
    this.localEventSocket = null;
    for (const controller of this.activeStreams.values()) {
      controller.abort();
    }
    this.activeStreams.clear();
  };

  handle = async (frame: ConnectorClientCommand): Promise<void> => {
    if (frame.type === "client.request") {
      await this.handleRequest(frame);
      return;
    }
    if (frame.type === "client.stream.open") {
      void this.handleStream(frame);
      return;
    }
    if (frame.type === "client.stream.cancel") {
      this.activeStreams.get(frame.streamId)?.abort();
      this.activeStreams.delete(frame.streamId);
    }
  };

  private handleRequest = async (
    frame: Extract<ConnectorClientCommand, { type: "client.request" }>
  ): Promise<void> => {
    const bridgeCookie = await this.relayBridge.requestBridgeCookie();
    const response = await fetch(new URL(frame.target.path, this.localOrigin), {
      method: frame.target.method,
      headers: this.createRequestHeaders(frame.target, bridgeCookie),
      body: this.buildRequestBody(frame.target)
    });
    const body = await this.readResponseBody(response);
    this.send({
      type: "client.response",
      clientId: frame.clientId,
      id: frame.id,
      status: response.status,
      body
    });
  };

  private handleStream = async (
    frame: Extract<ConnectorClientCommand, { type: "client.stream.open" }>
  ): Promise<void> => {
    const controller = new AbortController();
    this.activeStreams.set(frame.streamId, controller);

    try {
      const response = await this.openStreamResponse(frame, controller);
      if (!response) {
        return;
      }
      await readRemoteAppStreamResult({
        response,
        onEvent: (event) => {
          this.send({
            type: "client.stream.event",
            clientId: frame.clientId,
            streamId: frame.streamId,
            event: event.event,
            payload: event.payload
          });
        }
      });
      this.send({
        type: "client.stream.end",
        clientId: frame.clientId,
        streamId: frame.streamId
      });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      this.send({
        type: "client.stream.error",
        clientId: frame.clientId,
        streamId: frame.streamId,
        message: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.activeStreams.delete(frame.streamId);
    }
  };

  private openStreamResponse = async (
    frame: Extract<ConnectorClientCommand, { type: "client.stream.open" }>,
    controller: AbortController
  ): Promise<Response | null> => {
    const bridgeCookie = await this.relayBridge.requestBridgeCookie();
    const headers = this.createRequestHeaders(frame.target, bridgeCookie);
    headers.set("Accept", "text/event-stream");
    const response = await fetch(new URL(frame.target.path, this.localOrigin), {
      method: frame.target.method,
      headers,
      body: this.buildRequestBody(frame.target),
      signal: controller.signal
    });
    if (response.ok) {
      return response;
    }
    const errorBody = await this.readResponseBody(response);
    this.send({
      type: "client.stream.error",
      clientId: frame.clientId,
      streamId: frame.streamId,
      message: readErrorMessage(errorBody, `HTTP ${response.status}`)
    });
    return null;
  };

  private ensureEventSocket = async (): Promise<void> => {
    if (this.localEventSocket && this.localEventSocket.readyState === WebSocket.OPEN) {
      return;
    }
    const bridgeCookie = await this.relayBridge.requestBridgeCookie();
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(toWebSocketUrl(this.localOrigin, "/ws"), {
        headers: bridgeCookie ? { Cookie: bridgeCookie } : undefined
      });
      this.localEventSocket = socket;

      socket.on("open", () => resolve());
      socket.on("message", (data: RawData) => {
        try {
          const event = JSON.parse(String(data ?? "")) as UiServerEvent;
          this.send({
            type: "client.event",
            event
          });
        } catch (error) {
          console.error("Failed to parse local ui event:", error);
        }
      });
      socket.on("close", () => {
        this.localEventSocket = null;
        if (!this.shuttingDown) {
          this.scheduleEventReconnect();
        }
      });
      socket.on("error", (error: Error) => {
        if (!this.shuttingDown) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
  };

  private scheduleEventReconnect = (): void => {
    if (this.eventReconnectTimer) {
      return;
    }
    this.eventReconnectTimer = setTimeout(() => {
      this.eventReconnectTimer = null;
      void this.ensureEventSocket().catch(() => undefined);
    }, 3_000);
  };

  private buildRequestBody = (target: RemoteTarget): Uint8Array | undefined => {
    if (target.method === "GET" || target.method === "HEAD") {
      return undefined;
    }
    if (target.body === undefined) {
      return undefined;
    }
    return new TextEncoder().encode(JSON.stringify(target.body));
  };

  private createRequestHeaders = (target: RemoteTarget, bridgeCookie: string | null): Headers => {
    const headers = this.relayBridge.createForwardHeaders(Object.entries(target.headers ?? {}), bridgeCookie);
    headers.set("Content-Type", "application/json");
    return headers;
  };

  private readResponseBody = async (response: Response): Promise<unknown> => {
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (contentType.includes("application/json")) {
      return await response.json();
    }
    const text = await response.text();
    return text;
  };

  private send = (frame: Record<string, unknown>): void => {
    if (this.platformSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.platformSocket.send(JSON.stringify(frame));
  };
}
