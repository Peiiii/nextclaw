import { Hono } from "hono";
import { cors } from "hono/cors";
import { remoteProxyHandler } from "@/controllers/remote.controller.js";
import {
  NextclawQuotaDurableObject,
  NextclawRemoteQuotaDurableObject,
} from "@/controllers/remote/remote-quota-durable-object.controller.js";
import { NextclawRemoteRelayDurableObject } from "@/controllers/remote/remote-relay-durable-object.controller.js";
import { registerAppRoutes } from "@/routes/app.routes.js";
import type { Env } from "@/types/platform.js";
import { openaiError } from "@/utils/platform.utils.js";

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

registerAppRoutes(app);

app.all("*", remoteProxyHandler);

app.notFound((c) => openaiError(c, 404, "endpoint not found", "not_found"));

app.onError((error, c) => openaiError(c, 500, error.message || "internal error", "internal_error"));

export { NextclawRemoteRelayDurableObject, NextclawRemoteQuotaDurableObject, NextclawQuotaDurableObject };
export default app;
