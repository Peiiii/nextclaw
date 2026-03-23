import { Hono } from "hono";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { WebSocketServer, WebSocket } from "ws";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Server } from "node:http";
import { UiAuthService } from "./auth.service.js";
import { createUiRouter } from "./router.js";
import type { UiServerEvent, UiServerHandle, UiServerOptions } from "./types.js";
import { serveStatic } from "hono/serve-static";

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
type CorsPolicy = Exclude<UiServerOptions["corsOrigins"], undefined> | typeof DEFAULT_CORS_ORIGINS;

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
  params.headers.set("Access-Control-Allow-Origin", params.allowOrigin);
  params.headers.set("Access-Control-Allow-Credentials", "true");
  params.headers.set("Access-Control-Allow-Methods", DEFAULT_ALLOWED_CORS_METHODS);
  params.headers.set(
    "Access-Control-Allow-Headers",
    params.allowHeaders?.trim() || DEFAULT_ALLOWED_CORS_HEADERS
  );
  appendVaryHeader(params.headers, "Origin");
  appendVaryHeader(params.headers, "Access-Control-Request-Headers");
}

export function startUiServer(options: UiServerOptions): UiServerHandle {
  const app = new Hono();
  app.use("/*", compress());
  const corsPolicy = options.corsOrigins ?? DEFAULT_CORS_ORIGINS;
  const authService = new UiAuthService(options.configPath);
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
      productVersion: options.productVersion,
      publish,
      marketplace: options.marketplace,
      cronService: options.cronService,
      chatRuntime: options.chatRuntime,
      ncpAgent: options.ncpAgent,
      authService,
      remoteAccess: options.remoteAccess,
      getPluginChannelBindings: options.getPluginChannelBindings,
      getPluginUiMetadata: options.getPluginUiMetadata
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
      if (path.startsWith("/api") || path.startsWith("/ws") || path.startsWith("/_remote")) {
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

  const httpServer = server as unknown as Server;
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

  return {
    host: options.host,
    port: options.port,
    publish,
    close: () =>
      new Promise((resolve) => {
        wss.close(() => {
          server.close(() => {
            Promise.resolve(options.ncpAgent?.agentClientEndpoint.stop())
              .catch(() => undefined)
              .finally(() => resolve());
          });
        });
      })
  };
}
