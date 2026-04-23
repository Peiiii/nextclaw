#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";

const DEFAULT_DURATION_MS = 30_000;
const DEFAULT_POLL_MS = 100;
const DEFAULT_REQUEST_TIMEOUT_MS = 1_500;
const DEFAULT_READY_TARGET_MS = 2_000;

function parseNumberArg(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function parseArgs(argv) {
  const options = {
    durationMs: DEFAULT_DURATION_MS,
    pollMs: DEFAULT_POLL_MS,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    readyTargetMs: DEFAULT_READY_TARGET_MS,
    isolatedHome: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--duration-ms") {
      options.durationMs = parseNumberArg(argv[++index], DEFAULT_DURATION_MS);
      continue;
    }
    if (arg === "--poll-ms") {
      options.pollMs = parseNumberArg(argv[++index], DEFAULT_POLL_MS);
      continue;
    }
    if (arg === "--request-timeout-ms") {
      options.requestTimeoutMs = parseNumberArg(argv[++index], DEFAULT_REQUEST_TIMEOUT_MS);
      continue;
    }
    if (arg === "--ready-target-ms") {
      options.readyTargetMs = parseNumberArg(argv[++index], DEFAULT_READY_TARGET_MS);
      continue;
    }
    if (arg === "--isolated-home") {
      options.isolatedHome = true;
      continue;
    }
    throw new Error(`Unsupported option: ${arg}`);
  }
  return options;
}

function nowMs(startedAt) {
  return Math.round(performance.now() - startedAt);
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          rejectPort(new Error("Unable to resolve free port"));
          return;
        }
        resolvePort(address.port);
      });
    });
  });
}

async function fetchProbe(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    let body = null;
    const text = await response.text().catch(() => "");
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text.slice(0, 200);
      }
    }
    return {
      ok: response.ok,
      status: response.status,
      latencyMs,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: Math.round(performance.now() - startedAt),
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

class ProbeMetric {
  firstOkMs = null;
  maxLatencyMs = 0;
  timeoutCount = 0;
  preReadyFailureCount = 0;
  errorCount = 0;
  samples = 0;
  lastBody = null;

  record = (result, elapsedMs, timeoutMs) => {
    this.samples += 1;
    this.maxLatencyMs = Math.max(this.maxLatencyMs, result.latencyMs);
    if (result.latencyMs >= timeoutMs || result.status === 0) {
      if (this.firstOkMs === null) {
        this.preReadyFailureCount += 1;
      } else {
        this.timeoutCount += 1;
      }
    }
    if (!result.ok) {
      this.errorCount += 1;
      return;
    }
    this.firstOkMs = this.firstOkMs ?? elapsedMs;
    this.lastBody = result.body;
  };
}

class StartupWaterfallProbe {
  constructor(options) {
    this.options = options;
    this.metrics = {
      authStatus: new ProbeMetric(),
      bootstrapStatus: new ProbeMetric(),
      frontend: new ProbeMetric(),
    };
    this.timeline = [];
    this.child = null;
    this.tempHome = null;
  }

  run = async () => {
    const backendPort = await getFreePort();
    const frontendPort = await getFreePort();
    const startedAt = performance.now();
    const env = {
      ...process.env,
      NEXTCLAW_DEV_BACKEND_PORT: String(backendPort),
      NEXTCLAW_DEV_FRONTEND_PORT: String(frontendPort),
      NEXTCLAW_STARTUP_TRACE: process.env.NEXTCLAW_STARTUP_TRACE ?? "1",
    };
    if (this.options.isolatedHome) {
      this.tempHome = mkdtempSync(join(tmpdir(), "nextclaw-startup-waterfall-"));
      env.NEXTCLAW_HOME = this.tempHome;
    }

    this.child = spawn("pnpm", ["dev", "start"], {
      cwd: resolve(import.meta.dirname, "../.."),
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.child.stdout.on("data", (chunk) => this.handleLog("stdout", chunk, startedAt));
    this.child.stderr.on("data", (chunk) => this.handleLog("stderr", chunk, startedAt));

    try {
      await this.pollUntilDone({
        startedAt,
        backendPort,
        frontendPort,
      });
      return this.buildReport({
        startedAt,
        backendPort,
        frontendPort,
      });
    } finally {
      await this.stop();
    }
  };

  handleLog = (stream, chunk, startedAt) => {
    const text = String(chunk);
    process[stream].write(text);
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }
      const elapsedMs = nowMs(startedAt);
      if (line.includes("[dev] API base:")) {
        this.timeline.push({ name: "dev_backend_url_printed", atMs: elapsedMs });
      }
      if (line.includes("[dev] Frontend:")) {
        this.timeline.push({ name: "dev_frontend_url_printed", atMs: elapsedMs });
      }
      if (line.includes("✓ UI API:")) {
        this.timeline.push({ name: "backend_ui_api_ready_log", atMs: elapsedMs });
      }
      if (line.includes("✓ UI frontend:")) {
        this.timeline.push({ name: "backend_static_frontend_ready_log", atMs: elapsedMs });
      }
      if (line.includes("✓ UI NCP agent: ready")) {
        this.timeline.push({ name: "ncp_agent_ready_log", atMs: elapsedMs });
      }
      if (line.includes("✓ Deferred startup:")) {
        this.timeline.push({ name: "deferred_startup_settled_log", atMs: elapsedMs });
      }
    }
  };

  pollUntilDone = async ({ startedAt, backendPort, frontendPort }) => {
    const authUrl = `http://127.0.0.1:${backendPort}/api/auth/status`;
    const bootstrapUrl = `http://127.0.0.1:${backendPort}/api/runtime/bootstrap-status`;
    const frontendUrl = `http://127.0.0.1:${frontendPort}/`;
    const endedAt = startedAt + this.options.durationMs;
    let pluginReadyAtMs = null;
    while (performance.now() < endedAt) {
      const [auth, bootstrap] = await Promise.all([
        this.probeMetric(this.metrics.authStatus, authUrl, startedAt),
        this.probeMetric(this.metrics.bootstrapStatus, bootstrapUrl, startedAt),
        this.probeMetric(this.metrics.frontend, frontendUrl, startedAt),
      ]);
      if (
        pluginReadyAtMs === null &&
        bootstrap.result.ok &&
        bootstrap.result.body &&
        typeof bootstrap.result.body === "object" &&
        bootstrap.result.body.pluginHydration?.state === "ready"
      ) {
        pluginReadyAtMs = bootstrap.elapsedMs;
        this.timeline.push({ name: "plugin_hydration_ready_status", atMs: bootstrap.elapsedMs });
      }
      await wait(this.options.pollMs);
    }
  };

  probeMetric = async (metric, url, startedAt) => {
    const result = await fetchProbe(url, this.options.requestTimeoutMs);
    const elapsedMs = nowMs(startedAt);
    metric.record(result, elapsedMs, this.options.requestTimeoutMs);
    return { result, elapsedMs };
  };

  buildReport = ({ backendPort, frontendPort }) => {
    const milestones = {
      auth_status_first_200_ms: this.metrics.authStatus.firstOkMs,
      bootstrap_status_first_200_ms: this.metrics.bootstrapStatus.firstOkMs,
      frontend_first_200_ms: this.metrics.frontend.firstOkMs,
      auth_status_max_latency_ms: this.metrics.authStatus.maxLatencyMs,
      bootstrap_status_max_latency_ms: this.metrics.bootstrapStatus.maxLatencyMs,
      frontend_max_latency_ms: this.metrics.frontend.maxLatencyMs,
      auth_status_timeout_count: this.metrics.authStatus.timeoutCount,
      bootstrap_status_timeout_count: this.metrics.bootstrapStatus.timeoutCount,
      frontend_timeout_count: this.metrics.frontend.timeoutCount,
      auth_status_pre_ready_failure_count: this.metrics.authStatus.preReadyFailureCount,
      bootstrap_status_pre_ready_failure_count: this.metrics.bootstrapStatus.preReadyFailureCount,
      frontend_pre_ready_failure_count: this.metrics.frontend.preReadyFailureCount,
    };
    const sortedWaterfall = Object.entries(milestones)
      .filter(([, value]) => typeof value === "number")
      .map(([name, value]) => ({ name, valueMs: value }))
      .sort((left, right) => right.valueMs - left.valueMs);
    return {
      command: "pnpm dev start",
      backendPort,
      frontendPort,
      durationMs: this.options.durationMs,
      requestTimeoutMs: this.options.requestTimeoutMs,
      readyTargetMs: this.options.readyTargetMs,
      pass: (
        (milestones.auth_status_first_200_ms ?? Number.POSITIVE_INFINITY) <= this.options.readyTargetMs &&
        (milestones.bootstrap_status_first_200_ms ?? Number.POSITIVE_INFINITY) <= this.options.readyTargetMs &&
        (milestones.frontend_first_200_ms ?? Number.POSITIVE_INFINITY) <= this.options.readyTargetMs &&
        milestones.auth_status_timeout_count === 0 &&
        milestones.bootstrap_status_timeout_count === 0
      ),
      milestones,
      timeline: this.timeline.sort((left, right) => left.atMs - right.atMs),
      sortedWaterfall,
      isolatedHome: this.options.isolatedHome,
    };
  };

  stop = async () => {
    if (this.child && this.child.exitCode === null) {
      this.child.kill("SIGTERM");
      await wait(800);
      if (this.child.exitCode === null) {
        this.child.kill("SIGKILL");
      }
    }
    if (this.tempHome) {
      rmSync(this.tempHome, { recursive: true, force: true });
    }
  };
}

const options = parseArgs(process.argv.slice(2));
const report = await new StartupWaterfallProbe(options).run();
console.log("\n[startup-waterfall] sorted waterfall:");
for (const item of report.sortedWaterfall) {
  console.log(`- ${item.name}: ${item.valueMs}ms`);
}
console.log("\n[startup-waterfall] report:");
console.log(JSON.stringify(report, null, 2));
if (!report.pass) {
  process.exitCode = 1;
}
