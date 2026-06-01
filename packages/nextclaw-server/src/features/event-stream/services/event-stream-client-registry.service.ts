import type { AppEventEnvelope } from "@nextclaw/shared";
import { WebSocket } from "ws";
import type { EventStreamPrincipal } from "@nextclaw-server/features/event-stream/types/event-stream-principal.types.js";
import { canStreamAppEventToPrincipal } from "@nextclaw-server/features/event-stream/utils/event-stream-authorizer.utils.js";

type EventStreamClient = {
  socket: WebSocket;
  principal: EventStreamPrincipal;
};

export class EventStreamClientRegistry {
  private readonly clients = new Set<EventStreamClient>();

  add = (socket: WebSocket, principal: EventStreamPrincipal): void => {
    const client = { socket, principal };
    this.clients.add(client);
    socket.on("close", () => this.clients.delete(client));
  };

  publish = (event: AppEventEnvelope): void => {
    const payload = JSON.stringify(event);
    for (const client of this.clients) {
      if (
        client.socket.readyState === WebSocket.OPEN &&
        canStreamAppEventToPrincipal(client.principal, event)
      ) {
        client.socket.send(payload);
      }
    }
  };

  closeAll = (): void => {
    for (const client of this.clients) {
      client.socket.close();
    }
    this.clients.clear();
  };
}
