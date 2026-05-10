import { Hono } from "hono";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import type { AppEventEnvelope } from "@nextclaw/kernel";
import { WebSocketServer, WebSocket } from "ws";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Server } from "node:http";
import { UiAuthService } from "./auth.service.js";
import { createUiRouter } from "./router.js";
import type { UiRouterOptions } from "./ui-routes/types.js";
import { serveStatic } from "hono/serve-static";

export type UiServerHandle = {
  host: string;
  port: number;
  close: () => Promise<void>;
};

const DEFAULT_CORS_ORIGINS = (origin: string | undefined | null) => {
  if (!origin) {
    return undefined;
  }
  if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
    return origin;
  }
  return undefined;
};

const DEFAULT_ALLOWED_CORS_HEADERS = "Content-Type, Authorization";
const DEFAULT_ALLOWED_CORS_METHODS = "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS";
type CorsPolicy = string[] | "*" | typeof DEFAULT_CORS_ORIGINS;

function readRequestHeader(request: Request, name: string): string | null {
  return request.headers.get(name)?.trim() ?? null;
}

function appendVaryHeader(headers: Headers, value: string): void {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", value);
    return;
  }
  const values = current
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!values.includes(value)) {
    values.push(value);
  }
  headers.set("Vary", values.join(", "));
}

function resolveAllowedCorsOrigin(
  requestOrigin: string | null,
  policy: CorsPolicy
): string | null {
  if (!requestOrigin) {
    return null;
  }
  if (policy === "*") {
    return requestOrigin;
  }
  if (Array.isArray(policy)) {
    return policy.includes(requestOrigin) ? requestOrigin : null;
  }
  return policy(requestOrigin) ?? null;
}

function applyCorsHeaders(params: {
  headers: Headers;
  allowOrigin: string;
  allowHeaders?: string | null;
}): void {
  const { headers, allowOrigin, allowHeaders } = params;
  headers.set("Access-Control-Allow-Origin", allowOrigin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", DEFAULT_ALLOWED_CORS_METHODS);
  headers.set(
    "Access-Control-Allow-Headers",
    allowHeaders?.trim() || DEFAULT_ALLOWED_CORS_HEADERS
  );
  appendVaryHeader(headers, "Origin");
  appendVaryHeader(headers, "Access-Control-Request-Headers");
}

function createUiEventPublisher(clients: Set<WebSocket>): (event: AppEventEnvelope) => void {
  return (event) => {
    const payload = JSON.stringify(event);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  };
}

function mountUiStaticAssets(app: Hono, staticDir: string): void {
  if (!existsSync(join(staticDir, "index.html"))) {
    return;
  }

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
    if (path.startsWith("/api") || path.startsWith("/ws") || path.startsWith("/_remote") || path.startsWith("/webhook")) {
      return c.notFound();
    }
    return c.html(indexHtml);
  });
}

function attachUiSocketServer(httpServer: Server, authService: UiAuthService, clients: Set<WebSocket>): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on("upgrade", (request, socket, head) => {
    const host = request.headers.host ?? "127.0.0.1";
    const url = request.url ?? "/";
    const pathname = new URL(url, `http://${host}`).pathname;
    if (pathname !== "/ws") {
      return;
    }
    if (!authService.isSocketAuthenticated(request)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });
  wss.on("connection", (socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
  });
  return wss;
}

export async function startUiServer(gateway: UiRouterOptions): Promise<UiServerHandle> {
  const {
    corsOrigins,
    uiStaticDir,
  } = gateway;
  const uiConfig = gateway.uiConfig;
  if (!uiConfig) {
    throw new Error("uiConfig is required to start UI server");
  }
  const { host, port } = uiConfig;
  const app = new Hono();
  app.use("/*", compress());
  const corsPolicy = corsOrigins ?? DEFAULT_CORS_ORIGINS;
  const authService = new UiAuthService(gateway.configPath);
  app.use("/api/*", async (c, next) => {
    const allowOrigin = resolveAllowedCorsOrigin(readRequestHeader(c.req.raw, "origin"), corsPolicy);
    const allowHeaders = readRequestHeader(c.req.raw, "access-control-request-headers");

    if (c.req.method === "OPTIONS") {
      if (allowOrigin) {
        const headers = new Headers();
        applyCorsHeaders({
          headers,
          allowOrigin,
          allowHeaders
        });
        return new Response(null, { status: 204, headers });
      }
      return new Response(null, { status: 204 });
    }

    await next();

    if (allowOrigin) {
      applyCorsHeaders({
        headers: c.res.headers,
        allowOrigin,
        allowHeaders
      });
    }
  });

  const clients = new Set<WebSocket>();
  const publishToClients = createUiEventPublisher(clients);
  const unsubscribeEventBus = gateway.appEventBus.subscribeAll(publishToClients);

  app.route(
    "/",
    createUiRouter(gateway, authService)
  );

  if (uiStaticDir) {
    mountUiStaticAssets(app, uiStaticDir);
  }

  const server = await new Promise<Server>((resolve, reject) => {
    const httpServer = serve(
      {
        fetch: app.fetch,
        port,
        hostname: host
      },
      () => resolve(httpServer as unknown as Server)
    ) as unknown as Server;
    httpServer.once("error", reject);
  });

  const httpServer = server as unknown as Server;
  const wss = attachUiSocketServer(httpServer, authService, clients);

  return {
    host,
    port,
    close: () =>
      new Promise((resolve) => {
        unsubscribeEventBus();
        wss.close(() => {
          server.close(() => {
            Promise.resolve(gateway.ncpAgent?.agentClientEndpoint.stop())
              .catch(() => undefined)
              .finally(() => resolve());
          });
        });
      })
  };
}
