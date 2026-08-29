import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";

const packagedRunnerName = process.platform === "win32"
  ? "nextclaw-wasmtime-runner.exe"
  : "nextclaw-wasmtime-runner";
const packagedRunnerPath = fileURLToPath(new URL(
  `../../../packages/nextclaw/resources/native/${process.platform}-${process.arch}/${packagedRunnerName}`,
  import.meta.url,
));
const runnerPath = path.resolve(process.argv[2] ?? packagedRunnerPath);
const componentsRoot = fileURLToPath(new URL(
  "../../../packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab/service-components/",
  import.meta.url,
));
const workDirectory = await mkdtemp(path.join(tmpdir(), "nextclaw-spin-smoke-"));
const runner = spawn(runnerPath, [], { stdio: ["pipe", "pipe", "pipe"] });
const lines = createInterface({ input: runner.stdout });
const pending = new Map();
lines.on("line", (line) => {
  const response = JSON.parse(line);
  pending.get(response.requestId)?.(response);
  pending.delete(response.requestId);
});

try {
  const request = (operation, app, actionName, input) => {
    const requestId = randomUUID();
    const response = new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error(`timed out waiting for ${operation}`)); }, 10_000);
      pending.set(requestId, (value) => { clearTimeout(timer); resolve(value); });
    });
    runner.stdin.write(`${JSON.stringify({ requestId, operation, app, actionName, input })}\n`);
    return response;
  };
  const expectOk = async (operation, app, action, input) => {
    const response = await request(operation, app, action, input);
    if (!response.ok) throw new Error(`${operation} failed: ${JSON.stringify(response.error)}`);
    return response.result;
  };
  const expectError = async (operation, app, action, input, code) => {
    const response = await request(operation, app, action, input);
    if (response.ok || response.error?.code !== code) throw new Error(`expected ${code}, got ${JSON.stringify(response)}`);
    return response.error;
  };
  const app = (id, component, options = {}) => ({ id, componentPath: path.join(componentsRoot, component, "service.wasm"), dataDirectory: path.join(workDirectory, id), ...options });
  const state = app("smoke-state", "nextclaw-portable-runtime-lab-state", { storageEnabled: true });
  const stateDenied = app("smoke-state-denied", "nextclaw-portable-runtime-lab-state");
  const capability = app("smoke-capability", "nextclaw-portable-runtime-lab-capabilities");
  const provider = app("nextclaw-portable-runtime-lab-provider", "nextclaw-portable-runtime-lab-provider", { storageEnabled: true });
  const composition = app("smoke-composition", "nextclaw-portable-runtime-lab-composition", { storageEnabled: true, allowedProviderIds: [provider.id] });
  const compositionDenied = app("smoke-composition-denied", "nextclaw-portable-runtime-lab-composition", { storageEnabled: true });
  const resident = app("smoke-resident", "nextclaw-portable-runtime-lab-resident", { storageEnabled: true });

  const actions = await expectOk("list-actions", state);
  if (actions.length !== 8 || !actions.some(({ name }) => name === "record_upsert")) throw new Error(`state actions are incomplete: ${JSON.stringify(actions)}`);
  await expectOk("invoke", state, "counter_increment", { step: 3 });
  const stateRead = await expectOk("invoke", state, "counter_read");
  if (stateRead.counter !== 3 || stateRead.persistedBy !== "host.kv") throw new Error(`bad KV result: ${JSON.stringify(stateRead)}`);
  await expectError("invoke", stateDenied, "counter_read", undefined, "WASI_CAPABILITY_DENIED");
  const networkDenied = await expectOk("invoke", capability, "network_denied");
  if (!networkDenied.denied || !String(networkDenied.reason).includes("NETWORK_DENIED")) throw new Error("network policy was not observed");

  const providerStart = await expectOk("start-provider", provider, undefined, {});
  if (providerStart.mode !== "provider") throw new Error(`provider did not start: ${JSON.stringify(providerStart)}`);
  const composed = await expectOk("invoke", composition, "compose_contact", { name: "  Ada Lovelace ", email: " ADA@EXAMPLE.COM ", tags: ["Work", "work"] });
  if (composed.provider.normalizedEmail !== "ada@example.com" || composed.provider.providerCallCount !== 1) throw new Error(`composition failed: ${JSON.stringify(composed)}`);
  const denied = await expectOk("invoke", compositionDenied, "provider_denied");
  if (!denied.denied || !String(denied.reason).includes("PROVIDER_DENIED")) throw new Error("provider denial was not observed");

  await expectOk("start-resident", resident, undefined, { eventIntervalMs: 1000 });
  await expectOk("deliver-event", resident, undefined, { eventId: "smoke-1", kind: "verification", triggeredAt: "smoke" });
  const residentStatus = await expectOk("invoke", resident, "resident_status");
  if (residentStatus.eventCount !== 1 || residentStatus.inMemoryEventCount !== 1) throw new Error(`resident state failed: ${JSON.stringify(residentStatus)}`);
  const beforeStop = await expectOk("stats");
  if (beforeStop.runnerPid !== runner.pid || beforeStop.providerInstances !== 1 || beforeStop.residentInstances !== 1) throw new Error(`bad stats: ${JSON.stringify(beforeStop)}`);
  await expectOk("stop", resident, undefined, { stoppedAt: "smoke" });
  await expectOk("stop", provider, undefined, { stoppedAt: "smoke" });
  const afterStop = await expectOk("stats");
  if (afterStop.runnerPid !== beforeStop.runnerPid || afterStop.providerInstances !== 0 || afterStop.residentInstances !== 0) throw new Error(`stop did not release instances: ${JSON.stringify(afterStop)}`);
  console.log(JSON.stringify({ ok: true, runner: runnerPath, checks: ["list-actions", "host.kv", "storage-denied", "network-denied", "provider", "composition", "provider-denied", "resident", "stats-same-pid", "stop"], stats: afterStop }, null, 2));
} finally {
  runner.kill("SIGTERM");
  await rm(workDirectory, { recursive: true, force: true });
}
