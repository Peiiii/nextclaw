#!/usr/bin/env node

import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_HISTORY_START,
  listenForTaskTelemetryDashboard,
} from "./lib/task-telemetry-dashboard-server.mjs";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4785;
const PORT_SEARCH_LIMIT = 10;
const DASHBOARD_KIND = "nextclaw-development-task-telemetry-dashboard";

export function parseOptions(argv) {
  const options = {
    help: false,
    historyStart: DEFAULT_HISTORY_START,
    open: true,
    port: null,
    sessionsRoot: join(homedir(), ".codex", "sessions"),
    workspace: process.cwd(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--help") options.help = true;
    else if (argument === "--no-open") options.open = false;
    else if (argument === "--port") {
      const port = Number(argv[++index]);
      if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error("--port requires an integer between 1 and 65535.");
      }
      options.port = port;
    } else if (argument === "--sessions-root") {
      const value = argv[++index];
      if (!value) throw new Error("--sessions-root requires a path.");
      options.sessionsRoot = value;
    } else if (argument === "--since") {
      const value = argv[++index];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) {
        throw new Error("--since requires a date in YYYY-MM-DD format.");
      }
      options.historyStart = value;
    } else if (argument === "--workspace") {
      const value = argv[++index];
      if (!value) throw new Error("--workspace requires a path.");
      options.workspace = value;
    } else throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}

export function printHelp() {
  console.log(`Usage: pnpm development-task-telemetry:dashboard -- [options]

Start a read-only local dashboard for development-task Token and phase usage.

Options:
  --no-open               Do not open the browser automatically
  --port <port>           Use a fixed port instead of 4785 or the next free port
  --sessions-root <path>  Read Codex rollout JSONL files from this directory
  --since <YYYY-MM-DD>    Include rollout files from this date (default: ${DEFAULT_HISTORY_START})
  --workspace <path>      Show sessions for this Git workspace and its worktrees
  --help                  Show this help`);
}

async function findExistingDashboard({
  historyStart,
  host,
  ports,
  sessionsRoot,
  workspace,
}) {
  for (const port of ports) {
    try {
      const response = await fetch(`http://${host}:${port}/api/health`, {
        signal: AbortSignal.timeout(250),
      });
      if (!response.ok) continue;
      const health = await response.json();
      if (
        health.kind === DASHBOARD_KIND &&
        health.history_start === historyStart &&
        resolve(health.sessions_root) === resolve(sessionsRoot) &&
        resolve(health.workspace) === resolve(workspace)
      ) {
        return `http://${host}:${port}`;
      }
    } catch {
      // An unavailable or unrelated port remains a candidate for a new server.
    }
  }
  return null;
}

function openBrowser(url) {
  const command =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  const child = spawn(command[0], command[1], {
    detached: true,
    stdio: "ignore",
  });
  child.once("error", () => {
    console.warn(`Could not open the browser automatically. Open ${url}`);
  });
  child.unref();
}

async function listenOnFirstAvailablePort(options, ports) {
  let lastError = null;
  for (const port of ports) {
    try {
      return await listenForTaskTelemetryDashboard({
        host: DEFAULT_HOST,
        historyStart: options.historyStart,
        port,
        sessionsRoot: options.sessionsRoot,
        workspace: options.workspace,
      });
    } catch (error) {
      if (error?.code !== "EADDRINUSE") throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error("No dashboard port is available.");
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseOptions(argv);
  if (options.help) {
    printHelp();
    return { help: true };
  }

  const firstPort = options.port ?? DEFAULT_PORT;
  const ports = options.port
    ? [options.port]
    : Array.from(
        { length: PORT_SEARCH_LIMIT },
        (_, index) => firstPort + index,
      );
  const existingUrl = await findExistingDashboard({
    historyStart: options.historyStart,
    host: DEFAULT_HOST,
    ports,
    sessionsRoot: options.sessionsRoot,
    workspace: options.workspace,
  });
  if (existingUrl) {
    console.log(`Development Task Telemetry dashboard: ${existingUrl}`);
    console.log(`Workspace: ${resolve(options.workspace)}`);
    console.log("Reused the running dashboard.");
    if (options.open) openBrowser(existingUrl);
    return { reused: true, url: existingUrl };
  }

  const running = await listenOnFirstAvailablePort(options, ports);
  console.log(`Development Task Telemetry dashboard: ${running.url}`);
  console.log(`Workspace: ${resolve(options.workspace)}`);
  console.log(`Sessions: ${resolve(options.sessionsRoot)}`);
  console.log(`History starts: ${options.historyStart}`);
  console.log("Refresh: every 15 seconds while the page is open");
  console.log("Press Ctrl+C to stop.");
  if (options.open) openBrowser(running.url);
  return { ...running, reused: false };
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
