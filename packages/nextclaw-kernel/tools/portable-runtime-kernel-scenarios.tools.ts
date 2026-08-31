/**
 * Portable Runtime's host-mediated contracts are owned by Kernel, rather than
 * by a particular WASI guest.  This producer exercises the durable Kernel
 * services directly and emits named checks only after their user-observable
 * invariants have been asserted.  It is intentionally not a wrapper around a
 * unit-test exit code: the JSON is the concrete CI evidence input.
 */
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AppStorageContext } from "@nextclaw/app-runtime";
import type { CapabilityProviderView } from "@kernel/types/app-package.types.js";
import { AppPackageDependencyService } from "@kernel/services/app-package-dependency.service.js";
import { ServiceAppJobJournalService } from "@kernel/services/service-app-job-journal.service.js";
import { ServiceAppResidentEventInboxService } from "@kernel/services/service-app-resident-event-inbox.service.js";

const CHECKS = [
  "event-dedupe",
  "event-cursor-order",
  "job-recovery",
  "stream-disconnect-limit",
  "provider-version-incompatible",
] as const;

async function main(): Promise<void> {
  const output = required("--output");
  const directory = await mkdtemp(path.join(tmpdir(), "nextclaw-portable-kernel-scenarios-"));
  const startedAt = new Date().toISOString();
  try {
    const event = await verifyEventJournal(path.join(directory, "events"));
    const jobs = await verifyJobJournal(path.join(directory, "jobs"));
    const component = await verifyIncompatibleProvider(path.join(directory, "component"));
    await writeJson(output, {
      schemaVersion: 1,
      kind: "nextclaw.portable-runtime.kernel-scenarios",
      ok: true,
      checks: [...CHECKS],
      startedAt,
      finishedAt: new Date().toISOString(),
      observations: { event, jobs, component },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function verifyEventJournal(stateDirectory: string): Promise<Record<string, unknown>> {
  const scope = {
    appId: "nextclaw.portable-runtime-kernel-scenarios",
    instanceId: "events",
    stateDirectory,
  };
  const inbox = new ServiceAppResidentEventInboxService();
  const first = await inbox.enqueue(scope, { eventId: "event-1", streamKey: "portable", payload: { value: 1 } });
  const second = await inbox.enqueue(scope, { eventId: "event-2", streamKey: "portable", payload: { value: 2 } });
  const duplicate = await inbox.enqueue(scope, { eventId: "event-1", streamKey: "different-stream", payload: { value: 999 } });
  assert(first.id === duplicate.id && first.sequence === 1 && duplicate.streamKey === "portable", "event dedupe must retain the original durable event.");
  assert(second.sequence === 2, "new events in a stream must receive monotonic cursors.");

  const leasedFirst = await inbox.leaseNext(scope);
  assert(leasedFirst?.eventId === "event-1" && leasedFirst.sequence === 1, "first lease must preserve stream order.");
  await inbox.acknowledge(scope, "event-1");
  const leasedSecond = await inbox.leaseNext(scope);
  assert(leasedSecond?.eventId === "event-2" && leasedSecond.sequence === 2, "second event must not overtake the first.");
  await inbox.acknowledge(scope, "event-2");

  // Reopen the persisted inbox: both dedupe and cursor order must survive the
  // host-memory boundary that a Resident restart crosses.
  const reopened = new ServiceAppResidentEventInboxService();
  const listed = await reopened.list(scope);
  assert(listed.entries.length === 2 && listed.entries.every((entry) => entry.status === "acked"), "acked event facts must persist.");
  assert(listed.cursors.portable === 2 && listed.entries.map((entry) => entry.sequence).join(",") === "1,2", "persisted event cursor order is invalid.");
  return { entries: listed.entries.length, cursor: listed.cursors.portable };
}

async function verifyJobJournal(stateDirectory: string): Promise<Record<string, unknown>> {
  const scope = {
    appId: "nextclaw.portable-runtime-kernel-scenarios",
    instanceId: "jobs",
    stateDirectory,
  };
  const journal = new ServiceAppJobJournalService();
  const recovery = await journal.queue(scope, {
    jobId: "restart-job",
    actionName: "durable-work",
    callId: "restart-call",
    traceId: "restart-trace",
  });
  await journal.transition(scope, recovery.id, "starting");
  await journal.transition(scope, recovery.id, "running");
  const restarted = new ServiceAppJobJournalService();
  await restarted.recoverUnfinished([scope]);
  const recovered = await restarted.get(scope, recovery.id);
  assert(recovered.status === "interrupted" && recovered.error?.code === "HOST_RESTARTED", "in-flight job was not marked interrupted after restart.");

  const stream = await restarted.queue(scope, {
    jobId: "stream-job",
    actionName: "streaming-work",
    callId: "stream-call",
    traceId: "stream-trace",
  });
  await restarted.transition(scope, stream.id, "starting");
  await restarted.transition(scope, stream.id, "running");
  for (let index = 1; index <= 257; index += 1) await restarted.emitChunk(scope, stream.id, `chunk-${index}`);
  let expired = false;
  try {
    await new ServiceAppJobJournalService().watch(scope, stream.id, 0);
  } catch (error) {
    expired = typeof error === "object" && error !== null && (error as { code?: unknown }).code === "STREAM_CURSOR_EXPIRED";
  }
  assert(expired, "a disconnected stream behind the retained window must receive STREAM_CURSOR_EXPIRED.");
  const resumable = await new ServiceAppJobJournalService().watch(scope, stream.id, 1);
  assert(resumable.events.length === 256 && resumable.events[0]?.sequence === 2 && resumable.cursor === 257, "a retained disconnect cursor must replay the exact bounded stream window.");
  await restarted.recordTerminal(scope, stream.id, { status: "succeeded" });
  return { recoveredStatus: recovered.status, retainedEvents: resumable.events.length, newestCursor: resumable.cursor };
}

async function verifyIncompatibleProvider(directory: string): Promise<Record<string, unknown>> {
  const componentDirectory = path.join(directory, "consumer-service");
  await mkdir(componentDirectory, { recursive: true });
  await writeFile(path.join(componentDirectory, "service-app.json"), `${JSON.stringify({
    id: "consumer-service",
    title: "Consumer",
    protocol: "wasi-component",
    component: { entry: "service.wasm" },
    requires: {
      capabilities: [{
        id: "shared-cache",
        version: "1",
        wit: { package: "nextclaw:shared-cache", interface: "cache", version: "^1.1.0" },
      }],
    },
    actions: { use_cache: { risk: "read" } },
  }, null, 2)}\n`, "utf8");
  const storage = storageFor(directory);
  const target = {
    appId: "consumer-app",
    storage,
    components: [{ id: "consumer-service", kind: "service" as const, componentDirectory }],
  };
  const incompatible: CapabilityProviderView = {
    providerId: "incompatible-provider",
    appId: "provider-app",
    componentId: "shared-cache-provider",
    capabilities: [{
      id: "shared-cache",
      version: "1",
      wit: { package: "nextclaw:shared-cache", interface: "cache", version: "1.0.0" },
    }],
  };
  const service = new AppPackageDependencyService();
  const inspected = await service.inspect({ target, providers: [incompatible] });
  assert(inspected.readiness.status === "needs-capability" && inspected.diagnostics.some((entry) => entry.code === "CAPABILITY_WIT_INCOMPATIBLE"), "incompatible provider version must be visible before binding.");
  let rejected = false;
  try {
    await service.bind({
      target,
      providers: [incompatible],
      input: { componentId: "consumer-service", requirementKind: "capability", requirementId: "shared-cache@1", providerId: incompatible.providerId },
    });
  } catch (error) {
    rejected = typeof error === "object" && error !== null && (error as { code?: unknown }).code === "APP_PACKAGE_DEPENDENCY_INCOMPATIBLE";
  }
  assert(rejected, "incompatible provider binding must fail with APP_PACKAGE_DEPENDENCY_INCOMPATIBLE.");
  return { diagnostic: "CAPABILITY_WIT_INCOMPATIBLE", bindRejected: rejected };
}

function storageFor(directory: string): AppStorageContext {
  const instanceDirectory = path.join(directory, "instance");
  return {
    layout: "instance-v1",
    layoutVersion: 1,
    instanceId: "default",
    instanceDirectory,
    dataDirectory: path.join(instanceDirectory, "data"),
    configDirectory: path.join(instanceDirectory, "config"),
    stateDirectory: path.join(instanceDirectory, "state"),
    cacheDirectory: path.join(instanceDirectory, "cache"),
    temporaryDirectory: path.join(instanceDirectory, "tmp"),
    logsDirectory: path.join(instanceDirectory, "logs"),
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function required(flag: string): string {
  const index = process.argv.indexOf(flag);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`${flag} is required.`);
  return value;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

await main();
