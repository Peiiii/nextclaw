import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { createUiRouter } from "./router.js";
import type { UiServerEvent, UiServerHandle, UiServerOptions } from "./types.js";

const DEFAULT_CORS_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function startUiServer(options: UiServerOptions): UiServerHandle {
  const app = new Hono();
  const origin = options.corsOrigins ?? DEFAULT_CORS_ORIGINS;
  app.use("/api/*", cors({ origin }));

  const clients = new Set<WebSocket>();

  const publish = (event: UiServerEvent) => {
    const payload = JSON.stringify(event);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };

  app.route(
    "/",
    createUiRouter({
      configPath: options.configPath,
      publish,
      onReload: options.onReload
    })
  );

  const server = serve({
    fetch: app.fetch,
    port: options.port,
    hostname: options.host
  });

  const wss = new WebSocketServer({
    server: server as unknown as Server,
    path: "/ws"
  });
  wss.on("connection", (socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
  });

  return {
    host: options.host,
    port: options.port,
    publish,
    close: () =>
      new Promise((resolve) => {
        wss.close(() => {
          server.close(() => resolve());
        });
      })
  };
}
