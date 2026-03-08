import { Hono } from "hono";
import { cors } from "hono/cors";
import { registerRoutes } from "./routes";
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

registerRoutes(app);

app.notFound((c) => openaiError(c, 404, "endpoint not found", "not_found"));

app.onError((error, c) => {
  return openaiError(c, 500, error.message || "internal error", "internal_error");
});

export class NextclawQuotaDurableObject {
  constructor(
    private readonly _state: DurableObjectState,
    private readonly _env: Env
  ) {}

  async fetch(): Promise<Response> {
    return new Response("not_implemented", { status: 501 });
  }
}

export default app;
