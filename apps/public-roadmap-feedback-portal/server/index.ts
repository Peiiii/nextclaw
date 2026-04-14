import { serve } from "@hono/node-server";
import { serveStatic } from "hono/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { publicRoadmapFeedbackPortalApp } from "./portal.controller.js";

const host = process.env.PUBLIC_ROADMAP_FEEDBACK_PORTAL_HOST?.trim() || "127.0.0.1";
const port = parsePort(process.env.PUBLIC_ROADMAP_FEEDBACK_PORTAL_PORT, 3196);
const appRoot = process.cwd();
const staticDir = resolve(appRoot, "dist/client");

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
    fetch: publicRoadmapFeedbackPortalApp.fetch,
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
