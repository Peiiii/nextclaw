import { touchRemoteInstance } from "../repositories/remote.repository";
import { dispatchRemoteRelayClientFrame } from "./remote-relay-client-frame.utils";
import { decodeRelayBase64, decodeRelayMessageData } from "./remote-relay-message.utils";
import {
  consumeRemoteBrowserFrameQuota,
  readRemoteBrowserAttachment,
  releaseRemoteClientQuota,
} from "./remote-relay-quota.utils";
import {
  type PendingRelay,
  type BrowserCommandFrame,
  type ClientAttachment,
  type ConnectorAttachment,
  type ConnectorClientFrame,
  type HeaderEntry,
  type RelayRequestFrame,
  type RelayResponseFrame,
  type WebSocketMessageData
} from "./remote-relay.types";
import type { Env } from "../types/platform";

const CONNECTOR_TAG = "connector"; const CLIENT_TAG = "client";

export class NextclawRemoteRelayDurableObject {
  private readonly pending = new Map<string, PendingRelay>();
  private readonly browserMessageLeases = new Map<string, number>();

  constructor(private readonly state: DurableObjectState, private readonly env: Env) {}

  fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const role = request.headers.get("x-nextclaw-remote-role")?.trim();
      if (role === "browser") {
        return this.handleBrowserUpgrade(request);
      }
      return this.handleConnectorUpgrade(request);
    }
    if (url.pathname === "/proxy" && request.method === "POST") {
      return this.handleProxyRequest(request);
    }
    return new Response("not_found", { status: 404 });
  }

  private handleConnectorUpgrade = async (request: Request): Promise<Response> => {
    const deviceId = request.headers.get("x-nextclaw-remote-device-id")?.trim();
    if (!deviceId) {
      return new Response("Remote device id missing.", { status: 400 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const connectedAt = new Date().toISOString();
    server.serializeAttachment({
      type: "connector",
      deviceId,
      connectedAt
    } satisfies ConnectorAttachment);
    this.state.acceptWebSocket(server, [CONNECTOR_TAG]);
    for (const existingConnector of this.getConnectorSockets()) {
      if (existingConnector === server) {
        continue;
      }
      existingConnector.close(1012, "Replaced by a newer connector session.");
    }
    await this.setDeviceStatus(deviceId, "online", connectedAt);
    return new Response(null, { status: 101, webSocket: client });
  }

  private handleBrowserUpgrade = async (request: Request): Promise<Response> => {
    if (!this.getActiveConnector()) {
      return new Response("Remote device connector is offline.", { status: 503 });
    }
    const attachment = readRemoteBrowserAttachment(request);
    if (!attachment) {
      return new Response("Remote browser quota metadata missing.", { status: 400 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.serializeAttachment(attachment satisfies ClientAttachment);
    this.state.acceptWebSocket(server, [CLIENT_TAG]);
    this.browserMessageLeases.set(attachment.clientId, 0);
    server.send(JSON.stringify({
      type: "connection.ready",
      connectionId: attachment.clientId,
      protocolVersion: 1
    }));
    return new Response(null, { status: 101, webSocket: client });
  }

  private handleProxyRequest = async (request: Request): Promise<Response> => {
    const connector = this.getActiveConnector();
    if (!connector) {
      return new Response("Remote device connector is offline.", { status: 503 });
    }
    const payload = await request.json<{
      method: string;
      path: string;
      headers: HeaderEntry[];
      bodyBase64?: string;
    }>();
    const requestId = crypto.randomUUID();
    const pending = this.createPendingRelay(requestId);
    this.pending.set(requestId, pending);
    const frame: RelayRequestFrame = {
      type: "request",
      requestId,
      method: payload.method,
      path: payload.path,
      headers: Array.isArray(payload.headers) ? payload.headers : [],
      bodyBase64: payload.bodyBase64
    };
    try {
      connector.send(JSON.stringify(frame));
    } catch (error) {
      clearTimeout(pending.timeoutId);
      this.pending.delete(requestId);
      return new Response(
        error instanceof Error ? error.message : "Failed to forward remote request.",
        { status: 503 }
      );
    }
    return await pending.responsePromise;
  }

  private createPendingRelay = (requestId: string): PendingRelay => {
    let resolveResponse!: (response: Response) => void;
    let rejectResponse!: (error: Error) => void;
    const responsePromise = new Promise<Response>((resolve, reject) => {
      resolveResponse = resolve;
      rejectResponse = reject;
    });
    const timeoutId = setTimeout(() => {
      const entry = this.pending.get(requestId);
      if (!entry) {
        return;
      }
      entry.rejectResponse(new Error("Remote relay timed out."));
      this.pending.delete(requestId);
    }, 30_000);
    return {
      responsePromise,
      resolveResponse,
      rejectResponse,
      writer: null,
      timeoutId
    };
  }

  webSocketMessage = (webSocket: WebSocket, message: WebSocketMessageData): void => {
    const attachment = webSocket.deserializeAttachment() as ConnectorAttachment | ClientAttachment | null;
    const raw = decodeRelayMessageData(message);
    if (attachment?.type === "client") {
      this.state.waitUntil(this.handleBrowserMessage(attachment, raw));
      return;
    }
    this.state.waitUntil(this.handleConnectorMessage(raw));
  }

  webSocketClose = (webSocket: WebSocket): void => {
    this.state.waitUntil(this.handleSocketClosed(webSocket));
  }

  webSocketError = (webSocket: WebSocket): void => {
    this.state.waitUntil(this.handleSocketClosed(webSocket));
  }

  private handleConnectorMessage = async (raw: string): Promise<void> => {
    let frame: RelayResponseFrame | ConnectorClientFrame | null = null;
    try {
      frame = JSON.parse(raw) as RelayResponseFrame | ConnectorClientFrame;
    } catch {
      return;
    }
    if (!frame) {
      return;
    }

    if ("clientId" in frame || frame.type === "client.event") {
      this.handleConnectorClientFrame(frame as ConnectorClientFrame);
      return;
    }

    const pending = this.pending.get(frame.requestId);
    if (!pending) {
      return;
    }
    switch (frame.type) {
      case "response":
        this.finishBufferedRelayResponse(frame, pending);
        return;
      case "response.start":
        this.startStreamingRelayResponse(frame, pending);
        return;
      case "response.chunk":
        await this.writeStreamingRelayChunk(frame, pending);
        return;
      case "response.end":
        await this.finishStreamingRelayResponse(frame.requestId, pending);
        return;
      case "response.error":
        await this.failPendingRelayResponse(frame.requestId, pending, frame.message);
        return;
      default:
        return;
    }
  }

  private handleBrowserMessage = async (attachment: ClientAttachment, raw: string): Promise<void> => {
    let frame: BrowserCommandFrame | null = null;
    try {
      frame = JSON.parse(raw) as BrowserCommandFrame;
    } catch {
      return;
    }
    if (!frame) {
      return;
    }

    const connector = this.getActiveConnector();
    if (!connector) {
      if (frame.type === "request") {
        this.sendToClient(attachment.clientId, {
          type: "request.error",
          id: frame.id,
          message: "Remote device connector is offline."
        });
        return;
      }
      this.sendToClient(attachment.clientId, {
        type: "stream.error",
        streamId: frame.streamId,
        message: "Remote device connector is offline."
      });
      return;
    }

    if (frame.type === "request") {
      const quotaDecision = await consumeRemoteBrowserFrameQuota({
        env: this.env,
        attachment,
        frame,
        remainingMessages: this.browserMessageLeases.get(attachment.clientId) ?? 0
      });
      this.browserMessageLeases.set(attachment.clientId, quotaDecision.remainingMessages);
      if (!quotaDecision.ok) {
        this.sendToClient(attachment.clientId, quotaDecision.frame);
        return;
      }
      connector.send(JSON.stringify({
        type: "client.request",
        clientId: attachment.clientId,
        id: frame.id,
        target: frame.target
      }));
      return;
    }

    if (frame.type === "stream.open") {
      const quotaDecision = await consumeRemoteBrowserFrameQuota({
        env: this.env,
        attachment,
        frame,
        remainingMessages: this.browserMessageLeases.get(attachment.clientId) ?? 0
      });
      this.browserMessageLeases.set(attachment.clientId, quotaDecision.remainingMessages);
      if (!quotaDecision.ok) {
        this.sendToClient(attachment.clientId, quotaDecision.frame);
        return;
      }
      connector.send(JSON.stringify({
        type: "client.stream.open",
        clientId: attachment.clientId,
        streamId: frame.streamId,
        target: frame.target
      }));
      return;
    }

    connector.send(JSON.stringify({
      type: "client.stream.cancel",
      clientId: attachment.clientId,
      streamId: frame.streamId
    }));
  }

  private getConnectorSockets = (): WebSocket[] => {
    return this.state.getWebSockets(CONNECTOR_TAG).filter((socket) => {
      const attachment = socket.deserializeAttachment() as ConnectorAttachment | null;
      return attachment?.type === "connector";
    });
  }

  private getClientSockets = (): WebSocket[] => {
    return this.state.getWebSockets(CLIENT_TAG).filter((socket) => {
      const attachment = socket.deserializeAttachment() as ClientAttachment | null;
      return attachment?.type === "client";
    });
  }

  private getActiveConnector = (): WebSocket | null => {
    for (const socket of this.getConnectorSockets()) {
      if (socket.readyState === WebSocket.OPEN) {
        return socket;
      }
    }
    return null;
  }

  private handleSocketClosed = async (closedSocket: WebSocket): Promise<void> => {
    const attachment = closedSocket.deserializeAttachment() as ConnectorAttachment | ClientAttachment | null;
    if (attachment?.type === "client") {
      this.browserMessageLeases.delete(attachment.clientId);
      await releaseRemoteClientQuota(this.env, attachment);
      return;
    }
    await this.handleConnectorClosed(closedSocket);
  }

  private handleConnectorClosed = async (closedSocket: WebSocket): Promise<void> => {
    const attachment = closedSocket.deserializeAttachment() as ConnectorAttachment | null;
    if (attachment?.type !== "connector") {
      return;
    }
    const hasOtherOpenConnector = this.getConnectorSockets().some((socket) => {
      return socket !== closedSocket && socket.readyState === WebSocket.OPEN;
    });
    if (hasOtherOpenConnector) {
      return;
    }
    for (const socket of this.getClientSockets()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "connection.error",
          message: "Remote device connector disconnected."
        }));
        socket.close(1012, "Remote device connector disconnected.");
      }
    }
    await this.setDeviceStatus(attachment.deviceId, "offline", new Date().toISOString());
  }

  private handleConnectorClientFrame = (frame: ConnectorClientFrame): void => {
    dispatchRemoteRelayClientFrame({
      frame,
      sendToClient: this.sendToClient.bind(this),
      broadcastToClients: this.broadcastToClients.bind(this)
    });
  }

  private sendToClient = (clientId: string, frame: Record<string, unknown>): void => {
    for (const socket of this.getClientSockets()) {
      const attachment = socket.deserializeAttachment() as ClientAttachment | null;
      if (attachment?.type !== "client" || attachment.clientId !== clientId || socket.readyState !== WebSocket.OPEN) {
        continue;
      }
      socket.send(JSON.stringify(frame));
      return;
    }
  }

  private broadcastToClients = (frame: Record<string, unknown>): void => {
    for (const socket of this.getClientSockets()) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(frame));
      }
    }
  }

  private finishBufferedRelayResponse = (
    frame: Extract<RelayResponseFrame, { type: "response" }>,
    pending: PendingRelay,
  ): void => {
    clearTimeout(pending.timeoutId);
    this.pending.delete(frame.requestId);
    pending.resolveResponse(new Response(decodeRelayBase64(frame.bodyBase64), {
      status: frame.status,
      headers: new Headers(frame.headers),
    }));
  }

  private startStreamingRelayResponse = (
    frame: Extract<RelayResponseFrame, { type: "response.start" }>,
    pending: PendingRelay,
  ): void => {
    clearTimeout(pending.timeoutId);
    const stream = new TransformStream<Uint8Array, Uint8Array>();
    pending.writer = stream.writable.getWriter();
    pending.resolveResponse(new Response(stream.readable, {
      status: frame.status,
      headers: new Headers(frame.headers),
    }));
  }

  private writeStreamingRelayChunk = async (
    frame: Extract<RelayResponseFrame, { type: "response.chunk" }>,
    pending: PendingRelay,
  ): Promise<void> => {
    if (pending.writer) {
      await pending.writer.write(decodeRelayBase64(frame.bodyBase64));
    }
  }

  private finishStreamingRelayResponse = async (requestId: string, pending: PendingRelay): Promise<void> => {
    clearTimeout(pending.timeoutId);
    this.pending.delete(requestId);
    if (pending.writer) {
      await pending.writer.close();
    }
  }

  private failPendingRelayResponse = async (
    requestId: string,
    pending: PendingRelay,
    message: string,
  ): Promise<void> => {
    clearTimeout(pending.timeoutId);
    this.pending.delete(requestId);
    if (pending.writer) {
      await pending.writer.abort(new Error(message));
      return;
    }
    pending.rejectResponse(new Error(message));
  }

  private setDeviceStatus = async (
    deviceId: string,
    status: "online" | "offline",
    at: string
  ): Promise<void> => {
    await touchRemoteInstance(this.env.NEXTCLAW_PLATFORM_DB, deviceId, {
      status,
      lastSeenAt: at
    });
  }
}
