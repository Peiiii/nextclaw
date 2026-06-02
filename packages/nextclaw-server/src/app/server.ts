import { Hono } from "hono";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { AccessManager } from "@nextclaw/kernel";
import { WebSocketServer } from "ws";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Server } from "node:http";
import { UiAuthService } from "@nextclaw-server/features/auth/index.js";
import {
  EventStreamAuthService,
  EventStreamClientRegistry,
} from "@nextclaw-server/features/event-stream/index.js";
import { createUiRouter } from "./router.js";
import type { UiRouterOptions } from "@nextclaw-server/app/types/router-options.types.js";
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
const STALE_UI_ASSET_RELOAD_MODULE = "globalThis.location?.reload();\nexport {};\n";
type CorsPolicy = string[] | "*" | typeof DEFAULT_CORS_ORIGINS;

function buildVaryHeader(current: string | null, value: string): string {
  if (!current) {
    return value;
  }
  const values = current
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!values.includes(value)) {
    return [...values, value].join(", ");
  }
  return values.join(", ");
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

function createCorsHeaders(allowOrigin: string, allowHeaders?: string | null, currentVary?: string | null): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", allowOrigin);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Methods", DEFAULT_ALLOWED_CORS_METHODS);
  headers.set(
    "Access-Control-Allow-Headers",
    allowHeaders?.trim() || DEFAULT_ALLOWED_CORS_HEADERS
  );
  const varyWithOrigin = buildVaryHeader(currentVary ?? null, "Origin");
  headers.set("Vary", buildVaryHeader(varyWithOrigin, "Access-Control-Request-Headers"));
  return headers;
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
      },
      onFound: (_, c) => {
        c.header("cache-control", "no-store");
      }
    })
  );
  app.get("/assets/*", (c) => {
    if (!c.req.path.endsWith(".js")) {
      return c.notFound();
    }
    return c.body(STALE_UI_ASSET_RELOAD_MODULE, 200, {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store"
    });
  });
  app.get("*", (c) => {
    const path = c.req.path;
    if (path.startsWith("/api") || path.startsWith("/ws") || path.startsWith("/_remote") || path.startsWith("/webhook")) {
      return c.notFound();
    }
    return c.html(indexHtml, 200, { "cache-control": "no-store" });
  });
}

function attachUiSocketServer(
  httpServer: Server,
  eventStreamAuth: EventStreamAuthService,
  eventStreamClients: EventStreamClientRegistry,
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on("upgrade", (request, socket, head) => {
    const host = request.headers.host ?? "127.0.0.1";
    const url = request.url ?? "/";
    const pathname = new URL(url, `http://${host}`).pathname;
    if (pathname !== "/ws") {
      return;
    }
    const principal = eventStreamAuth.authenticate(request);
    if (!principal) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      eventStreamClients.add(ws, principal);
      wss.emit("connection", ws, request);
    });
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
  const authService = new UiAuthService(
    gateway.kernel.accessManager ?? new AccessManager({ configPath: gateway.configPath }),
  );
  app.use("/api/*", async (c, next) => {
    const allowOrigin = resolveAllowedCorsOrigin(c.req.header("origin")?.trim() ?? null, corsPolicy);
    const allowHeaders = c.req.header("access-control-request-headers")?.trim() ?? null;

    if (c.req.method === "OPTIONS") {
      if (allowOrigin) {
        const headers = createCorsHeaders(allowOrigin, allowHeaders);
        return new Response(null, { status: 204, headers });
      }
      return new Response(null, { status: 204 });
    }

    await next();

    if (allowOrigin) {
      for (const [name, value] of createCorsHeaders(allowOrigin, allowHeaders, c.res.headers.get("Vary"))) {
        c.res.headers.set(name, value);
      }
    }
  });

  const eventStreamAuth = new EventStreamAuthService({
    uiAuth: authService,
    extensionAuth: gateway.extensions,
    getChannelBindings: gateway.extensions?.getChannelBindings,
  });
  const eventStreamClients = new EventStreamClientRegistry();
  const unsubscribeEventBus = gateway.appEventBus.subscribeAll(eventStreamClients.publish);

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
  const wss = attachUiSocketServer(httpServer, eventStreamAuth, eventStreamClients);

  return {
    host,
    port,
    close: () =>
      new Promise((resolve) => {
        unsubscribeEventBus();
        eventStreamClients.closeAll();
        wss.close(() => {
          server.close(() => resolve());
        });
      })
  };
}
