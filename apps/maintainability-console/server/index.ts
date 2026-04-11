import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { serveStatic } from "hono/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ApiEnvelope, MaintainabilityOverview } from "../shared/maintainability.types.js";
import { MaintainabilityDataService } from "./maintainability-data.service.js";

const host = process.env.MAINTAINABILITY_CONSOLE_HOST?.trim() || "127.0.0.1";
const port = parsePort(process.env.MAINTAINABILITY_CONSOLE_PORT, 3198);
const appRoot = process.cwd();
const staticDir = resolve(appRoot, "dist/client");
const service = new MaintainabilityDataService(appRoot);
const app = new Hono();

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

if (existsSync(join(staticDir, "index.html"))) {
  const indexHtml = readFileSync(join(staticDir, "index.html"), "utf8");
  app.use(
    "/*",
    serveStatic({
      root: staticDir,
      join,
      getContent: async (filePath) => {
        try {
          return await readFile(filePath);
        } catch {
          return null;
        }
      },
      isDir: async (filePath) => {
        try {
          return (await stat(filePath)).isDirectory();
        } catch {
          return false;
        }
      }
    })
  );
  app.get("*", (c) => {
    if (c.req.path.startsWith("/api") || c.req.path.startsWith("/health")) {
      return c.notFound();
    }
    return c.html(indexHtml);
  });
}

serve(
  {
    fetch: app.fetch,
    hostname: host,
    port
  },
  (serverInfo) => {
    console.log(
      `[maintainability-console] listening at http://${serverInfo.address}:${serverInfo.port}`
    );
  }
);

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
