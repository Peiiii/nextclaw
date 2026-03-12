import { Hono } from "hono";
import { normalizeBasePath, sanitizeTimeout } from "./parsers.js";
import { handleAbort, handleReconnect, handleSend } from "./routes.js";
import type { NcpHttpAgentServerOptions } from "./types.js";

export function createNcpHttpAgentRouter(options: NcpHttpAgentServerOptions): Hono {
  const app = new Hono();
  mountNcpHttpAgentRoutes(app, options);
  return app;
}

export function mountNcpHttpAgentRoutes(app: Hono, options: NcpHttpAgentServerOptions): void {
  const basePath = normalizeBasePath(options.basePath);
  const routeOptions = {
    agentEndpoint: options.agentEndpoint,
    replayProvider: options.replayProvider,
    timeoutMs: sanitizeTimeout(options.requestTimeoutMs),
  };

  app.post(`${basePath}/send`, (c) => handleSend(c, routeOptions));
  app.get(`${basePath}/reconnect`, (c) => handleReconnect(c, routeOptions));
  app.post(`${basePath}/abort`, (c) => handleAbort(c, routeOptions));
}
