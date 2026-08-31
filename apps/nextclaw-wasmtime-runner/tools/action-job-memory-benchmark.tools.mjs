/**
 * Same-machine Action Job memory benchmark.
 *
 * Spin measurements preload one Component, then hold N real Jobs at the
 * NextClaw host-call boundary so every Store/instance is simultaneously live.
 * The native comparison launches N tiny persistent Rust Todo services and also
 * verifies that one service remains stable across repeated calls. macOS uses
 * process physical footprint as its primary delta metric; Linux uses PSS.
 */
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { startRunnerSession } from "./spin-runner-session.tools.mjs";
import {
  divideMetrics,
  stableMetrics,
  stableTotalMetrics,
  subtractMetrics,
} from "./action-memory-metrics.tools.mjs";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const runnerDirectory = path.resolve(toolsDirectory, "..");
const repositoryRoot = path.resolve(runnerDirectory, "../..");
const executable = process.platform === "win32" ? "nextclaw-wasmtime-runner.exe" : "nextclaw-wasmtime-runner";
const runnerPath = path.resolve(readOption("--runner") ?? path.join(runnerDirectory, "target", "release", executable));
const outputPath = readOption("--output");
const concurrencyLevels = (readOption("--concurrency") ?? "1,2,4,8,10")
  .split(",")
  .map((value) => Number.parseInt(value, 10))
  .filter((value) => Number.isInteger(value) && value > 0);
const repeatBatches = Number.parseInt(readOption("--repeat-batches") ?? "10", 10);
const componentsRoot = path.join(
  repositoryRoot,
  "packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab/service-components",
);
const componentPath = path.join(
  componentsRoot,
  "nextclaw-portable-runtime-lab-capabilities",
  "service.wasm",
);
const nativeFixtureSource = path.join(toolsDirectory, "fixtures/native-todo-memory-fixture.rs");
const workDirectory = await mkdtemp(path.join(tmpdir(), "nextclaw-action-memory-"));
const children = [];

async function main() {
  try {
    await mkdir(path.join(workDirectory, "spin-data"), { recursive: true });
    const native = await measureNativeTodo();
    const spin = {};
    for (const concurrency of concurrencyLevels) {
      spin[concurrency] = await measureSpinConcurrency(concurrency);
    }
    const repeat = await measureSpinRepeat(Math.max(...concurrencyLevels), repeatBatches);
    const ten = spin[10] ?? spin[Math.max(...concurrencyLevels)];
    const primaryMetric = process.platform === "linux" ? "pssMiB" : "physicalFootprintMiB";
    const perActionMiB = ten?.perAction?.[primaryMetric] ?? ten?.perAction?.rssMiB ?? null;
    const classification = classify(perActionMiB);
    const result = {
    schemaVersion: 1,
    kind: "nextclaw.spin-action-job-memory",
    measuredAt: new Date().toISOString(),
    environment: {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      rustcVersion: commandOutput("rustc", ["--version"]),
      primaryMetric,
      caveat: process.platform === "linux"
        ? "Linux PSS is the primary physical-memory attribution metric."
        : "macOS physical footprint and warm-relative RSS are same-machine architectural evidence, not Linux PSS.",
    },
    identity: {
      runnerPath,
      runnerBytes: (await stat(runnerPath)).size,
      componentPath,
      componentBytes: (await stat(componentPath)).size,
      nativeFixtureSource,
      nativeBinaryBytes: native.binaryBytes,
    },
    workload: {
      component: "nextclaw-portable-runtime-lab-capabilities",
      action: "agent_start",
      concurrencyLevels,
      holdPoint: "nextclaw host-call request before resolution",
      repeatBatches,
      jobsPerRepeatBatch: Math.max(...concurrencyLevels),
    },
    metrics: { native, spin, repeat },
    acceptance: {
      primaryMetric,
      perActionMiB,
      classification,
      thresholdsMiB: { excellent: 1.5, acceptable: 3, compareDirectWasmtime: 5 },
    },
    };
    const serialized = `${JSON.stringify(result, null, 2)}\n`;
    if (outputPath) await writeFile(path.resolve(outputPath), serialized, "utf8");
    process.stdout.write(serialized);
  } finally {
    for (const child of children) terminate(child);
    await rm(workDirectory, { force: true, recursive: true });
  }
}

async function measureSpinConcurrency(concurrency) {
  const harness = await SpinHarness.start(`concurrency-${concurrency}`);
  try {
    const warm = await stableMetrics(harness.session.child.pid);
    const jobs = await harness.startHeldJobs(concurrency);
    const peak = await stableMetrics(harness.session.child.pid);
    harness.releaseAll();
    const terminals = await Promise.all(jobs.map(({ terminal }) => terminal));
    if (terminals.some(({ status }) => status !== "succeeded")) {
      throw new Error(`held Jobs did not all succeed: ${JSON.stringify(terminals)}`);
    }
    const settled = await stableMetrics(harness.session.child.pid);
    return {
      warm,
      peak,
      settled,
      liveJobsAtPeak: harness.observedHostCalls,
      incremental: subtractMetrics(peak, warm),
      perAction: divideMetrics(subtractMetrics(peak, warm), concurrency),
      retained: subtractMetrics(settled, warm),
    };
  } finally {
    await harness.stop();
  }
}

async function measureSpinRepeat(concurrency, batches) {
  const harness = await SpinHarness.start("repeat");
  try {
    const warm = await stableMetrics(harness.session.child.pid);
    const checkpoints = [];
    for (let batch = 1; batch <= batches; batch += 1) {
      const jobs = await harness.startHeldJobs(concurrency);
      harness.releaseAll();
      const terminals = await Promise.all(jobs.map(({ terminal }) => terminal));
      if (terminals.some(({ status }) => status !== "succeeded")) {
        throw new Error(`repeat batch ${batch} failed: ${JSON.stringify(terminals)}`);
      }
      if (batch === 1 || batch === batches || batch % 10 === 0) {
        checkpoints.push({ batch, metrics: await stableMetrics(harness.session.child.pid) });
      }
    }
    const settled = await stableMetrics(harness.session.child.pid);
    return {
      concurrency,
      batches,
      totalJobs: concurrency * batches,
      warm,
      checkpoints,
      settled,
      retained: subtractMetrics(settled, warm),
    };
  } finally {
    await harness.stop();
  }
}

class SpinHarness {
  heldCalls = [];
  observedHostCalls = 0;

  static start = async (label) => {
    const harness = new SpinHarness(label);
    await harness.preload();
    return harness;
  };

  constructor(label) {
    this.app = {
      id: `memory-${label}`,
      componentPath,
      dataDirectory: path.join(workDirectory, "spin-data", label),
    };
    this.session = startRunnerSession(runnerPath, {
      onHostCall: this.holdHostCall,
    });
    children.push(this.session.child);
  }

  holdHostCall = (request) => {
    if (request.capability !== "agent-start") {
      throw Object.assign(new Error(`unexpected host capability ${request.capability}`), {
        code: "UNEXPECTED_HOST_CALL",
      });
    }
    this.observedHostCalls += 1;
    return new Promise((resolve) => this.heldCalls.push(resolve));
  };

  preload = async () => {
    await mkdir(this.app.dataDirectory, { recursive: true });
    const preloaded = await this.session.request({
      requestId: randomUUID(),
      operation: "list-actions",
      app: this.app,
    });
    if (!preloaded.ok) throw new Error(`preload failed: ${JSON.stringify(preloaded.error)}`);
  };

  startHeldJobs = async (count) => {
    const before = this.observedHostCalls;
    const jobs = Array.from({ length: count }, (_, index) => {
      const jobId = randomUUID();
      return {
        jobId,
        terminal: this.session.waitForJob(jobId, 30_000),
        started: this.session.request({
          requestId: randomUUID(),
          operation: "start-job",
          app: this.app,
          actionName: "agent_start",
          input: { slotId: `memory-${index}`, input: { kind: "memory-hold" } },
          jobId,
          callId: `memory-call-${index}`,
          traceId: `memory-trace-${index}`,
          timeoutMs: 30_000,
        }),
      };
    });
    const responses = await Promise.all(jobs.map(({ started }) => started));
    if (responses.some(({ ok }) => !ok)) {
      throw new Error(`start-job failed: ${JSON.stringify(responses)}`);
    }
    await waitFor(() => this.observedHostCalls - before === count, 30_000);
    return jobs;
  };

  releaseAll = () => {
    const releases = this.heldCalls.splice(0);
    for (const release of releases) {
      release({ handle: { runId: randomUUID() } });
    }
  };

  stop = async () => {
    await this.session.stop();
    const index = children.indexOf(this.session.child);
    if (index >= 0) children.splice(index, 1);
  };
}

async function measureNativeTodo() {
  const binaryPath = path.join(workDirectory, "native-todo-memory-fixture");
  const compile = spawnSync("rustc", [
    "-C", "opt-level=z",
    "-C", "lto=fat",
    "-C", "codegen-units=1",
    "-C", "panic=abort",
    "-C", "strip=symbols",
    nativeFixtureSource,
    "-o", binaryPath,
  ], { encoding: "utf8" });
  if (compile.status !== 0) {
    throw new Error(`native fixture compilation failed: ${compile.stderr}`);
  }
  const services = [];
  const density = {};
  try {
    for (let index = 1; index <= 10; index += 1) {
      const service = await startNativeService(binaryPath);
      services.push(service);
      children.push(service.child);
      if ([1, 2, 4, 8, 10].includes(index)) {
        density[index] = await stableTotalMetrics(services.map(({ child }) => child.pid));
      }
    }
    const beforeRepeatedCalls = await stableMetrics(services[0].child.pid);
    for (let index = 0; index < 1_000; index += 1) await services[0].request("list");
    const afterRepeatedCalls = await stableMetrics(services[0].child.pid);
    return {
      binaryBytes: (await stat(binaryPath)).size,
      density,
      repeatedCalls: {
        iterations: 1_000,
        before: beforeRepeatedCalls,
        after: afterRepeatedCalls,
        delta: subtractMetrics(afterRepeatedCalls, beforeRepeatedCalls),
      },
    };
  } finally {
    for (const service of services) {
      await service.stop();
      const index = children.indexOf(service.child);
      if (index >= 0) children.splice(index, 1);
    }
  }
}

async function startNativeService(binaryPath) {
  const child = spawn(binaryPath, [], { stdio: ["pipe", "pipe", "pipe"] });
  const lines = createInterface({ input: child.stdout });
  const queue = [];
  const waiting = [];
  lines.on("line", (line) => {
    const waiter = waiting.shift();
    if (waiter) waiter(line);
    else queue.push(line);
  });
  const nextLine = () => queue.length
    ? Promise.resolve(queue.shift())
    : new Promise((resolve) => waiting.push(resolve));
  const ready = await nextLine();
  if (ready !== "ready") throw new Error(`native fixture did not become ready: ${ready}`);
  return {
    child,
    request: async (command) => {
      child.stdin.write(`${command}\n`);
      return nextLine();
    },
    stop: async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const exited = once(child, "exit");
      child.stdin.write("stop\n");
      child.stdin.end();
      await exited;
    },
  };
}

function classify(perActionMiB) {
  if (perActionMiB === null) return "unavailable";
  if (perActionMiB <= 1.5) return "excellent";
  if (perActionMiB <= 3) return "acceptable";
  if (perActionMiB <= 5) return "compare-direct-wasmtime";
  return "unacceptable";
}

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("timed out waiting for concurrent host calls");
    await delay(10);
  }
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function terminate(child) {
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

await main();
