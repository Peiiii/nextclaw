import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PortableServiceRunnerClientService } from "./portable-service-runner-client.service.js";

const tempDirectories: string[] = [];
const testEnv = { PATH: process.env.PATH };

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function createFakeRunner(protocolVersion: string): string {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-portable-runner-"));
  tempDirectories.push(directory);
  const runnerPath = join(directory, "fake-runner.mjs");
  writeFileSync(runnerPath, `#!/usr/bin/env node
import readline from "node:readline";
const lines = readline.createInterface({ input: process.stdin });
lines.on("line", (line) => {
  const request = JSON.parse(line);
  process.stdout.write(JSON.stringify({
    kind: "response",
    requestId: request.requestId,
    protocolVersion: ${JSON.stringify(protocolVersion)},
    ok: true,
    result: { runnerPid: process.pid, loadedComponents: 0, providerInstances: 0, residentInstances: 0 }
  }) + "\\n");
});
`);
  chmodSync(runnerPath, 0o755);
  return runnerPath;
}

function createFailingRunner(): string {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-portable-runner-failing-"));
  tempDirectories.push(directory);
  const runnerPath = join(directory, "failing-runner.mjs");
  writeFileSync(runnerPath, "#!/usr/bin/env node\nprocess.stderr.write('unsupported runtime ABI\\n');\nprocess.exit(1);\n");
  chmodSync(runnerPath, 0o755);
  return runnerPath;
}

function createDeniedRunner(): string {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-portable-runner-denied-"));
  tempDirectories.push(directory);
  const runnerPath = join(directory, "denied-runner.mjs");
  writeFileSync(runnerPath, `#!/usr/bin/env node
import readline from "node:readline";
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  process.stderr.write("[portable-runtime][denied][error] storage denied\\n", () => {
    process.stdout.write(JSON.stringify({
      requestId: request.requestId,
      kind: "response",
      protocolVersion: "0.2.0",
      ok: false,
      error: { code: "WASI_CAPABILITY_DENIED", message: "storage is not allowed" }
    }) + "\\n");
  });
});
`);
  chmodSync(runnerPath, 0o755);
  return runnerPath;
}

function createJobRunner(): string {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-portable-job-runner-"));
  tempDirectories.push(directory);
  const runnerPath = join(directory, "job-runner.mjs");
  writeFileSync(runnerPath, `#!/usr/bin/env node
import readline from "node:readline";
const jobs = new Map();
const send = (value) => process.stdout.write(JSON.stringify({ protocolVersion: "0.2.0", ...value }) + "\\n");
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (request.operation === "start-job") {
    jobs.set(request.jobId, true);
    send({ kind: "response", requestId: request.requestId, ok: true, result: { jobId: request.jobId } });
    setTimeout(() => { if (jobs.has(request.jobId)) send({ kind: "job-progress", jobId: request.jobId, sequence: 1, current: 1, total: 2 }); }, 5);
    setTimeout(() => { if (jobs.has(request.jobId)) send({ kind: "stream-chunk", jobId: request.jobId, sequence: 2, content: "first chunk" }); }, 10);
    setTimeout(() => { if (jobs.has(request.jobId)) { jobs.delete(request.jobId); send({ kind: "job-terminal", jobId: request.jobId, sequence: 3, status: "succeeded", result: { ok: true } }); } }, 40);
    return;
  }
  if (request.operation === "cancel-job") {
    const exists = jobs.delete(request.jobId);
    send({ kind: "response", requestId: request.requestId, ok: exists, result: { jobId: request.jobId }, error: exists ? undefined : { code: "JOB_NOT_FOUND", message: "missing" } });
    if (exists) send({ kind: "job-terminal", jobId: request.jobId, sequence: 9, status: "cancelled", error: { code: "JOB_CANCELLED", message: "cancelled" } });
    return;
  }
  send({ kind: "response", requestId: request.requestId, ok: true, result: { runnerPid: process.pid, loadedComponents: 0, providerInstances: 0, residentInstances: 0 } });
});
`);
  chmodSync(runnerPath, 0o755);
  return runnerPath;
}

function createHostCallRunner(): string {
  const directory = mkdtempSync(join(tmpdir(), "nextclaw-portable-host-call-runner-"));
  tempDirectories.push(directory);
  const runnerPath = join(directory, "host-call-runner.mjs");
  writeFileSync(runnerPath, `#!/usr/bin/env node
import readline from "node:readline";
const jobs = new Map();
const send = (value) => process.stdout.write(JSON.stringify({ protocolVersion: "0.2.0", ...value }) + "\\n");
readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line);
  if (request.operation === "start-job") {
    jobs.set(request.jobId, request);
    send({ kind: "response", requestId: request.requestId, ok: true, result: { jobId: request.jobId } });
    send({ kind: "host-call-request", hostCallId: request.jobId + ":host:1", jobId: request.jobId, sequence: 1, callId: request.callId || request.jobId, traceId: request.traceId || request.jobId, appId: request.app.id, capability: request.actionName, input: { slotId: "summary", messages: [{ role: "user", content: "hi" }] } });
    return;
  }
  if (request.operation === "resolve-host-call") {
    const jobId = request.hostCallId.split(":host:")[0];
    if (request.hostCallError) {
      send({ kind: "response", requestId: request.requestId, ok: true, result: { resolved: true } });
      send({ kind: "job-terminal", jobId, sequence: 2, status: "failed", error: request.hostCallError });
      return;
    }
    send({ kind: "response", requestId: request.requestId, ok: true, result: { resolved: true } });
    send({ kind: "job-terminal", jobId, sequence: 2, status: "succeeded", result: request.hostCallResult });
    return;
  }
  if (request.operation === "cancel-job") {
    const existed = jobs.delete(request.jobId);
    send({ kind: "response", requestId: request.requestId, ok: existed, result: { cancelRequested: existed } });
    if (existed) send({ kind: "job-terminal", jobId: request.jobId, sequence: 9, status: "cancelled", error: { code: "JOB_CANCELLED", message: "cancelled" } });
    return;
  }
  send({ kind: "response", requestId: request.requestId, ok: true, result: {} });
});
`);
  chmodSync(runnerPath, 0o755);
  return runnerPath;
}

describe("PortableServiceRunnerClientService distribution contract", () => {
  it("fails clearly when the distribution has no runner", async () => {
    const client = new PortableServiceRunnerClientService({ env: testEnv });

    await expect(client.stats()).rejects.toMatchObject({
      code: "PORTABLE_RUNNER_UNAVAILABLE",
    });
  });

  it("does not fall back when an explicit development override is invalid", async () => {
    const client = new PortableServiceRunnerClientService({
      env: { ...testEnv, NEXTCLAW_WASMTIME_RUNNER_PATH: "/missing/explicit-runner" },
      runnerPath: createFakeRunner("0.2.0"),
    });

    await expect(client.stats()).rejects.toThrow("/missing/explicit-runner");
  });

  it("rejects an incompatible runner protocol on the first response", async () => {
    const client = new PortableServiceRunnerClientService({
      env: testEnv,
      runnerPath: createFakeRunner("9.9.9"),
    });

    await expect(client.stats()).rejects.toMatchObject({
      code: "PORTABLE_RUNNER_PROTOCOL_MISMATCH",
    });
    await client.dispose();
  });

  it("uses the distribution runner when no development override exists", async () => {
    const client = new PortableServiceRunnerClientService({
      env: testEnv,
      runnerPath: createFakeRunner("0.2.0"),
    });

    await expect(client.stats()).resolves.toMatchObject({ loadedComponents: 0 });
    expect(client.getLastObservation()).toMatchObject({
      operation: "stats",
      runnerPid: expect.any(Number),
      durationMs: expect.any(Number),
      memory: expect.any(Object),
      logs: [],
    });
    await client.dispose();
  });

  it("preserves stable WASI codes and a bounded runner log tail", async () => {
    const client = new PortableServiceRunnerClientService({
      env: testEnv,
      runnerPath: createDeniedRunner(),
    });

    await expect(client.stats()).rejects.toMatchObject({
      code: "WASI_CAPABILITY_DENIED",
      details: {
        logs: [expect.stringContaining("storage denied")],
      },
    });
    expect(client.getLastObservation()).toMatchObject({
      operation: "stats",
      logs: [expect.stringContaining("storage denied")],
    });
    await client.dispose();
  });

  it("rejects the request without crashing the host when the runner exits before stdin is written", async () => {
    const client = new PortableServiceRunnerClientService({
      env: testEnv,
      runnerPath: createFailingRunner(),
    });

    await expect(client.stats()).rejects.toMatchObject({
      name: "PortableServiceRunnerError",
    });
    await client.dispose();
  });

  it("streams jobs, cancels one job, and leaves another execution available", async () => {
    const client = new PortableServiceRunnerClientService({ env: testEnv, runnerPath: createJobRunner() });
    const events: string[] = [];
    const app = {
      id: "lab", componentPath: "/tmp/lab.wasm", dataDirectory: "/tmp/lab-data",
      permissions: {}, fileMounts: [], secretVariables: {}, secretFingerprints: {},
    };
    const job = await client.startJob(app, "long", {}, (event) => events.push(event.kind));
    await expect(job.result).resolves.toEqual({ ok: true });
    expect(events).toEqual(["job-progress", "stream-chunk", "job-terminal"]);

    const cancelled = await client.startJob(app, "slow", {});
    await client.cancelJob(cancelled.jobId);
    await expect(cancelled.result).rejects.toMatchObject({ code: "JOB_CANCELLED" });
    await expect(client.invoke(app, "long", {}, 100)).resolves.toEqual({ ok: true });
    await expect(client.stats()).resolves.toMatchObject({ loadedComponents: 0 });
    await client.dispose();
  });

  it("resolves typed host calls without exposing runner secrets, rejects denied calls, and aborts callbacks with their Job", async () => {
    const client = new PortableServiceRunnerClientService({ env: testEnv, runnerPath: createHostCallRunner() });
    const app = {
      id: "lab", componentPath: "/tmp/lab.wasm", dataDirectory: "/tmp/lab-data",
      permissions: {}, fileMounts: [], secretVariables: { nextclaw_secret_token: "top-secret" }, secretFingerprints: {},
    };
    const seen: unknown[] = [];
    await expect(client.invoke(app, "model-complete", {}, 500, async (request) => {
      seen.push(request);
      return { content: "safe", usage: { totalTokens: 3 } };
    })).resolves.toEqual({ content: "safe", usage: { totalTokens: 3 } });
    expect(JSON.stringify(seen)).not.toContain("top-secret");
    expect(seen[0]).toMatchObject({ capability: "model-complete", appId: "lab", hostCallId: expect.any(String) });

    await expect(client.invoke(app, "model-complete", {}, 500, async () => {
      throw new Error("provider leaked top-secret");
    })).rejects.toMatchObject({ code: "HOST_CALL_FAILED", message: "The NextClaw host capability call failed." });

    let aborted = false;
    await expect(client.invoke(app, "agent-start", {}, 20, async (_request, signal) => {
      await new Promise<void>((resolve) => signal.addEventListener("abort", () => { aborted = true; resolve(); }, { once: true }));
      return {};
    })).rejects.toMatchObject({ code: "PORTABLE_RUNTIME_TIMEOUT" });
    expect(aborted).toBe(true);
    await client.dispose();
  });
});
