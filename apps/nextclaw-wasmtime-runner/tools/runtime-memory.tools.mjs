import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const runnerDirectory = path.resolve(toolsDirectory, "..");
const repositoryRoot = path.resolve(runnerDirectory, "../..");
const executable = process.platform === "win32"
  ? "nextclaw-wasmtime-runner.exe"
  : "nextclaw-wasmtime-runner";
const runnerArgumentIndex = process.argv.indexOf("--runner");
const runnerPath = runnerArgumentIndex >= 0
  ? path.resolve(process.argv[runnerArgumentIndex + 1])
  : path.join(runnerDirectory, "target", "release", executable);
const appRoot = path.join(
  repositoryRoot,
  "packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab/service-components",
);
const nodeFixturePath = path.join(toolsDirectory, "node-service-fixture.tools.mjs");
const children = [];
const benchmarkDirectory = await mkdtemp(path.join(tmpdir(), "nextclaw-portable-density-"));

try {
  const runner = spawn(runnerPath, [], { stdio: ["pipe", "pipe", "pipe"] });
  children.push(runner);
  const runnerLines = createInterface({ input: runner.stdout });
  const responses = new Map();
  runnerLines.on("line", (line) => {
    const response = JSON.parse(line);
    responses.get(response.requestId)?.(response);
    responses.delete(response.requestId);
  });
  const requestRunner = async (request) => {
    const requestId = randomUUID();
    const response = new Promise((resolve) => responses.set(requestId, resolve));
    runner.stdin.write(`${JSON.stringify({ ...request, requestId })}\n`);
    const value = await response;
    if (!value.ok) throw new Error(value.error?.message ?? "Runner request failed");
    return value.result;
  };

  await requestRunner({ operation: "stats" });
  const runnerEmptyMiB = await stableRssMiB(runner.pid);
  const runnerDensityMiB = {};
  let firstComponentLoadMs;
  const hotInvokeSamplesMs = [];
  const sourceComponent = path.join(
    appRoot,
    "nextclaw-portable-runtime-lab-state",
    "service.wasm",
  );
  for (let index = 1; index <= 10; index += 1) {
    const componentPath = path.join(benchmarkDirectory, `component-${index}.wasm`);
    await copyFile(sourceComponent, componentPath);
    const app = runnerApp(index, componentPath);
    const loadStartedAt = performance.now();
    await requestRunner({ operation: "list-actions", app });
    if (index === 1) {
      firstComponentLoadMs = roundMs(performance.now() - loadStartedAt);
      for (let sample = 0; sample < 10; sample += 1) {
        const invokeStartedAt = performance.now();
        await requestRunner({
          operation: "invoke",
          app,
          actionName: "counter_read",
          input: {},
        });
        hotInvokeSamplesMs.push(performance.now() - invokeStartedAt);
      }
    }
    if ([1, 5, 10].includes(index)) {
      runnerDensityMiB[index] = await stableRssMiB(runner.pid);
    }
  }

  const nodeServices = [];
  const nodeDensityMiB = {};
  for (let index = 1; index <= 10; index += 1) {
    const service = await spawnNodeFixture();
    children.push(service);
    nodeServices.push(service);
    if ([1, 5, 10].includes(index)) {
      nodeDensityMiB[index] = await stableTotalRssMiB(nodeServices.map((child) => child.pid));
    }
  }

  const result = {
    measuredAt: new Date().toISOString(),
    platform: process.platform,
    architecture: process.arch,
    nodeVersion: process.version,
    runnerPath,
    method: "Median of five OS RSS samples after warm-up; each Component uses a distinct artifact path and each Node baseline uses an independent process.",
    metricsMiB: {
      runnerEmpty: runnerEmptyMiB,
      runnerWithComponents: runnerDensityMiB,
      nodeServicesTotal: nodeDensityMiB,
    },
    derivedMiB: {
      firstComponentIncrement: roundMiB(runnerDensityMiB[1] - runnerEmptyMiB),
      componentsTwoThroughFiveIncrement: roundMiB(runnerDensityMiB[5] - runnerDensityMiB[1]),
      componentsSixThroughTenIncrement: roundMiB(runnerDensityMiB[10] - runnerDensityMiB[5]),
      nodeServicesTwoThroughFiveIncrement: roundMiB(nodeDensityMiB[5] - nodeDensityMiB[1]),
      nodeServicesSixThroughTenIncrement: roundMiB(nodeDensityMiB[10] - nodeDensityMiB[5]),
    },
    latencyMs: {
      firstComponentListActions: firstComponentLoadMs,
      hotCounterReadMedian: median(hotInvokeSamplesMs.map(roundMs)),
    },
    caveat: "Development-machine directional evidence only; production adoption still requires equivalent workloads, Resident density, CPU/latency, and cross-platform measurements.",
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  for (const child of children) child.kill("SIGKILL");
  await rm(benchmarkDirectory, { force: true, recursive: true });
}

function runnerApp(index, componentPath) {
  const id = `nextclaw-portable-density-${index}`;
  const dataDirectory = path.join(benchmarkDirectory, `data-${index}`);
  return {
    id,
    componentPath,
    dataDirectory,
    allowedDomains: ["httpbin.org"],
    storageEnabled: true,
  };
}

async function spawnNodeFixture() {
  const child = spawn(process.execPath, [nodeFixturePath], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const lines = createInterface({ input: child.stdout });
  await new Promise((resolve, reject) => {
    lines.once("line", resolve);
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Node fixture exited early: ${code}`)));
  });
  return child;
}

async function stableRssMiB(pid) {
  return await stableTotalRssMiB([pid]);
}

async function stableTotalRssMiB(pids) {
  const samples = [];
  for (let index = 0; index < 5; index += 1) {
    await delay(150);
    const result = spawnSync("ps", ["-o", "rss=", "-p", pids.join(",")], {
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(`Unable to read RSS for pids ${pids.join(",")}: ${result.stderr}`);
    }
    const totalKiB = result.stdout
      .trim()
      .split(/\s+/)
      .reduce((sum, value) => sum + Number.parseInt(value, 10), 0);
    samples.push(totalKiB / 1024);
  }
  samples.sort((left, right) => left - right);
  return roundMiB(samples[Math.floor(samples.length / 2)]);
}

function roundMiB(value) {
  return Math.round(value * 100) / 100;
}

function roundMs(value) {
  return Math.round(value * 100) / 100;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}
