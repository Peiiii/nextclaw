import { execFile } from "node:child_process";
import { open, readdir, readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { isAbsolute, join, relative, resolve } from "node:path";
import { promisify } from "node:util";

import { emptyUsage, parseRollout } from "./codex-rollout-adapter.mjs";
import { analyzeParsedRollouts } from "./task-phase-analyzer.mjs";
import { PROTOCOL } from "./task-phase-protocol.mjs";

const execFileAsync = promisify(execFile);
const SESSION_HEADER_BYTES = 64 * 1024;
export const DEFAULT_HISTORY_START = "2026-08-14";
const DASHBOARD_ROOT = new URL("../../dashboard/", import.meta.url);
const STATIC_ASSETS = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  [
    "/task-telemetry-dashboard.css",
    ["task-telemetry-dashboard.css", "text/css; charset=utf-8"],
  ],
  [
    "/task-telemetry-dashboard.js",
    ["task-telemetry-dashboard.js", "text/javascript; charset=utf-8"],
  ],
]);

function isWithinWorkspace(candidate, workspace) {
  const path = relative(workspace, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

async function collectJsonlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await collectJsonlFiles(path)));
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) paths.push(path);
  }
  return paths;
}

function rolloutDate(path, sessionsRoot) {
  const segments = relative(sessionsRoot, path).split(/[\\/]/);
  if (segments.length < 4) return null;
  const candidate = `${segments[0]}-${segments[1]}-${segments[2]}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

async function readRolloutWorkspace(path) {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(SESSION_HEADER_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const lines = buffer.subarray(0, bytesRead).toString("utf8").split(/\r?\n/);
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        if (
          record.type === "session_meta" &&
          typeof record.payload?.cwd === "string"
        ) {
          return resolve(record.payload.cwd);
        }
      } catch {
        // Ignore a truncated final header line and keep looking.
      }
    }
    return null;
  } finally {
    await handle.close();
  }
}

async function resolveGitCommonDirectory(workspace) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "-C",
        workspace,
        "rev-parse",
        "--path-format=absolute",
        "--git-common-dir",
      ],
      { timeout: 2_000 },
    );
    return resolve(stdout.trim());
  } catch {
    return null;
  }
}

export async function discoverProjectRollouts({
  historyStart = DEFAULT_HISTORY_START,
  sessionsRoot,
  workspace,
}) {
  const resolvedSessionsRoot = resolve(sessionsRoot);
  const resolvedWorkspace = resolve(workspace);
  const candidates = (await collectJsonlFiles(resolvedSessionsRoot)).sort();
  const eligibleCandidates = candidates.filter((path) => {
    const date = rolloutDate(path, resolvedSessionsRoot);
    return date === null || date >= historyStart;
  });
  const workspaceByPath = new Map(
    await Promise.all(
      eligibleCandidates.map(async (path) => [
        path,
        await readRolloutWorkspace(path),
      ]),
    ),
  );
  const targetGitCommonDirectory =
    await resolveGitCommonDirectory(resolvedWorkspace);
  const gitCommonDirectoryByWorkspace = new Map();

  const matchesWorkspace = async (candidateWorkspace) => {
    if (!candidateWorkspace) return false;
    if (isWithinWorkspace(candidateWorkspace, resolvedWorkspace)) return true;
    if (!targetGitCommonDirectory) return false;
    if (!gitCommonDirectoryByWorkspace.has(candidateWorkspace)) {
      gitCommonDirectoryByWorkspace.set(
        candidateWorkspace,
        await resolveGitCommonDirectory(candidateWorkspace),
      );
    }
    return (
      gitCommonDirectoryByWorkspace.get(candidateWorkspace) ===
      targetGitCommonDirectory
    );
  };

  const matchedPaths = [];
  for (const path of eligibleCandidates) {
    if (await matchesWorkspace(workspaceByPath.get(path)))
      matchedPaths.push(path);
  }
  const fileFacts = await Promise.all(
    matchedPaths.map(async (path) => {
      const facts = await stat(path);
      return { path, size: facts.size, mtime_ms: facts.mtimeMs };
    }),
  );

  return {
    scanned_rollout_count: candidates.length,
    eligible_rollout_count: eligibleCandidates.length,
    matched_rollout_count: matchedPaths.length,
    file_facts: fileFacts,
    paths: matchedPaths,
    signature: fileFacts
      .map(
        ({ path, size, mtime_ms: mtimeMs }) =>
          `${path}\u0000${size}\u0000${mtimeMs}`,
      )
      .join("\n"),
  };
}

function emptyReport() {
  return {
    protocol: PROTOCOL,
    generated_from: [],
    tasks: [],
    corpus: {
      observed_usage: emptyUsage(),
      attributed_usage: emptyUsage(),
      unattributed_usage: emptyUsage(),
      pre_start_unattributed: emptyUsage(),
      mechanical_coverage: null,
    },
    warnings: [],
  };
}

export class TaskTelemetryDashboardDataSource {
  constructor({
    historyStart = DEFAULT_HISTORY_START,
    sessionsRoot,
    workspace,
  }) {
    this.historyStart = historyStart;
    this.sessionsRoot = resolve(sessionsRoot);
    this.workspace = resolve(workspace);
    this.cachedSignature = null;
    this.cachedSnapshot = null;
    this.parsedRollouts = new Map();
  }

  getSnapshot = async () => {
    const discovered = await discoverProjectRollouts({
      historyStart: this.historyStart,
      sessionsRoot: this.sessionsRoot,
      workspace: this.workspace,
    });
    if (this.cachedSnapshot && this.cachedSignature === discovered.signature) {
      return {
        ...this.cachedSnapshot,
        meta: { ...this.cachedSnapshot.meta, cache_hit: true },
      };
    }

    const startedAt = performance.now();
    const activePaths = new Set(discovered.paths);
    for (const path of this.parsedRollouts.keys()) {
      if (!activePaths.has(path)) this.parsedRollouts.delete(path);
    }
    let parsedRolloutCount = 0;
    for (const [fileOrder, facts] of discovered.file_facts.entries()) {
      const signature = `${facts.size}\u0000${facts.mtime_ms}`;
      const cached = this.parsedRollouts.get(facts.path);
      if (cached?.signature === signature) continue;
      this.parsedRollouts.set(facts.path, {
        signature,
        rollout: await parseRollout(facts.path, fileOrder),
      });
      parsedRolloutCount += 1;
    }
    const parsed = discovered.paths.map(
      (path) => this.parsedRollouts.get(path).rollout,
    );
    const report =
      parsed.length === 0 ? emptyReport() : analyzeParsedRollouts(parsed);
    const snapshot = {
      meta: {
        generated_at: new Date().toISOString(),
        history_start: this.historyStart,
        workspace: this.workspace,
        sessions_root: this.sessionsRoot,
        scanned_rollout_count: discovered.scanned_rollout_count,
        eligible_rollout_count: discovered.eligible_rollout_count,
        matched_rollout_count: discovered.matched_rollout_count,
        parsed_rollout_count: parsedRolloutCount,
        analysis_ms: Math.round((performance.now() - startedAt) * 100) / 100,
        cache_hit: false,
      },
      report,
    };
    this.cachedSignature = discovered.signature;
    this.cachedSnapshot = snapshot;
    return snapshot;
  };
}

function applySecurityHeaders(response) {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
  );
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "no-store");
}

function sendJson(response, statusCode, body, headOnly) {
  const payload = Buffer.from(JSON.stringify(body));
  response.writeHead(statusCode, {
    "Content-Length": payload.byteLength,
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(headOnly ? undefined : payload);
}

export function createTaskTelemetryDashboardServer({
  historyStart,
  sessionsRoot,
  workspace,
}) {
  const resolvedHistoryStart = historyStart ?? DEFAULT_HISTORY_START;
  const dataSource = new TaskTelemetryDashboardDataSource({
    historyStart: resolvedHistoryStart,
    sessionsRoot,
    workspace,
  });
  return createServer(async (request, response) => {
    applySecurityHeaders(response);
    const method = request.method ?? "GET";
    const headOnly = method === "HEAD";
    if (method !== "GET" && !headOnly) {
      response.setHeader("Allow", "GET, HEAD");
      sendJson(response, 405, { error: "method_not_allowed" }, headOnly);
      return;
    }

    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    try {
      if (url.pathname === "/api/health") {
        sendJson(
          response,
          200,
          {
            kind: "nextclaw-development-task-telemetry-dashboard",
            protocol: PROTOCOL,
            history_start: resolvedHistoryStart,
            sessions_root: resolve(sessionsRoot),
            workspace: resolve(workspace),
          },
          headOnly,
        );
        return;
      }
      if (url.pathname === "/api/report") {
        sendJson(response, 200, await dataSource.getSnapshot(), headOnly);
        return;
      }

      const asset = STATIC_ASSETS.get(url.pathname);
      if (!asset) {
        sendJson(response, 404, { error: "not_found" }, headOnly);
        return;
      }
      const [fileName, contentType] = asset;
      const payload = await readFile(new URL(fileName, DASHBOARD_ROOT));
      response.writeHead(200, {
        "Content-Length": payload.byteLength,
        "Content-Type": contentType,
      });
      response.end(headOnly ? undefined : payload);
    } catch (error) {
      sendJson(
        response,
        500,
        {
          error: "dashboard_report_failed",
          message: error instanceof Error ? error.message : String(error),
        },
        headOnly,
      );
    }
  });
}

export async function listenForTaskTelemetryDashboard({
  historyStart,
  host = "127.0.0.1",
  port,
  sessionsRoot,
  workspace,
}) {
  const server = createTaskTelemetryDashboardServer({
    historyStart,
    sessionsRoot,
    workspace,
  });
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(port, host, () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Dashboard server did not expose a TCP address.");
  }
  return {
    server,
    url: `http://${host}:${address.port}`,
  };
}
