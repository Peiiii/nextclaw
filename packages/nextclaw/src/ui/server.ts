import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Server } from "node:http";
import { createUiRouter } from "./router.js";
import type { UiServerEvent, UiServerHandle, UiServerOptions } from "./types.js";
import { serveStatic } from "hono/serve-static";

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

  const staticDir = options.staticDir;
  if (staticDir && existsSync(join(staticDir, "index.html"))) {
    const indexHtml = readFileSync(join(staticDir, "index.html"), "utf-8");
    app.use(
      "/*",
      serveStatic({
        root: staticDir,
        join,
        getContent: async (path) => {
          try {
            return await readFile(path);
          } catch {
            return null;
          }
        },
        isDir: async (path) => {
          try {
            return (await stat(path)).isDirectory();
          } catch {
            return false;
          }
        }
      })
    );
    app.get("*", (c) => {
      const path = c.req.path;
      if (path.startsWith("/api") || path.startsWith("/ws")) {
        return c.notFound();
      }
      return c.html(indexHtml);
    });
  }

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
