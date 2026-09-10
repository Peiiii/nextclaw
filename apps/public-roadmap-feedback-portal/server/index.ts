import { serve } from "@hono/node-server";
import { serveStatic } from "hono/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { publicRoadmapFeedbackPortalApp } from "./portal.controller.js";
import { SupportLocalDatabaseService } from "./support/support-local-database.service.js";
import type { PortalWorkerEnv } from "./portal-env.types.js";

const host = process.env.PUBLIC_ROADMAP_FEEDBACK_PORTAL_HOST?.trim() || "127.0.0.1";
const port = parsePort(process.env.PUBLIC_ROADMAP_FEEDBACK_PORTAL_PORT, 3196);
const appRoot = process.cwd();
const staticDir = resolve(appRoot, "dist/client");
const supportDatabase = process.env.SUPPORT_DATABASE_PATH
  ? new SupportLocalDatabaseService(resolve(process.env.SUPPORT_DATABASE_PATH), pathToFileURL(resolve(appRoot, "migrations") + "/"))
  : undefined;
const bindings: PortalWorkerEnv = {
  PUBLIC_ROADMAP_PORTAL_DB: supportDatabase,
  PUBLIC_ROADMAP_FEEDBACK_PORTAL_DATA_MODE: supportDatabase ? "live" : "preview",
  SUPPORT_PLATFORM_API_BASE: process.env.SUPPORT_PLATFORM_API_BASE,
  DISCUSSION_PARTICIPANT_TOKEN: process.env.DISCUSSION_PARTICIPANT_TOKEN,
  SUPPORT_ADMIN_TOKEN: process.env.SUPPORT_ADMIN_TOKEN,
  SUPPORT_MAX_AUTHORITY: process.env.SUPPORT_MAX_AUTHORITY as PortalWorkerEnv["SUPPORT_MAX_AUTHORITY"],
  SUPPORT_PAUSED: process.env.SUPPORT_PAUSED,
  SUPPORT_GITHUB_REPOSITORY: process.env.SUPPORT_GITHUB_REPOSITORY,
  SUPPORT_GITHUB_TOKEN: process.env.SUPPORT_GITHUB_TOKEN
};

if (existsSync(join(staticDir, "index.html"))) {
  const indexHtml = readFileSync(join(staticDir, "index.html"), "utf8");
  publicRoadmapFeedbackPortalApp.use(
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

  publicRoadmapFeedbackPortalApp.get("*", (c) => {
    if (c.req.path.startsWith("/api") || c.req.path.startsWith("/health")) {
      return c.notFound();
    }
    return c.html(indexHtml);
  });
}

serve(
  {
    fetch: (request) => publicRoadmapFeedbackPortalApp.fetch(request, bindings),
    hostname: host,
    port
  },
  (serverInfo) => {
    console.log(
      `[public-roadmap-feedback-portal] listening at http://${serverInfo.address}:${serverInfo.port}`
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
