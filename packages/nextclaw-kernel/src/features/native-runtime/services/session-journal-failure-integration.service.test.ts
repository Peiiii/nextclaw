import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpEndpointEvent, type NcpLLMApi, type NcpTool } from "@nextclaw/ncp";
import { EventBus, Ingress, eventKeys } from "@nextclaw/shared";
import { AgentRunRequestManager } from "@kernel/managers/agent-run-request.manager.js";
import { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import { SessionManager } from "@kernel/managers/session.manager.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { createNativeAgentRuntimeRegistration } from "./native-agent-runtime.service.js";
import { SESSION_JOURNAL_FAILURE_SOURCE } from "@kernel/utils/session-journal-error.utils.js";
import { AgentRunClient } from "@kernel/services/agent-run-client.service.js";
import { resolveSessionProjectContext } from "@nextclaw/core";

const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map(path => rm(path, { force: true, recursive: true })));
});

async function fixture(directory: string, failure: "timer" | "terminal" | "none", toolScenario?: { models: NcpLLMApi; tools: NcpTool[] }) {
  const store = new NcpAgentSessionJournalStore(directory);
  const eventBus = new EventBus();
  const ingress = new Ingress();
  const events: Array<{ event: NcpEndpointEvent; source: string | undefined }> = [];
  eventBus.on(eventKeys.ncpEvent, (event, envelope) => events.push({ event, source: envelope.source }));
  const fault = Object.assign(new Error("fixture storage unavailable"), { code: "ENOSPC", errno: -28, syscall: "write", path: join(directory, "broken.jsonl") });
  let storageDown = false;
  let activeFailure = failure;
  const append = store.appendSessionEvent;
  vi.spyOn(store, "appendSessionEvent").mockImplementation(async params => {
    if (params.sessionId === "broken" && (storageDown || (activeFailure === "timer" && params.event.type === NcpEventType.MessageTextDelta)
      || (activeFailure === "terminal" && params.event.type === NcpEventType.MessageCompleted))) {
      storageDown = true;
      throw fault;
    }
    await append(params);
  });
  const sessions = new SessionManager({
    eventBus, journalStore: store, resolveProjectContext: resolveSessionProjectContext,
    agentContextWindowManager: { previewSession: async () => null, forgetSession: () => undefined } as never,
    agentManager: { resolveAgentProfile: () => ({ workspace: directory }) } as never,
    projectManager: { normalizeSessionProjectContext: async () => ({}) } as never,
    sessionSearch: { handleSessionUpdated: async () => undefined } as never,
  });
  await sessions.start();
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
    loadSessionRunSeed: sessions.loadSessionRunSeed, persistSessionEvent: sessions.persistSessionEvent,
    publishSessionEvent: sessions.publishSessionEvent, recoverSessionRun: sessions.recoverSessionRun,
  };
  const runs = new SessionRunManager(host);
  const modelAborted = vi.fn();
  const models: NcpLLMApi = { generate: async function* (_input, options) {
    yield { id: "reply", choices: [{ index: 0, delta: { role: "assistant", content: "verified answer" }, finish_reason: null }] };
    if (activeFailure === "timer" && options?.sessionId === "broken") {
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
  const native = createNativeAgentRuntimeRegistration({ models: toolScenario?.models ?? models, agents, config, sessions: host,
    compaction: { runPreflight: async function* () {}, runManual: async () => [] } });
  const disposeRuntime = vi.fn(async () => undefined);
  const runtimeManager = { disposeRuntime, getOrCreate: (params: Omit<Parameters<typeof native.createRuntime>[0], "entry">) =>
    native.createRuntime({ ...params, entry: { id: "native", type: "native", label: "Native", injectNextclawContext: true } }) };
  const requests = new AgentRunRequestManager(runtimeManager, agents, config,
    { resolveRunSurface: async () => ({ contextBlocks: [], tools: toolScenario?.tools ?? [] }) }, eventBus, ingress, host as never, runs);
  requests.start();
  return { store, sessions, requests, runs, modelAborted, disposeRuntime, events,
    restoreStorage: () => { activeFailure = "none"; storageDown = false; },
    client: new AgentRunClient({ eventBus, ingress }),
    close: () => { requests.dispose(); runs.dispose(); sessions.dispose(); store.close(); } };
}

describe("native runtime durable failure integration", () => {
  it.each(["archived", "new"] as const)("reads large diagnostics, writes a report and repeats after cold reopen for a %s session", async kind => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-tool-availability-"));
    directories.push(directory);
    const diagnostics = [...Array.from({ length: 39 }, (_, index) => `${index}: ${"diagnostic ".repeat(100)}`), "FEEDBACK_END_c293b7"];
    let expectedTail = "FEEDBACK_END_c293b7";
    await writeFile(join(directory, "diagnostics.json"), JSON.stringify(diagnostics));
    const calls: string[] = [];
    const scenario = () => {
      let round = 0;
      const models: NcpLLMApi = { generate: async function* (input) {
        const index = round++ % 3;
        if (index === 1) {
          const latestResult = input.messages.filter(message => message.role === "tool").at(-1)?.content;
          expect(latestResult).toContain(expectedTail);
        }
        if (index < 2) {
          yield { id: `reply-${round}`, choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{
            index: 0, id: `call-${round}`, type: "function", function: { name: index === 0 ? "read_file" : "write_file", arguments: "{}" },
          }] }, finish_reason: null }] };
          yield { id: `reply-${round}`, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] };
        } else yield { id: `reply-${round}`, choices: [{ index: 0, delta: { content: "REPORT_SAVED" }, finish_reason: "stop" }] };
      } };
      return { models, tools: ["read_file", "write_file"].map(name => ({ name, description: name,
        parameters: { type: "object", properties: {} }, execute: async () => {
          calls.push(name);
          if (name === "read_file") return JSON.parse(await readFile(join(directory, "diagnostics.json"), "utf8"));
          await writeFile(join(directory, "report.txt"), "REPORT_SAVED");
          return "saved";
        } })) };
    };
    const oldText = "old archived evidence ".repeat(5_000);
    const current = await fixture(directory, "none", scenario());
    if (kind === "archived") {
      const now = new Date().toISOString();
      await current.store.importSessionSnapshot({ sessionId: "tools", createdAt: now, updatedAt: now, metadata: {}, messages: [{
        id: "old-evidence", sessionId: "tools", role: "user", status: "final", timestamp: now,
        parts: [{ type: "text", text: oldText }],
      }] });
    }
    try {
      expect((await current.client.sendAndWaitForReply({ sessionId: "tools", content: [{ type: "text", text: "Read diagnostics and write the report." }] }, { abortSignal: AbortSignal.timeout(5000) })).text).toBe("REPORT_SAVED");
      await current.sessions.flushSessionEvents();
      expect(calls).toEqual(["read_file", "write_file"]);
    } finally { current.close(); }
    expectedTail = "COLD_FEEDBACK_END_d67e41";
    await writeFile(join(directory, "diagnostics.json"), JSON.stringify([...diagnostics.slice(0, -1), expectedTail]));
    const cold = await fixture(directory, "none", scenario());
    try {
      const history = (await cold.store.getSession("tools"))!.messages;
      if (kind === "archived") expect(history.find(message => message.id === "old-evidence")?.parts).toEqual([{ type: "text", text: oldText }]);
      expect(history.flatMap(message => message.parts).find(part => part.type === "tool-invocation" && part.toolName === "read_file")).toMatchObject({ result: diagnostics });
      expect((await cold.client.sendAndWaitForReply({ sessionId: "tools", content: [{ type: "text", text: "Read diagnostics again and update the report." }] }, { abortSignal: AbortSignal.timeout(5000) })).text).toBe("REPORT_SAVED");
      await cold.sessions.flushSessionEvents();
      expect(calls).toEqual(["read_file", "write_file", "read_file", "write_file"]);
      expect(await readFile(join(directory, "report.txt"), "utf8")).toBe("REPORT_SAVED");
      expect(cold.events.filter(({ event }) => event.type === NcpEventType.RunError)).toEqual([]);
    } finally { cold.close(); }
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("recovers one actor after real file permissions are restored and serializes concurrent new sends", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-native-real-permission-"));
    directories.push(directory);
    const current = await fixture(directory, "none");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const path = join(directory, "broken.jsonl");
    const now = new Date().toISOString();
    await current.store.importSessionSnapshot({ sessionId: "broken", createdAt: now, updatedAt: now, messages: [], metadata: {} });
    await chmod(path, 0o444);
    try {
      await expect(current.client.send({ sessionId: "broken", content: [{ type: "text", text: "not acknowledged" }] })).rejects.toThrow("EACCES");
      const actor = current.runs.getSessionRun("broken");
      expect(actor?.listPendingRequests()).toEqual([]);
      await expect(current.client.send({ sessionId: "broken", content: [{ type: "text", text: "still inaccessible" }] })).rejects.toThrow("EACCES");
      await chmod(path, 0o644);
      const replies = await Promise.all(["first retry", "second retry"].map(text =>
        current.client.sendAndWaitForReply({ sessionId: "broken", content: [{ type: "text", text }] }, { abortSignal: AbortSignal.timeout(5000) })));
      expect(replies.map(reply => reply.text)).toEqual(["verified answer", "verified answer"]);
      await vi.waitFor(() => expect(actor?.isBusy()).toBe(false));
      expect(current.runs.getSessionRun("broken")).toBe(actor);
      await chmod(path, 0o444);
      await expect(current.client.send({ sessionId: "broken", content: [{ type: "text", text: "second outage, not accepted" }] })).rejects.toThrow("EACCES");
      await chmod(path, 0o644);
      expect((await current.client.sendAndWaitForReply({ sessionId: "broken", content: [{ type: "text", text: "after second recovery" }] }, { abortSignal: AbortSignal.timeout(5000) })).text).toBe("verified answer");
      await vi.waitFor(() => expect(actor?.isBusy()).toBe(false));
      const entries = (await readFile(path, "utf8")).trim().split("\n").map(line => JSON.parse(line));
      expect(entries.filter(entry => entry.event?.payload?.metadata?.kind === "session_storage_recovery")).toHaveLength(2);
      expect(entries.filter(entry => entry.event?.type === NcpEventType.MessageCompleted)).toHaveLength(3);
      expect(JSON.stringify(entries)).not.toContain("not acknowledged");
      expect(JSON.stringify(entries)).not.toContain("still inaccessible");
      expect(JSON.stringify(entries)).not.toContain("second outage, not accepted");
    } finally { await chmod(path, 0o644); current.close(); }
    const cold = await fixture(directory, "none");
    try { expect((await cold.store.getSession("broken"))?.messages.filter(message => message.role === "user")).toHaveLength(3); }
    finally { cold.close(); }
  });

  it("waits for the failed runtime to exit, retains queued input and resumes without restarting", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-native-recover-live-"));
    directories.push(directory);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const current = await fixture(directory, "timer");
    let release!: () => void;
    const cleanup = new Promise<void>(resolve => { release = resolve; });
    current.disposeRuntime.mockImplementationOnce(() => cleanup);
    try {
      const execution = await current.client.startRun({ sessionId: "broken", content: [{ type: "text", text: "initial interrupted input" }] }, { abortSignal: AbortSignal.timeout(5000) });
      await vi.waitFor(() => expect(current.events.some(({ event }) => event.type === NcpEventType.MessageTextDelta)).toBe(true));
      const queued = await current.client.send({ sessionId: "broken", content: [{ type: "text", text: "accepted queued input" }] });
      await expect(execution.result).rejects.toThrow("ENOSPC");
      await vi.waitFor(() => expect(current.disposeRuntime).toHaveBeenCalledOnce());
      const actor = current.runs.getSessionRun("broken");
      expect(actor?.listQueuedRequests()).toMatchObject([{ request: { message: { id: queued.userMessageId } } }]);
      current.restoreStorage();
      const retry = current.client.sendAndWaitForReply({ sessionId: "broken", content: [{ type: "text", text: "continue after storage restored" }] }, { abortSignal: AbortSignal.timeout(5000) });
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(current.events.filter(({ event }) => event.type === NcpEventType.MessageSent && event.payload.message.role === "user")).toHaveLength(1);
      release();
      expect((await retry).text).toBe("verified answer");
      await vi.waitFor(() => expect(actor?.isBusy()).toBe(false));
      expect(current.runs.getSessionRun("broken")).toBe(actor);
      const users = current.events.filter(({ event }) => event.type === NcpEventType.MessageSent && event.payload.message.role === "user");
      expect(users.map(({ event }) => event.type === NcpEventType.MessageSent ? event.payload.message.parts : [])).toEqual([
        [{ type: "text", text: "initial interrupted input" }], [{ type: "text", text: "accepted queued input" }], [{ type: "text", text: "continue after storage restored" }],
      ]);
      expect(actor?.listPendingRequests()).toEqual([]);
      await current.sessions.flushSessionEvents();
    } finally { release(); current.close(); }
    const cold = await fixture(directory, "none");
    try {
      const history = (await cold.store.getSession("broken"))!.messages;
      expect(history.filter(message => message.role === "user")).toHaveLength(3);
      const journal = (await readFile(join(directory, "broken.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
      expect(journal.filter(entry => entry.event?.type === NcpEventType.MessageCompleted)).toHaveLength(2);
      expect(history.filter(message => message.role === "assistant" && JSON.stringify(message.parts).includes("verified answer"))).toHaveLength(2);
    } finally { cold.close(); }
  });

  it.each([NcpEventType.MessageCompleted, NcpEventType.RunFinished])("does not invent an interrupted run after a committed %s catalog failure", async type => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-native-terminal-catalog-"));
    directories.push(directory);
    const current = await fixture(directory, "none");
    const catalog = (current.store as unknown as { summaryIndexStore: { upsertForEvent: (...args: unknown[]) => Promise<void> } }).summaryIndexStore;
    const original = catalog.upsertForEvent;
    const fault = vi.spyOn(catalog, "upsertForEvent").mockImplementation(async (...args) => {
      if ((args[0] as { event: NcpEndpointEvent }).event.type === type) throw Object.assign(new Error("terminal catalog busy"), { code: "SQLITE_BUSY" });
      await original(...args);
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect((await current.client.sendAndWaitForReply({ sessionId: "broken", content: [{ type: "text", text: "finish durably" }] }, { abortSignal: AbortSignal.timeout(3000) })).text).toBe("verified answer");
      await current.sessions.flushSessionEvents();
      expect(await current.store.listUnfinishedRuns()).toEqual([]);
    } finally { fault.mockRestore(); current.close(); }
    const cold = await fixture(directory, "none");
    try {
      expect(cold.events.filter(({ event }) => event.type === NcpEventType.RunError)).toEqual([]);
      expect(JSON.stringify((await cold.store.getSession("broken"))?.messages)).toContain("verified answer");
    } finally { cold.close(); }
  });

  it("finishes real client runs across a committed catalog failure and cold restart", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-native-catalog-fault-"));
    directories.push(directory);
    const current = await fixture(directory, "none");
    const catalog = (current.store as unknown as { summaryIndexStore: { upsertForEvent: (...args: unknown[]) => Promise<void> } }).summaryIndexStore;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fault = vi.spyOn(catalog, "upsertForEvent").mockRejectedValueOnce(Object.assign(new Error("catalog temporarily busy"), { code: "SQLITE_BUSY" }));
    try {
      const reply = await current.client.sendAndWaitForReply({ sessionId: "broken", content: [{ type: "text", text: "reply through catalog failure" }] }, { abortSignal: AbortSignal.timeout(3000) });
      expect(reply.text).toBe("verified answer");
      expect(warn).toHaveBeenCalledOnce();
      expect(current.events.filter(({ source }) => source === SESSION_JOURNAL_FAILURE_SOURCE)).toEqual([]);
      expect(current.modelAborted).not.toHaveBeenCalled();
      expect((await current.client.sendAndWaitForReply({ sessionId: "broken", content: [{ type: "text", text: "continue normally" }] }, { abortSignal: AbortSignal.timeout(3000) })).text).toBe("verified answer");
    } finally { fault.mockRestore(); current.close(); }
    const cold = await fixture(directory, "none");
    try {
      expect(JSON.stringify((await cold.store.getSession("broken"))?.messages)).toContain("reply through catalog failure");
      expect((await cold.client.sendAndWaitForReply({ sessionId: "broken", content: [{ type: "text", text: "after cold restart" }] }, { abortSignal: AbortSignal.timeout(3000) })).text).toBe("verified answer");
    } finally { cold.close(); }
  });

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
      expect(current.runs.getSessionRun("broken")?.isBusy()).toBe(failure === "timer");
      expect(current.runs.getSessionRun("broken")?.listPendingRequests()).toHaveLength(failure === "timer" ? 1 : 0);
      if (failure === "timer") expect(current.modelAborted).toHaveBeenCalledOnce();
      expect(current.events.filter(({ source }) => source === SESSION_JOURNAL_FAILURE_SOURCE)).toHaveLength(1);
      expect(logged).toHaveBeenCalledOnce();
      await expect(current.client.send({ sessionId: "broken", content: [{ type: "text", text: "must reject a new run" }] })).rejects.toMatchObject({ code: "ENOSPC" });
      expect(current.runs.getSessionRun("broken")?.listPendingRequests()).toHaveLength(failure === "timer" ? 1 : 0);
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
