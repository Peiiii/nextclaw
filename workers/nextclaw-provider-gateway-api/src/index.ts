import { Hono } from "hono";
import { cors } from "hono/cors";
import { remoteProxyHandler } from "./controllers/remote-controller";
import { remoteStaticAssetMiddleware } from "./controllers/remote-static-assets-controller";
import { NextclawRemoteQuotaDurableObject } from "./remote-quota-do";
import { NextclawRemoteRelayDurableObject } from "./remote-relay-do";
import { registerAppRoutes } from "./register-app-routes";
import type { Env } from "./types/platform";
import { openaiError } from "./utils/platform-utils";

const app = new Hono<{ Bindings: Env }>();

app.use("/platform/*", cors({
  origin: "*",
  allowHeaders: ["Authorization", "Content-Type", "X-Idempotency-Key"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "OPTIONS"]
}));

app.use("/v1/*", cors({
  origin: "*",
  allowHeaders: ["Authorization", "Content-Type", "X-Idempotency-Key"],
  allowMethods: ["GET", "POST", "OPTIONS"]
}));

app.use("*", remoteStaticAssetMiddleware);

registerAppRoutes(app);

app.all("*", remoteProxyHandler);

app.notFound((c) => openaiError(c, 404, "endpoint not found", "not_found"));

app.onError((error, c) => openaiError(c, 500, error.message || "internal error", "internal_error"));

export { NextclawRemoteRelayDurableObject };
export { NextclawRemoteQuotaDurableObject };
export { NextclawQuotaDurableObject } from "./remote-quota-do";

export default app;
