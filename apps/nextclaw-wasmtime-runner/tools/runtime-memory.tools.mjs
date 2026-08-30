/**
 * Same-machine portable-runtime regression evidence. It compares an
 * independent Node process fixture with the exact same counter read/write JSON
 * protocol; it is never a cross-machine or cross-OS performance claim.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { createInterface } from "node:readline";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const runnerDirectory = path.resolve(toolsDirectory, "..");
const repositoryRoot = path.resolve(runnerDirectory, "../..");
const executable = process.platform === "win32" ? "nextclaw-wasmtime-runner.exe" : "nextclaw-wasmtime-runner";
const runnerPath = path.resolve(readOption("--runner") ?? path.join(runnerDirectory, "target", "release", executable));
const outputPath = readOption("--output");
const componentsRoot = path.join(repositoryRoot, "packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab/service-components");
const nodeFixturePath = path.join(toolsDirectory, "node-service-fixture.tools.mjs");
const children = [];
const workDirectory = await mkdtemp(path.join(tmpdir(), "nextclaw-portable-performance-"));

try {
  const runner = createRunnerClient(runnerPath);
  children.push(runner.child);
  await runner.request({ operation: "stats" });

  const actionApps = await createApps("action", "nextclaw-portable-runtime-lab-state");
  const residentApps = await createApps("resident", "nextclaw-portable-runtime-lab-resident");
  const emptyRunner = await stableMetrics(runner.child.pid);
  const actionInstances = await measureActionDensity(runner, actionApps);
  const residentInstances = await measureResidentDensity(runner, residentApps);

  const wasmColdStartedAt = performance.now();
  await counterWorkloadWasm(runner, actionApps[0]);
  const wasmCold = roundMs(performance.now() - wasmColdStartedAt);
  const wasmHot = await latencySamples(() => counterWorkloadWasm(runner, actionApps[0]));
  const wasmThroughput = await throughput(() => counterWorkloadWasm(runner, actionApps[0]), runner.child.pid);

  const nodeServices = [];
  const nodeServiceProcesses = {};
  for (let index = 1; index <= 10; index += 1) {
    const service = await spawnNodeFixture(index);
    children.push(service.child);
    nodeServices.push(service);
    if ([1, 5, 10].includes(index)) nodeServiceProcesses[index] = await stableTotalMetrics(nodeServices.map((item) => item.child.pid));
  }
  const nodeColdStartedAt = performance.now();
  await counterWorkloadNode(nodeServices[0]);
  const nodeCold = roundMs(performance.now() - nodeColdStartedAt);
  const nodeHot = await latencySamples(() => counterWorkloadNode(nodeServices[0]));
  const nodeThroughput = await throughput(() => counterWorkloadNode(nodeServices[0]), nodeServices[0].child.pid);

  const beforeUnload = await stableMetrics(runner.child.pid);
  for (const app of [...residentApps, ...actionApps]) {
    await runner.request({ operation: "stop", app, input: { reason: "performance-unload" } });
  }
  const afterUnload = await stableMetrics(runner.child.pid);

  const result = {
    schemaVersion: 1,
    kind: "nextclaw.portable-runtime.performance",
    ok: true,
    // These names are consumed by portable-runtime-ci-evidence.tools.ts. They are
    // only written after the actual workload and regression budget below
    // complete successfully.
    checks: [
      "equivalent-counter-workload",
      "budget-within-range",
      "resident-density",
      "unload-recovery",
    ],
    measuredAt: new Date().toISOString(),
    environment: { platform: process.platform, architecture: process.arch, nodeVersion: process.version },
    identity: {
      runnerPath,
      runnerSha256: await sha256File(runnerPath),
      stateComponentSha256: await sha256File(componentPath("nextclaw-portable-runtime-lab-state")),
      residentComponentSha256: await sha256File(componentPath("nextclaw-portable-runtime-lab-resident")),
    },
    workload: {
      id: "counter-read-write-json-v1",
      iterations: 30,
      throughputDurationMs: 2_000,
      sequence: ["counter_increment(step=1)", "counter_read"],
      equivalence: "Both candidates deserialize JSON, read a persisted counter, serialize/write its next value, then serialize a read. Node is an independent process baseline, not a claim about production Node services.",
    },
    metrics: {
      memory: {
        emptyRunner,
        actionInstances,
        residentInstances,
        nodeServiceProcesses,
        unloadRecovery: {
          before: beforeUnload,
          after: afterUnload,
          rssRecoveredMiB: roundMiB((beforeUnload.rssMiB ?? 0) - (afterUnload.rssMiB ?? 0)),
        },
      },
      latencyMs: {
        wasm: { cold: wasmCold, hotP50: percentile(wasmHot, 0.5), hotP95: percentile(wasmHot, 0.95) },
        nodeFixture: { cold: nodeCold, hotP50: percentile(nodeHot, 0.5), hotP95: percentile(nodeHot, 0.95) },
      },
      throughput: { wasm: wasmThroughput, nodeFixture: nodeThroughput },
    },
    regressionBudget: {
      purpose: "Broad same-machine regression budget. It is not an absolute cross-platform SLA.",
      maxHotP95Ms: 5_000,
      maxResidentTenIncrementMiB: 256,
      minUnloadRecoveryMiB: -8,
    },
    caveats: [
      "RSS is OS working-set evidence. Linux PSS is collected when /proc exists; pssMiB is null elsewhere.",
      "CPU is sampled from the measured process during throughput and is directional rather than system-wide attribution.",
      "A budget breach requires investigation; it does not compare different CI machine classes.",
    ],
  };
  enforceBudget(result);
  const serialized = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) await writeFile(path.resolve(outputPath), serialized, "utf8");
  process.stdout.write(serialized);
} finally {
  for (const child of children) terminate(child);
  await rm(workDirectory, { force: true, recursive: true });
}

function componentPath(component) { return path.join(componentsRoot, component, "service.wasm"); }

async function createApps(kind, component) {
  const result = [];
  for (let index = 1; index <= 10; index += 1) {
    const copiedPath = path.join(workDirectory, `${kind}-${index}.wasm`);
    await copyFile(componentPath(component), copiedPath);
    result.push({
      id: `nextclaw-portable-performance-${kind}-${index}`,
      componentPath: copiedPath,
      dataDirectory: path.join(workDirectory, `${kind}-data-${index}`),
      storageEnabled: true,
    });
  }
  return result;
}

async function measureActionDensity(runner, apps) {
  const result = {};
  for (let index = 1; index <= apps.length; index += 1) {
    await runner.request({ operation: "list-actions", app: apps[index - 1] });
    if ([1, 5, 10].includes(index)) result[index] = await stableMetrics(runner.child.pid);
  }
  return result;
}

async function measureResidentDensity(runner, apps) {
  const result = {};
  for (let index = 1; index <= apps.length; index += 1) {
    await runner.request({ operation: "start-resident", app: apps[index - 1], input: { eventIntervalMs: 60_000 } });
    if ([1, 5, 10].includes(index)) result[index] = await stableMetrics(runner.child.pid);
  }
  return result;
}

function createRunnerClient(command) {
  const child = spawn(command, [], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
  const pending = new Map();
  let stderr = "";
  createInterface({ input: child.stdout }).on("line", (line) => {
    const response = JSON.parse(line);
    if (!response.requestId || !pending.has(response.requestId)) return;
    const resolve = pending.get(response.requestId);
    pending.delete(response.requestId);
    resolve(response);
  });
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  return { child, request: (request) => requestResponse(child, pending, request, `runner ${request.operation}: ${stderr.slice(-2_000)}`) };
}

async function spawnNodeFixture(index) {
  const child = spawn(process.execPath, [nodeFixturePath, "--data-directory", path.join(workDirectory, `node-data-${index}`)], {
    stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
  });
  const pending = new Map();
  const lines = createInterface({ input: child.stdout });
  await new Promise((resolve, reject) => {
    lines.once("line", resolve);
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`Node fixture exited early: ${code}`)));
  });
  lines.on("line", (line) => {
    const response = JSON.parse(line);
    const resolve = pending.get(response.requestId);
    if (!resolve) return;
    pending.delete(response.requestId);
    resolve(response);
  });
  return { child, request: (request) => requestResponse(child, pending, request, `node fixture ${request.operation}`) };
}

function requestResponse(child, pending, request, label) {
  return new Promise((resolve, reject) => {
    const requestId = randomUUID();
    const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`${label} timed out`)); }, 30_000);
    pending.set(requestId, (response) => {
      clearTimeout(timer);
      if (response.ok) resolve(response.result);
      else reject(new Error(response.error?.message ?? JSON.stringify(response.error)));
    });
    child.stdin.write(`${JSON.stringify({ ...request, requestId })}\n`);
  });
}

async function counterWorkloadWasm(runner, app) {
  await runner.request({ operation: "invoke", app, actionName: "counter_increment", input: { step: 1 } });
  return runner.request({ operation: "invoke", app, actionName: "counter_read", input: {} });
}

async function counterWorkloadNode(service) {
  await service.request({ operation: "invoke", actionName: "counter_increment", input: { step: 1 } });
  return service.request({ operation: "invoke", actionName: "counter_read", input: {} });
}

async function latencySamples(operation) {
  const samples = [];
  for (let index = 0; index < 30; index += 1) {
    const startedAt = performance.now();
    await operation();
    samples.push(performance.now() - startedAt);
  }
  return samples;
}

async function throughput(operation, pid) {
  const before = await readMetrics(pid);
  const startedAt = performance.now();
  let operations = 0;
  while (performance.now() - startedAt < 2_000) { await operation(); operations += 1; }
  const elapsedMs = performance.now() - startedAt;
  const after = await readMetrics(pid);
  return {
    operations,
    elapsedMs: roundMs(elapsedMs),
    operationsPerSecond: roundMs((operations * 1_000) / elapsedMs),
    processCpuMs: before.cpuTimeMs === null || after.cpuTimeMs === null ? null : roundMs(after.cpuTimeMs - before.cpuTimeMs),
  };
}

async function stableMetrics(pid) {
  const samples = [];
  for (let index = 0; index < 5; index += 1) { await delay(150); samples.push(await readMetrics(pid)); }
  return medianMetrics(samples);
}

async function stableTotalMetrics(pids) {
  const samples = [];
  for (let index = 0; index < 5; index += 1) {
    await delay(150);
    const values = await Promise.all(pids.map(readMetrics));
    samples.push({ rssMiB: sumNullable(values.map((value) => value.rssMiB)), pssMiB: sumNullable(values.map((value) => value.pssMiB)), cpuTimeMs: sumNullable(values.map((value) => value.cpuTimeMs)) });
  }
  return medianMetrics(samples);
}

async function readMetrics(pid) {
  if (process.platform === "win32") return windowsMetrics(pid);
  const result = spawnSync("ps", ["-o", "rss=", "-o", "time=", "-p", String(pid)], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) throw new Error(`Unable to read process metrics for pid ${pid}: ${result.stderr}`);
  const [rssKiB, cpu] = result.stdout.trim().split(/\s+/);
  return { rssMiB: roundMiB(Number.parseInt(rssKiB, 10) / 1024), pssMiB: process.platform === "linux" ? await linuxPssMiB(pid) : null, cpuTimeMs: parsePsCpuTime(cpu) };
}

function windowsMetrics(pid) {
  const command = `$p=Get-Process -Id ${pid}; [pscustomobject]@{rssBytes=$p.WorkingSet64;cpuMs=[math]::Round($p.TotalProcessorTime.TotalMilliseconds)} | ConvertTo-Json -Compress`;
  const result = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`Unable to read Windows process metrics for pid ${pid}: ${result.stderr}`);
  const value = JSON.parse(result.stdout);
  return { rssMiB: roundMiB(value.rssBytes / (1024 * 1024)), pssMiB: null, cpuTimeMs: value.cpuMs };
}

async function linuxPssMiB(pid) {
  try {
    const content = await readFile(`/proc/${pid}/smaps_rollup`, "utf8");
    const match = content.match(/^Pss:\s+(\d+)\s+kB$/m);
    return match ? roundMiB(Number.parseInt(match[1], 10) / 1024) : null;
  } catch { return null; }
}

async function sha256File(filePath) {
  return `sha256:${createHash("sha256").update(await readFile(filePath)).digest("hex")}`;
}

function medianMetrics(samples) { return { rssMiB: medianNullable(samples.map((sample) => sample.rssMiB)), pssMiB: medianNullable(samples.map((sample) => sample.pssMiB)), cpuTimeMs: medianNullable(samples.map((sample) => sample.cpuTimeMs)) }; }
function parsePsCpuTime(value) { const parts = value.split(":").map(Number); if (parts.some(Number.isNaN)) return null; return (parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]) * 1_000; }
function percentile(values, ratio) { const sorted = [...values].sort((left, right) => left - right); return roundMs(sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]); }
function medianNullable(values) { const defined = values.filter((value) => value !== null).sort((left, right) => left - right); return defined.length ? defined[Math.floor(defined.length / 2)] : null; }
function sumNullable(values) { return values.some((value) => value === null) ? null : roundMiB(values.reduce((sum, value) => sum + value, 0)); }
function enforceBudget(result) { const { maxHotP95Ms, maxResidentTenIncrementMiB, minUnloadRecoveryMiB } = result.regressionBudget; const empty = result.metrics.memory.emptyRunner.rssMiB; const residentTen = result.metrics.memory.residentInstances[10]?.rssMiB; const recovered = result.metrics.memory.unloadRecovery.rssRecoveredMiB; if (result.metrics.latencyMs.wasm.hotP95 > maxHotP95Ms || (empty !== null && residentTen !== undefined && residentTen - empty > maxResidentTenIncrementMiB) || recovered < minUnloadRecoveryMiB) throw new Error(`Portable runtime regression budget exceeded: ${JSON.stringify({ empty, residentTen, recovered })}`); }
function terminate(child) { if (child.exitCode === null) child.kill(process.platform === "win32" ? undefined : "SIGTERM"); }
function readOption(name) { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; }
function roundMiB(value) { return Math.round(value * 100) / 100; }
function roundMs(value) { return Math.round(value * 100) / 100; }
