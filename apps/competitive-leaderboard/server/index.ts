import { serve } from "@hono/node-server";
import { serveStatic } from "hono/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { competitiveLeaderboardApp } from "./leaderboard.controller.js";

const host = process.env.COMPETITIVE_LEADERBOARD_HOST?.trim() || "127.0.0.1";
const port = parsePort(process.env.COMPETITIVE_LEADERBOARD_PORT, 3194);
const appRoot = process.cwd();
const staticDir = resolve(appRoot, "dist/client");

if (existsSync(join(staticDir, "index.html"))) {
  const indexHtml = readFileSync(join(staticDir, "index.html"), "utf8");
  competitiveLeaderboardApp.use(
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

  competitiveLeaderboardApp.get("*", (c) => {
    if (c.req.path.startsWith("/api") || c.req.path.startsWith("/health")) {
      return c.notFound();
    }
    return c.html(indexHtml);
  });
}

serve(
  {
    fetch: competitiveLeaderboardApp.fetch,
    hostname: host,
    port
  },
  (serverInfo) => {
    console.log(
      `[competitive-leaderboard] listening at http://${serverInfo.address}:${serverInfo.port}`
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
