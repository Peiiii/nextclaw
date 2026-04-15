import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import type { ApiEnvelope, MaintainabilityOverview } from "../shared/maintainability.types.js";
import type { MaintainabilityDataService } from "./maintainability-data.service.js";

function okEnvelope<T>(data: T): ApiEnvelope<T> {
  return {
    ok: true,
    data
  };
}

function errorEnvelope(code: string, message: string): ApiEnvelope<never> {
  return {
    ok: false,
    error: {
      code,
      message
    }
  };
}

export function createMaintainabilityConsoleApp(
  service: MaintainabilityDataService
): Hono {
  const app = new Hono();

  app.use("/*", compress());
  app.use("/api/*", cors());

  app.get("/health", (c) => {
    return c.json(okEnvelope({
      status: "ok"
    }));
  });

  app.get("/api/maintainability/overview", async (c) => {
    try {
      const profile = service.assertProfile(c.req.query("profile"));
      const overview: MaintainabilityOverview = await service.getOverview(profile);
      return c.json(okEnvelope(overview));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load maintainability overview.";
      const status = message.startsWith("Unsupported maintainability profile") ? 400 : 500;
      return c.json(errorEnvelope(status === 400 ? "INVALID_PROFILE" : "OVERVIEW_FAILED", message), status);
    }
  });

  return app;
}
