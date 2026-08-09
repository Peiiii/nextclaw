import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { WebSocketServer } from "ws";
import { NextClawExtension } from "../index.js";

async function listenOnLocalhost(server: Server): Promise<number> {
  return await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to resolve local server port."));
        return;
      }
      resolve(address.port);
    });
  });
}

async function closeWebSocketServer(server: Server, wss: WebSocketServer): Promise<void> {
  await new Promise<void>((resolve) => {
    wss.close(() => {
      server.close(() => resolve());
    });
  });
}

function createFetchImpl(): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify({ ok: true, data: { accepted: true } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

describe("ExtensionTransportService", () => {
  it("sends extension auth headers on default Node websocket connections", async () => {
    const server = createServer();
    const wss = new WebSocketServer({ server });
    const port = await listenOnLocalhost(server);
    const headersPromise = new Promise<IncomingHttpHeaders>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("extension websocket did not connect")), 1000);
      wss.once("connection", (_socket, request) => {
        clearTimeout(timeout);
        resolve(request.headers);
      });
    });
    const extension = new NextClawExtension({
      endpoint: `http://127.0.0.1:${port}`,
      extensionId: "fake-extension",
      generation: "generation-1",
      token: "secret",
      fetch: createFetchImpl(),
    });
    const unsubscribe = extension.onRequest(async () => ({ ok: true }));

    try {
      const headers = await headersPromise;
      await extension.ready();

      expect(headers.authorization).toBe("Bearer secret");
      expect(headers["x-nextclaw-extension-id"]).toBe("fake-extension");
      expect(headers["x-nextclaw-extension-generation"]).toBe("generation-1");
    } finally {
      unsubscribe();
      extension.close();
      await closeWebSocketServer(server, wss);
    }
  });
});
