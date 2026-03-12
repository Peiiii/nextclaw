import { Hono } from "hono";
import { NcpHttpAgentController } from "./controller.js";
import { normalizeBasePath, sanitizeTimeout } from "./parsers.js";
import type { NcpHttpAgentServerOptions } from "./types.js";

export function createNcpHttpAgentRouter(options: NcpHttpAgentServerOptions): Hono {
  const app = new Hono();
  mountNcpHttpAgentRoutes(app, options);
  return app;
}

export function mountNcpHttpAgentRoutes(app: Hono, options: NcpHttpAgentServerOptions): void {
  const { basePath: rawBasePath, agentClientEndpoint, replayProvider, requestTimeoutMs } = options;
  const basePath = normalizeBasePath(rawBasePath);
  const controller = new NcpHttpAgentController({
    agentClientEndpoint,
    replayProvider,
    timeoutMs: sanitizeTimeout(requestTimeoutMs),
  });

  app.post(`${basePath}/send`, (c) => controller.handleSend(c.req.raw));
  app.get(`${basePath}/reconnect`, (c) => controller.handleReconnect(c.req.raw));
  app.post(`${basePath}/abort`, (c) => controller.handleAbort(c.req.raw));
}
