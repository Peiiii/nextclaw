import type { ConnectorClientFrame } from "./remote-relay.types";

export function dispatchRemoteRelayClientFrame(params: {
  frame: ConnectorClientFrame;
  sendToClient: (clientId: string, frame: Record<string, unknown>) => void;
  broadcastToClients: (frame: Record<string, unknown>) => void;
}): void {
  const { broadcastToClients, frame, sendToClient } = params;

  if (frame.type === "client.event") {
    broadcastToClients({
      type: "event",
      event: frame.event
    });
    return;
  }

  if (frame.type === "client.response") {
    sendToClient(frame.clientId, {
      type: "response",
      id: frame.id,
      status: frame.status,
      body: frame.body
    });
    return;
  }

  if (frame.type === "client.request.error") {
    sendToClient(frame.clientId, {
      type: "request.error",
      id: frame.id,
      message: frame.message,
      code: frame.code,
      retryAfterSeconds: frame.retryAfterSeconds
    });
    return;
  }

  if (frame.type === "client.stream.event") {
    sendToClient(frame.clientId, {
      type: "stream.event",
      streamId: frame.streamId,
      event: frame.event,
      payload: frame.payload
    });
    return;
  }

  if (frame.type === "client.stream.end") {
    sendToClient(frame.clientId, {
      type: "stream.end",
      streamId: frame.streamId
    });
    return;
  }

  if (frame.type === "client.stream.error") {
    sendToClient(frame.clientId, {
      type: "stream.error",
      streamId: frame.streamId,
      message: frame.message,
      code: frame.code,
      retryAfterSeconds: frame.retryAfterSeconds
    });
  }
}
