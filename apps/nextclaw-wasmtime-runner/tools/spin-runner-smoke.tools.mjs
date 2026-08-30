import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import { startRunnerSession } from "./spin-runner-session.tools.mjs";

const packagedRunnerName = process.platform === "win32"
  ? "nextclaw-wasmtime-runner.exe"
  : "nextclaw-wasmtime-runner";
const packagedRunnerPath = fileURLToPath(new URL(
  `../../../packages/nextclaw/resources/native/${process.platform}-${process.arch}/${packagedRunnerName}`,
  import.meta.url,
));
const runnerOptionIndex = process.argv.indexOf("--runner");
const outputOptionIndex = process.argv.indexOf("--output");
const positionalRunner = process.argv[2]?.startsWith("--") ? undefined : process.argv[2];
const runnerPath = path.resolve(
  runnerOptionIndex >= 0 ? process.argv[runnerOptionIndex + 1] : positionalRunner ?? packagedRunnerPath,
);
const outputPath = outputOptionIndex >= 0 ? process.argv[outputOptionIndex + 1] : undefined;
const componentsRoot = fileURLToPath(new URL(
  "../../../packages/nextclaw/resources/apps/nextclaw-portable-runtime-lab/service-components/",
  import.meta.url,
));
const workDirectory = await mkdtemp(path.join(tmpdir(), "nextclaw-spin-smoke-"));

const aiHostCalls = [];
let holdAgentHostCall;
const waitFor = async (predicate, timeoutMs = 2_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("timed out waiting for expected runner event");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
const runnerSession = startRunnerSession(runnerPath, {
  onHostCall: async (request) => {
    aiHostCalls.push(request);
    if (request.capability === "model-complete") {
      const messages = request.input?.messages;
      if (!Array.isArray(messages)) throw Object.assign(new Error("invalid model request"), { code: "AI_INVALID_INPUT" });
      if (request.input?.slotId === "denied") {
        throw Object.assign(new Error("model slot is not authorized"), { code: "AI_CAPABILITY_DENIED" });
      }
      return { content: "smoke-model-result", usage: { totalTokens: 3 }, correlation: request.callId };
    }
    if (request.capability === "agent-start") {
      if (request.input?.slotId === "hold") {
        await new Promise((resolve) => { holdAgentHostCall = resolve; });
      }
      return { handle: { runId: "smoke-agent-run" }, correlation: request.callId };
    }
    throw Object.assign(new Error("unexpected capability"), { code: "AI_CAPABILITY_UNAVAILABLE" });
  },
});
const runner = runnerSession.child;

try {
  const request = (operation, app, actionName, input) => {
    const requestId = randomUUID();
    return runnerSession.request({ requestId, operation, app, actionName, input });
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
  const startJob = async (app, actionName, input, { callId = randomUUID(), traceId = randomUUID(), timeoutMs = 7_000 } = {}) => {
    const jobId = randomUUID();
    const terminal = runnerSession.waitForJob(jobId, timeoutMs + 2_000);
    const started = await runnerSession.request({
      requestId: randomUUID(), operation: "start-job", app, actionName, input,
      jobId, callId, traceId, timeoutMs,
    });
    if (!started.ok) throw new Error(`start-job failed: ${JSON.stringify(started.error)}`);
    return { jobId, callId, traceId, terminal, events: () => runnerSession.eventsForJob(jobId) };
  };
  const checks = ["list-actions", "host.kv", "storage-denied", "standard-wasi-http-network-denied"];
  const app = (id, component, options = {}) => ({ id, componentPath: path.join(componentsRoot, component, "service.wasm"), dataDirectory: path.join(workDirectory, id), ...options });
  const state = app("smoke-state", "nextclaw-portable-runtime-lab-state", { storageEnabled: true });
  const stateDenied = app("smoke-state-denied", "nextclaw-portable-runtime-lab-state");
  const capability = app("smoke-capability", "nextclaw-portable-runtime-lab-capabilities");
  const sqlite = app("smoke-sqlite", "nextclaw-portable-runtime-lab-sqlite", { storageEnabled: true });
  const sqliteIsolated = app("smoke-sqlite-isolated", "nextclaw-portable-runtime-lab-sqlite", { storageEnabled: true });
  const sqliteConcurrent = app("smoke-sqlite-concurrent", "nextclaw-portable-runtime-lab-sqlite", { storageEnabled: true });
  const sqliteDenied = app("smoke-sqlite-denied", "nextclaw-portable-runtime-lab-sqlite");
  const secretValue = "smoke-secret-value";
  const secretDigest = "fa8f6fd04cb1d822ad084f747ce6e19a928e0564a2df8a19d6562948c6f74d6b";
  const secretCapability = app("smoke-secret", "nextclaw-portable-runtime-lab-capabilities", {
    secretVariables: { nextclaw_secret_6170692d746f6b656e: secretValue },
    secretFingerprints: { "api-token": secretDigest },
  });
  const aiCapability = app("smoke-ai", "nextclaw-portable-runtime-lab-capabilities", {
    secretVariables: { nextclaw_secret_6170692d746f6b656e: secretValue },
    secretFingerprints: { "api-token": secretDigest },
  });
  const provider = app("nextclaw-portable-runtime-lab-provider", "nextclaw-portable-runtime-lab-provider", { storageEnabled: true });
  const composition = app("smoke-composition", "nextclaw-portable-runtime-lab-composition", { storageEnabled: true, allowedProviderIds: [provider.id] });
  const compositionDenied = app("smoke-composition-denied", "nextclaw-portable-runtime-lab-composition", { storageEnabled: true });
  const resident = app("smoke-resident", "nextclaw-portable-runtime-lab-resident", { storageEnabled: true });

  const mountedDirectory = path.join(workDirectory, "authorized-files");
  await mkdir(mountedDirectory, { recursive: true });
  await writeFile(path.join(mountedDirectory, "note.txt"), "portable filesystem grant", "utf8");
  const filesystemGranted = app("smoke-filesystem", "nextclaw-portable-runtime-lab-capabilities", {
    fileMounts: [{ hostPath: mountedDirectory, guestPath: "/documents/notes", writable: false }],
  });
  const filesystemDenied = app("smoke-filesystem-denied", "nextclaw-portable-runtime-lab-capabilities");

  const actions = await expectOk("list-actions", state);
  if (!actions.some(({ name }) => name === "record_upsert")) throw new Error(`state actions are incomplete: ${JSON.stringify(actions)}`);
  await expectOk("invoke", state, "counter_increment", { step: 3 });
  const stateRead = await expectOk("invoke", state, "counter_read");
  if (stateRead.counter !== 3 || stateRead.persistedBy !== "host.kv") throw new Error(`bad KV result: ${JSON.stringify(stateRead)}`);
  await expectError("invoke", stateDenied, "counter_read", undefined, "WASI_CAPABILITY_DENIED");
  const mountedRead = await expectOk("invoke", filesystemGranted, "filesystem_read", { path: "/documents/notes/note.txt" });
  if (mountedRead.content !== "portable filesystem grant" || mountedRead.mediatedBy !== "wasi.filesystem") {
    throw new Error(`filesystem preopen did not expose the authorized file: ${JSON.stringify(mountedRead)}`);
  }
  await expectError("invoke", filesystemDenied, "filesystem_read", { path: "/documents/notes/note.txt" }, "WASI_COMPONENT_FAILED");
  const filesystemRevoked = { ...filesystemGranted, fileMounts: [] };
  await expectError("invoke", filesystemRevoked, "filesystem_read", { path: "/documents/notes/note.txt" }, "WASI_COMPONENT_FAILED");
  checks.push("filesystem-preopen", "filesystem-isolation", "filesystem-revocation");
  const networkDenied = await expectOk("invoke", capability, "network_denied");
  if (!networkDenied.denied || !String(networkDenied.reason).includes("HttpRequestDenied")) throw new Error("standard WASI HTTP network policy was not observed");
  const sqliteActions = await expectOk("list-actions", sqlite);
  if (!sqliteActions.some(({ name }) => name === "sqlite_roundtrip")) throw new Error(`SQLite actions are incomplete: ${JSON.stringify(sqliteActions)}`);
  const sqliteWritten = await expectOk("invoke", sqlite, "sqlite_roundtrip", { key: "primary", value: "persisted" });
  if (sqliteWritten.value !== "persisted" || sqliteWritten.mediatedBy !== "fermyon:spin@2.0.0/sqlite") throw new Error(`standard Spin SQLite write/query failed: ${JSON.stringify(sqliteWritten)}`);
  const [sqlitePrimary, sqliteOther] = await Promise.all([
    expectOk("invoke", sqlite, "sqlite_roundtrip", { key: "same-key", value: "primary-value" }),
    expectOk("invoke", sqliteIsolated, "sqlite_roundtrip", { key: "same-key", value: "isolated-value" }),
  ]);
  if (sqlitePrimary.value !== "primary-value" || sqliteOther.value !== "isolated-value") throw new Error(`SQLite instance isolation write failed: ${JSON.stringify({ sqlitePrimary, sqliteOther })}`);
  const sqliteIsolationRead = await expectOk("invoke", sqlite, "sqlite_read", { key: "same-key" });
  if (sqliteIsolationRead.value !== "primary-value") throw new Error(`SQLite instance isolation failed: ${JSON.stringify(sqliteIsolationRead)}`);
  const [sqliteJobA, sqliteJobB] = await Promise.all([
    startJob(sqliteConcurrent, "sqlite_roundtrip", { key: "concurrent-a", value: "a" }),
    startJob(sqliteConcurrent, "sqlite_roundtrip", { key: "concurrent-b", value: "b" }),
  ]);
  const [sqliteTerminalA, sqliteTerminalB] = await Promise.all([
    sqliteJobA.terminal,
    sqliteJobB.terminal,
  ]);
  if (sqliteTerminalA.status !== "succeeded" || sqliteTerminalB.status !== "succeeded") {
    throw new Error(`SQLite concurrent jobs failed: ${JSON.stringify({ sqliteTerminalA, sqliteTerminalB })}`);
  }
  const [concurrentA, concurrentB] = await Promise.all([
    expectOk("invoke", sqliteConcurrent, "sqlite_read", { key: "concurrent-a" }),
    expectOk("invoke", sqliteConcurrent, "sqlite_read", { key: "concurrent-b" }),
  ]);
  if (concurrentA.value !== "a" || concurrentB.value !== "b") throw new Error(`SQLite concurrent writes lost data: ${JSON.stringify({ concurrentA, concurrentB })}`);
  const sqlitePermission = await expectOk("invoke", sqliteDenied, "sqlite_permission_denied");
  if (!sqlitePermission.denied || sqlitePermission.reason !== "access-denied") throw new Error(`SQLite permission denial was not observed: ${JSON.stringify(sqlitePermission)}`);
  checks.push("standard-spin-sqlite", "sqlite-instance-isolation", "sqlite-concurrency", "sqlite-denied");
  const secret = await expectOk("invoke", secretCapability, "secret_verify", { slot: "api-token", expectedSha256: secretDigest });
  if (!secret.available || !secret.matchesExpectedSha256 || secret.mediatedBy !== "wasi:config/store" || "sha256" in secret || JSON.stringify(secret).includes(secretValue)) throw new Error(`standard WASI Secret validation leaked or failed: ${JSON.stringify(secret)}`);
  const secretUnavailable = await expectError("invoke", capability, "secret_verify", { slot: "api-token" }, "WASI_COMPONENT_FAILED");
  if (JSON.stringify(secretUnavailable).includes(secretValue)) throw new Error("unresolved Secret leaked through runner error");
  const rotatedSecretValue = "smoke-rotated-secret-value";
  const rotatedSecretDigest = createHash("sha256").update(rotatedSecretValue).digest("hex");
  const rotatedSecretCapability = {
    ...secretCapability,
    secretVariables: { nextclaw_secret_6170692d746f6b656e: rotatedSecretValue },
    secretFingerprints: { "api-token": rotatedSecretDigest },
  };
  const rotatedSecret = await expectOk("invoke", rotatedSecretCapability, "secret_verify", { slot: "api-token", expectedSha256: rotatedSecretDigest });
  if (!rotatedSecret.matchesExpectedSha256 || JSON.stringify(rotatedSecret).includes(rotatedSecretValue)) {
    throw new Error(`Secret rotation failed or leaked: ${JSON.stringify(rotatedSecret)}`);
  }
  const revokedSecretCapability = { ...secretCapability, secretVariables: {}, secretFingerprints: {} };
  await expectError("invoke", revokedSecretCapability, "secret_verify", { slot: "api-token" }, "WASI_COMPONENT_FAILED");
  checks.push("standard-wasi-secret", "standard-wasi-secret-unresolved", "secret-rotation", "secret-revocation", "secret-no-leakage");

  const modelCallId = "smoke-model-call";
  const modelTraceId = "smoke-model-trace";
  const modelJob = await startJob(aiCapability, "model_complete", {
    slotId: "summary",
    messages: [{ role: "user", content: "Summarize this safely" }],
    maxTokens: 12,
  }, { callId: modelCallId, traceId: modelTraceId });
  const modelTerminal = await modelJob.terminal;
  if (modelTerminal.status !== "succeeded" || modelTerminal.result?.content !== "smoke-model-result") {
    throw new Error(`model host call failed: ${JSON.stringify(modelTerminal)}`);
  }
  const observedModelCall = aiHostCalls.at(-1);
  if (observedModelCall?.callId !== modelCallId || observedModelCall?.traceId !== modelTraceId || observedModelCall?.jobId !== modelJob.jobId) {
    throw new Error(`model correlation was not preserved: ${JSON.stringify(observedModelCall)}`);
  }
  checks.push("ai-model-complete");

  const agentJob = await startJob(aiCapability, "agent_start", {
    slotId: "review",
    input: { message: { role: "user", content: [{ type: "text", text: "Review this" }] } },
  });
  const agentTerminal = await agentJob.terminal;
  if (agentTerminal.status !== "succeeded" || agentTerminal.result?.handle?.runId !== "smoke-agent-run") {
    throw new Error(`agent host call failed: ${JSON.stringify(agentTerminal)}`);
  }
  checks.push("ai-agent-start");

  const deniedJob = await startJob(aiCapability, "model_complete", {
    slotId: "denied", messages: [{ role: "user", content: "deny" }],
  });
  const deniedTerminal = await deniedJob.terminal;
  if (deniedTerminal.status !== "failed" || !String(deniedTerminal.error?.code).includes("WASI_CAPABILITY_DENIED")) {
    throw new Error(`AI denial was not fail-closed: ${JSON.stringify(deniedTerminal)}`);
  }
  checks.push("ai-denied");

  const cancelJob = await startJob(aiCapability, "agent_start", {
    slotId: "hold", input: { message: { role: "user", content: [{ type: "text", text: "hold" }] } },
  }, { timeoutMs: 7_000 });
  // The host callback is intentionally held; cancellation must terminate only
  // this Job and release the outstanding host-call wait.
  await waitFor(() => typeof holdAgentHostCall === "function");
  const cancelled = await runnerSession.request({ requestId: randomUUID(), operation: "cancel-job", jobId: cancelJob.jobId });
  if (!cancelled.ok) throw new Error(`cancel-job failed: ${JSON.stringify(cancelled)}`);
  const cancelledTerminal = await cancelJob.terminal;
  holdAgentHostCall?.();
  if (cancelledTerminal.status !== "cancelled") throw new Error(`AI cancellation failed: ${JSON.stringify(cancelledTerminal)}`);
  const stateAfterCancellation = await expectOk("invoke", state, "counter_read");
  if (stateAfterCancellation.counter !== 3) throw new Error(`cancelled Job affected another app: ${JSON.stringify(stateAfterCancellation)}`);
  checks.push("ai-cancel", "job-cancel-isolated", "stream-cancel");

  if (JSON.stringify(aiHostCalls).includes(secretValue)) throw new Error("AI host-call transport leaked a Secret value");
  checks.push("ai-no-secret-leak");

  const observableJob = await startJob(capability, "long_task", {});
  const observableTerminal = await observableJob.terminal;
  const observableEvents = observableJob.events();
  const progressEvents = observableEvents.filter(({ kind }) => kind === "job-progress");
  const streamEvents = observableEvents.filter(({ kind }) => kind === "stream-chunk");
  if (observableTerminal.status !== "succeeded" || progressEvents.length !== 2 || streamEvents.length !== 2 ||
    observableEvents.some((event, index) => index > 0 && event.sequence <= observableEvents[index - 1].sequence)) {
    throw new Error(`Job progress/stream ordering failed: ${JSON.stringify(observableEvents)}`);
  }
  checks.push("job-progress");

  const timeoutJob = await startJob(capability, "simulate_timeout", {}, { timeoutMs: 25 });
  const timeoutTerminal = await timeoutJob.terminal;
  if (timeoutTerminal.status !== "timed-out" || timeoutTerminal.error?.code !== "PORTABLE_RUNTIME_TIMEOUT") {
    throw new Error(`Job timeout did not produce a terminal timeout: ${JSON.stringify(timeoutTerminal)}`);
  }
  const stateAfterTimeout = await expectOk("invoke", state, "counter_read");
  if (stateAfterTimeout.counter !== 3) throw new Error(`timed-out Job affected another app: ${JSON.stringify(stateAfterTimeout)}`);
  checks.push("job-timeout", "timeout-isolated");

  const overflowJob = await startJob(capability, "stream_overflow", {});
  const overflowTerminal = await overflowJob.terminal;
  if (overflowTerminal.status !== "failed" || !String(overflowTerminal.error?.message).includes("STREAM_BACKPRESSURE_TIMEOUT")) {
    throw new Error(`stream backpressure limit was not enforced: ${JSON.stringify(overflowTerminal)}`);
  }
  const stateAfterOverflow = await expectOk("invoke", state, "counter_read");
  if (stateAfterOverflow.counter !== 3) throw new Error(`stream overflow affected another app: ${JSON.stringify(stateAfterOverflow)}`);
  checks.push("stream-backpressure");

  const memoryJob = await startJob(capability, "memory_pressure", {}, { timeoutMs: 5_000 });
  const memoryTerminal = await memoryJob.terminal;
  if (memoryTerminal.status !== "failed") throw new Error(`memory limit was not enforced: ${JSON.stringify(memoryTerminal)}`);
  const stateAfterMemoryLimit = await expectOk("invoke", state, "counter_read");
  if (stateAfterMemoryLimit.counter !== 3) throw new Error(`memory-bound app affected another app: ${JSON.stringify(stateAfterMemoryLimit)}`);
  checks.push("memory-bound-isolated", "multi-app-isolation");

  if (process.env.NEXTCLAW_RUN_WASI_HTTP_E2E === "1") {
    const publicHttp = app("smoke-standard-http-public", "nextclaw-portable-runtime-lab-capabilities", { allowedDomains: ["1.1.1.1"] });
    const redirectHttp = app("smoke-standard-http-redirect", "nextclaw-portable-runtime-lab-capabilities", { allowedDomains: ["8.8.8.8"] });
    const loopbackHttp = app("smoke-standard-http-loopback", "nextclaw-portable-runtime-lab-capabilities", { allowedDomains: ["127.0.0.1"] });
    const allowed = await expectOk("invoke", publicHttp, "network_standard_http", { url: "https://1.1.1.1/cdn-cgi/trace" });
    if (allowed.status !== 200 || allowed.mediatedBy !== "wasi:http/outgoing-handler") throw new Error(`standard WASI HTTP allowed-host failed: ${JSON.stringify(allowed)}`);
    const loopback = await expectOk("invoke", loopbackHttp, "network_private_denied");
    if (!loopback.denied || !String(loopback.reason).includes("DestinationIpProhibited")) throw new Error(`standard WASI HTTP loopback policy failed: ${JSON.stringify(loopback)}`);
    const redirect = await expectOk("invoke", redirectHttp, "network_redirect_denied");
    if (redirect.initialStatus !== 302 || !redirect.denied || !String(redirect.reason).includes("HttpRequestDenied")) throw new Error(`standard WASI HTTP redirect policy failed: ${JSON.stringify(redirect)}`);
    const timeout = await expectError("invoke", publicHttp, "network_standard_http", { url: "https://1.1.1.1/cdn-cgi/trace", timeoutMs: 1 }, "WASI_COMPONENT_FAILED");
    if (!String(timeout.message).includes("ConnectionReadTimeout")) throw new Error(`standard WASI HTTP timeout policy failed: ${JSON.stringify(timeout)}`);
    const bodyLimit = await expectError("invoke", publicHttp, "network_standard_http", { url: "https://1.1.1.1/cdn-cgi/trace", maxResponseBytes: 16 }, "WASI_COMPONENT_FAILED");
    if (!String(bodyLimit.message).includes("HTTP_RESPONSE_TOO_LARGE")) throw new Error(`standard WASI HTTP response size policy failed: ${JSON.stringify(bodyLimit)}`);
    checks.push("standard-wasi-http-allowed-host", "standard-wasi-http-loopback", "standard-wasi-http-redirect-target", "standard-wasi-http-timeout", "standard-wasi-http-response-size");
  }

  const providerStart = await expectOk("start-provider", provider, undefined, {});
  if (providerStart.mode !== "provider") throw new Error(`provider did not start: ${JSON.stringify(providerStart)}`);
  const composed = await expectOk("invoke", composition, "compose_contact", { name: "  Ada Lovelace ", email: " ADA@EXAMPLE.COM ", tags: ["Work", "work"] });
  if (composed.provider.normalizedEmail !== "ada@example.com" || composed.provider.providerCallCount !== 1) throw new Error(`composition failed: ${JSON.stringify(composed)}`);
  const denied = await expectOk("invoke", compositionDenied, "provider_denied");
  if (!denied.denied || !String(denied.reason).includes("PROVIDER_DENIED")) throw new Error("provider denial was not observed");

  const coldResidentActions = await expectOk("list-actions", resident);
  if (coldResidentActions.length !== 4 || !coldResidentActions.some(({ name }) => name === "resident_status")) {
    throw new Error(`cold Resident action discovery failed: ${JSON.stringify(coldResidentActions)}`);
  }
  checks.push("resident-cold-list-actions");
  await expectOk("start-resident", resident, undefined, { eventIntervalMs: 1000 });
  const disposition = await expectOk("deliver-event", resident, undefined, { eventId: "smoke-1", kind: "verification", triggeredAt: "smoke" });
  if (disposition.disposition !== "ack" || disposition.abi !== "typed-0.2") {
    throw new Error(`typed Resident disposition failed: ${JSON.stringify(disposition)}`);
  }
  const retry = await expectOk("deliver-event", resident, undefined, { eventId: "retry-1", kind: "retry-once", triggeredAt: "smoke" });
  if (retry.disposition !== "retry" || retry.abi !== "typed-0.2") {
    throw new Error(`typed Resident retry disposition failed: ${JSON.stringify(retry)}`);
  }
  const retried = await expectOk("deliver-event", resident, undefined, { eventId: "retry-1", kind: "retry-once", triggeredAt: "smoke" });
  if (retried.disposition !== "ack" || retried.abi !== "typed-0.2") {
    throw new Error(`typed Resident retry acknowledgement failed: ${JSON.stringify(retried)}`);
  }
  const residentStatus = await expectOk("invoke", resident, "resident_status");
  // Actions run in their own Store; durable KV is the cross-lane fact while
  // the Resident's in-memory counter intentionally remains private.
  if (residentStatus.eventCount !== 2 || residentStatus.inMemoryEventCount !== 0) throw new Error(`resident state failed: ${JSON.stringify(residentStatus)}`);
  const beforeStop = await expectOk("stats");
  if (beforeStop.runnerPid !== runner.pid || beforeStop.providerInstances !== 1 || beforeStop.residentInstances !== 1) throw new Error(`bad stats: ${JSON.stringify(beforeStop)}`);
  await expectOk("stop", resident, undefined, { stoppedAt: "smoke" });
  await expectOk("stop", provider, undefined, { stoppedAt: "smoke" });
  const afterStop = await expectOk("stats");
  if (afterStop.runnerPid !== beforeStop.runnerPid || afterStop.providerInstances !== 0 || afterStop.residentInstances !== 0) throw new Error(`stop did not release instances: ${JSON.stringify(afterStop)}`);
  checks.push("provider", "composition", "provider-denied", "resident", "resident-typed-disposition", "resident-typed-retry", "stats-same-pid", "stop");
  await runnerSession.stop();
  const restartedSession = startRunnerSession(runnerPath);
  try {
    const restartedResponse = await restartedSession.request({
      requestId: randomUUID(),
      operation: "invoke",
      app: sqlite,
      actionName: "sqlite_read",
      input: { key: "primary" },
    });
    if (!restartedResponse.ok || restartedResponse.result?.value !== "persisted") {
      throw new Error(`SQLite restart persistence failed: ${JSON.stringify(restartedResponse)}`);
    }
  } finally {
    await restartedSession.stop();
  }
  checks.push("sqlite-restart-persistence");
  const summary = {
    schemaVersion: 1,
    kind: "nextclaw.portable-runtime.runner-smoke",
    ok: true,
    runner: runnerPath,
    checks,
    stats: afterStop,
  };
  const serialized = `${JSON.stringify(summary, null, 2)}\n`;
  if (outputPath) await writeFile(path.resolve(outputPath), serialized, "utf8");
  process.stdout.write(serialized);
} finally {
  await runnerSession.stop();
  await rm(workDirectory, { recursive: true, force: true });
}
