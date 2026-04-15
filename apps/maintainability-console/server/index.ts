import { serve } from "@hono/node-server";
import { serveStatic } from "hono/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createMaintainabilityConsoleApp } from "./maintainability-console.controller.js";
import { MaintainabilityDataService } from "./maintainability-data.service.js";

const host = process.env.MAINTAINABILITY_CONSOLE_HOST?.trim() || "127.0.0.1";
const port = parsePort(process.env.MAINTAINABILITY_CONSOLE_PORT, 3198);
const appRoot = process.cwd();
const staticDir = resolve(appRoot, "dist/client");
const service = new MaintainabilityDataService(appRoot);
const app = createMaintainabilityConsoleApp(service);

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
