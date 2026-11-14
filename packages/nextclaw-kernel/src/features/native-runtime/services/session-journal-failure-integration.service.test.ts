import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpEndpointEvent, type NcpLLMApi } from "@nextclaw/ncp";
import { EventBus, Ingress, eventKeys } from "@nextclaw/shared";
import { AgentRunRequestManager } from "@kernel/managers/agent-run-request.manager.js";
import { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { createNativeAgentRuntimeRegistration } from "./native-agent-runtime.service.js";
import { SESSION_JOURNAL_FAILURE_SOURCE } from "@kernel/utils/session-journal-error.utils.js";
import { AgentRunClient } from "@kernel/services/agent-run-client.service.js";
import { SessionEventCoordinatorService } from "@kernel/services/session-event-coordinator.service.js";

const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map(path => rm(path, { force: true, recursive: true })));
});

async function fixture(directory: string, failure: "timer" | "terminal" | "none") {
  const store = new NcpAgentSessionJournalStore(directory);
  const eventBus = new EventBus();
  const ingress = new Ingress();
  const events: Array<{ event: NcpEndpointEvent; source: string | undefined }> = [];
  eventBus.on(eventKeys.ncpEvent, (event, envelope) => events.push({ event, source: envelope.source }));
  const fault = Object.assign(new Error("fixture storage unavailable"), { code: "ENOSPC", errno: -28, syscall: "write", path: join(directory, "broken.jsonl") });
  const coordinator = new SessionEventCoordinatorService({
    eventBus, journalStore: store, getSessionRecord: store.getSession,
    listUnfinishedRuns: store.listUnfinishedRuns,
    updateSessionMetadata: (sessionId, metadata) => store.setSessionMetadata({ sessionId, metadata }),
    appendSessionEvent: async params => {
      if (params.sessionId === "broken" && ((failure === "timer" && params.event.type === NcpEventType.MessageTextDelta)
        || (failure === "terminal" && params.event.type === NcpEventType.MessageCompleted))) throw fault;
      await store.appendSessionEvent(params);
    },
  });
  await coordinator.start();
  const session = (sessionId: string) => ({ sessionId, agentId: "main", agentRuntimeId: "native", model: "fixture-model", metadata: {}, workingDir: directory });
  const host = {
    getOrCreateAgentRunSession: async (params: { sessionId?: string }) => {
      const id = params.sessionId ?? "broken";
      if (!await store.hasSession(id)) {
        const timestamp = new Date().toISOString();
        await store.importSessionSnapshot({ sessionId: id, messages: [], metadata: {}, createdAt: timestamp, updatedAt: timestamp });
      }
      return session(id);
    },
    getAgentRunSession: async (id: string) => session(id),
    getSessionRecord: store.getSession, listSessionMessages: store.listSessionMessages,
    loadSessionRunSeed: store.loadSessionRunSeed, persistSessionEvent: coordinator.persist,
    publishSessionEvent: coordinator.publish,
  };
  const runs = new SessionRunManager(host);
  const modelAborted = vi.fn();
  const models: NcpLLMApi = { generate: async function* (_input, options) {
    yield { id: "reply", choices: [{ index: 0, delta: { role: "assistant", content: "verified answer" }, finish_reason: null }] };
    if (failure === "timer" && options?.sessionId === "broken") {
      await new Promise<void>(resolve => {
        if (options.signal?.aborted) resolve();
        else options.signal?.addEventListener("abort", () => { modelAborted(); resolve(); }, { once: true });
      });
      throw options.signal?.reason;
    }
    yield { id: "reply", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] };
  } };
  const agents = { getDefaultAgentId: () => "main", resolveAgentProfile: () => ({ contextTokens: 200_000, reservedContextTokens: 10_000 }) };
  const config = { getDefaultModel: () => "fixture-model", getModelMaxTokens: () => 4096 };
  const native = createNativeAgentRuntimeRegistration({ models, agents, config, sessions: host,
    compaction: { runPreflight: async function* () {}, runManual: async () => [] } });
  const disposeRuntime = vi.fn(async () => undefined);
  const runtimeManager = { disposeRuntime, getOrCreate: (params: Omit<Parameters<typeof native.createRuntime>[0], "entry">) =>
    native.createRuntime({ ...params, entry: { id: "native", type: "native", label: "Native", injectNextclawContext: true } }) };
  const requests = new AgentRunRequestManager(runtimeManager, agents, config,
    { resolveRunSurface: async () => ({ contextBlocks: [], tools: [] }) }, eventBus, ingress, host as never, runs);
  requests.start();
  return { store, coordinator, requests, runs, modelAborted, disposeRuntime, events,
    client: new AgentRunClient({ eventBus, ingress }),
    close: () => { requests.dispose(); runs.dispose(); coordinator.dispose(); store.close(); } };
}

describe("native runtime durable failure integration", () => {
  it.each(["timer", "terminal"] as const)("stops %s failures, notifies the actual client and preserves sessions across cold restart", async failure => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-native-journal-fault-"));
    directories.push(directory);
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const current = await fixture(directory, failure);
    try {
      const execution = await current.client.startRun({ sessionId: "broken", content: [{ type: "text", text: "must remain recoverable" }] }, { abortSignal: AbortSignal.timeout(3000) });
      if (failure === "timer") {
        await vi.waitFor(() => expect(current.events.some(({ event }) => event.type === NcpEventType.MessageTextDelta)).toBe(true));
        await current.client.send({ sessionId: "broken", content: [{ type: "text", text: "queued input" }] });
      }
      await expect(execution.result).rejects.toThrow("ENOSPC");
      await vi.waitFor(() => expect(current.disposeRuntime).toHaveBeenCalled());
      expect(current.runs.getSessionRun("broken")?.isBusy()).toBe(false);
      expect(current.runs.getSessionRun("broken")?.listPendingRequests()).toEqual([]);
      if (failure === "timer") expect(current.modelAborted).toHaveBeenCalledOnce();
      expect(current.events.filter(({ source }) => source === SESSION_JOURNAL_FAILURE_SOURCE)).toHaveLength(1);
      expect(logged).toHaveBeenCalledOnce();
      await expect(current.client.send({ sessionId: "broken", content: [{ type: "text", text: "must reject a new run" }] })).rejects.toMatchObject({ code: "SESSION_JOURNAL_WRITE_FAILED" });
      const healthy = await current.client.sendAndWaitForReply({ sessionId: "healthy", content: [{ type: "text", text: "another session" }] }, { abortSignal: AbortSignal.timeout(3000) });
      expect(healthy.text).toBe("verified answer");
      const journal = (await readFile(join(directory, "healthy.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
      expect(journal.filter(value => value.event?.type === NcpEventType.MessageCompleted)).toHaveLength(1);
    } finally { current.close(); }
    const cold = await fixture(directory, "none");
    try {
      expect((await cold.store.listSessionSummaries()).map(value => value.sessionId)).toEqual(expect.arrayContaining(["broken", "healthy"]));
      const original = await cold.store.getSession("broken");
      expect(JSON.stringify(original?.messages)).toContain("must remain recoverable");
      const reply = await cold.client.sendAndWaitForReply({ sessionId: "broken", content: [{ type: "text", text: "after recovery" }] }, { abortSignal: AbortSignal.timeout(3000) });
      expect(reply.text).toBe("verified answer");
      expect(JSON.stringify((await cold.store.getSession("broken"))?.messages)).toContain("after recovery");
    } finally { cold.close(); }
  });
});
