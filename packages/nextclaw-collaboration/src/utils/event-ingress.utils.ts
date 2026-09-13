import { createServer, type Server } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { Connection } from "../types/collaboration.types.js";
import type { CollaborationStore } from "../stores/collaboration.store.js";
import { CollaborationService } from "../services/collaboration.service.js";

/** Authenticated producers are trusted to attest their configured source's platform account. */
export function createEventIngress(
  store: CollaborationStore,
  connectionId: string,
  token: string,
): Server {
  if (token.length < 32)
    throw new Error("Ingress token must contain at least 32 characters");
  const expected = Buffer.from(`Bearer ${token}`);
  return createServer(async (request, response) => {
    const supplied = Buffer.from(request.headers.authorization || "");
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      response.writeHead(401).end();
      return;
    }
    if (request.method !== "POST" || request.url !== "/events") {
      response.writeHead(404).end();
      return;
    }
    try {
      const connection = store.get<Connection>("connection", connectionId);
      if (!connection?.enabled) {
        response.writeHead(403).end();
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > 128_000) {
          response.writeHead(413).end();
          request.destroy();
          return;
        }
        chunks.push(bytes);
      }
      const event = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const service = new CollaborationService(store, new Map(), new Map());
      store.transaction(() => service.ingest(connection, event));
      response
        .writeHead(202, { "Content-Type": "application/json" })
        .end(JSON.stringify({ accepted: true, id: event.id }));
    } catch {
      response
        .writeHead(400)
        .end(JSON.stringify({ error: "Invalid event or unavailable journal" }));
    }
  });
}
