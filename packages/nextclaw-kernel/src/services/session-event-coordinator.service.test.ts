import { chmod, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpEndpointEvent, type NcpMessage } from "@nextclaw/ncp";
import { EventBus, eventKeys } from "@nextclaw/shared";
import { FileLogSink, LoggingRuntime } from "@nextclaw/core";
import { SessionRun } from "@kernel/managers/session-run.manager.js";
import { AgentRunContextCompactionManager } from "@kernel/managers/agent-run-context-compaction.manager.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { SessionEventCoordinatorService } from "./session-event-coordinator.service.js";

const sessionId = "journal-failure";
const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

function message(id: string): NcpMessage {
  return { id, sessionId, role: "assistant", status: "final", timestamp: "2026-11-14T00:00:00.000Z", parts: [{ type: "text", text: id }] };
}

function sent(id: string): NcpEndpointEvent {
  return { type: NcpEventType.MessageSent, payload: { sessionId, message: message(id) } };
}

describe("session journal failure boundaries", () => {
  it("retains the parse cause when a cold catalog rebuild skips an unreadable session", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-cold-read-diagnostic-"));
    directories.push(directory);
    const store = new NcpAgentSessionJournalStore(directory);
    for (const id of [sessionId, "healthy"]) await store.importSessionSnapshot({ sessionId: id, messages: [{ ...message("saved"), sessionId: id }], metadata: {},
      createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z" });
    store.close();
    const metadataPath = join(directory, `${sessionId}.metadata.json`);
    await writeFile(metadataPath, '{"_type":"metadata","metadata":');
    await rm(join(directory, ".ncp-agent-session-catalog.sqlite"));
    const sink = new FileLogSink({ serviceLogPath: join(directory, "logs/service.log"),
      crashLogPath: join(directory, "logs/crash.log"), archiveDirPath: join(directory, "logs/archive") });
    vi.spyOn(console, "warn").mockImplementation(new LoggingRuntime({ sink }).getLogger("console").warn);
    const cold = new NcpAgentSessionJournalStore(directory);
    try {
      await cold.initialize();
      expect((await cold.listSessionSummaries()).map(value => value.sessionId)).toContain("healthy");
      const record = sink.query({ event: "session.persistence.read_failed" }).records[0];
      expect(record.context).toMatchObject({ operation: "metadata.read", stage: "parse", path: metadataPath });
      expect(record.error).toMatchObject({ name: "SyntaxError" });
      expect(await readFile(metadataPath, "utf8")).toBe('{"_type":"metadata","metadata":');
    } finally { cold.close(); }
  });

  it("identifies a real metadata JSON parse failure while keeping the valid journal usable", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-metadata-parse-diagnostic-"));
    directories.push(directory);
    const sink = new FileLogSink({ serviceLogPath: join(directory, "logs/service.log"),
      crashLogPath: join(directory, "logs/crash.log"), archiveDirPath: join(directory, "logs/archive") });
    vi.spyOn(console, "warn").mockImplementation(new LoggingRuntime({ sink }).getLogger("console").warn);
    const store = new NcpAgentSessionJournalStore(directory);
    await store.importSessionSnapshot({ sessionId, messages: [message("saved")], metadata: {},
      createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z" });
    const path = join(directory, `${sessionId}.metadata.json`);
    const original = await readFile(path);
    const coordinator = new SessionEventCoordinatorService({ eventBus: new EventBus(), journalStore: store,
      appendSessionEvent: store.appendSessionEvent, getSessionRecord: store.getSession,
      listUnfinishedRuns: async () => [], updateSessionMetadata: (id, patch) => store.setSessionMetadata({ sessionId: id, metadata: patch }) });
    try {
      await writeFile(path, '{"_type":"metadata","metadata":');
      await expect(coordinator.persist({ type: NcpEventType.RunStarted, payload: { sessionId, runId: "parse-run" } })).resolves.toBeUndefined();
      const record = sink.query({ event: "session.persistence.projection_failed" }).records[0];
      expect(record.context).toMatchObject({ projection: "activity-preview", operation: "metadata.read", stage: "parse", path, journalCommitted: true });
      expect(record.error).toMatchObject({ name: "SyntaxError" });
      await writeFile(path, original);
      await expect(coordinator.persist(sent("continue"))).resolves.toBeUndefined();
      expect((await store.getSession(sessionId))?.messages.map(value => value.id)).toEqual(["saved", "continue"]);
    } finally { await writeFile(path, original); coordinator.dispose(); store.close(); }
  });

  it("does not reject committed business metadata when its catalog projection fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-metadata-catalog-failure-"));
    directories.push(directory);
    const store = new NcpAgentSessionJournalStore(directory);
    await store.importSessionSnapshot({ sessionId, messages: [message("saved")], metadata: {},
      createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z" });
    const catalog = (store as unknown as { summaryIndexStore: { upsert: (...args: unknown[]) => Promise<void> } }).summaryIndexStore;
    vi.spyOn(catalog, "upsert").mockRejectedValueOnce(Object.assign(new Error("metadata catalog busy"), { code: "SQLITE_BUSY" }));
    const coordinator = new SessionEventCoordinatorService({ eventBus: new EventBus(), journalStore: store,
      appendSessionEvent: store.appendSessionEvent, getSessionRecord: store.getSession,
      listUnfinishedRuns: async () => [], updateSessionMetadata: (id, patch) => store.setSessionMetadata({ sessionId: id, metadata: patch }) });
    try {
      await expect(coordinator.persist({ type: NcpEventType.RunMetadata, payload: { sessionId,
        metadata: { kind: "session_metadata_patch", sessionMetadataPatch: { fixture: "saved" } } } })).resolves.toBeUndefined();
      expect((await store.getSession(sessionId))?.metadata).toMatchObject({ fixture: "saved" });
      await expect(coordinator.persist(sent("continue"))).resolves.toBeUndefined();
    } finally { coordinator.dispose(); store.close(); }
  });

  it("persists one queryable transaction failure with the actual cause and rollback outcome", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-persisted-diagnostic-"));
    directories.push(directory);
    const sink = new FileLogSink({ serviceLogPath: join(directory, "logs/service.log"),
      crashLogPath: join(directory, "logs/crash.log"), archiveDirPath: join(directory, "logs/archive") });
    const logger = new LoggingRuntime({ sink, startupId: "journal-diagnostic", pid: 123 }).getLogger("console");
    vi.spyOn(console, "error").mockImplementation(logger.error);
    const store = new NcpAgentSessionJournalStore(directory);
    await store.importSessionSnapshot({ sessionId, messages: [message("saved")], metadata: {},
      createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z" });
    const coordinator = new SessionEventCoordinatorService({ eventBus: new EventBus(), journalStore: store,
      appendSessionEvent: store.appendSessionEvent, getSessionRecord: store.getSession,
      listUnfinishedRuns: async () => [], updateSessionMetadata: (id, patch) => store.setSessionMetadata({ sessionId: id, metadata: patch }) });
    const bad = sent("bad-json-value");
    if (bad.type === NcpEventType.MessageSent) bad.payload.message.metadata = { unsupported: BigInt(42), privateValue: "must-not-log-this-value" };
    try {
      await expect(coordinator.persist(bad)).rejects.toMatchObject({ code: "SESSION_JOURNAL_WRITE_FAILED" });
      for (let index = 0; index < 20; index++) await coordinator.persist(sent(`later-${index}`)).catch(() => undefined);
      const records = sink.query({ event: "session.persistence.failed" }).records;
      expect(records).toHaveLength(1);
      expect(records[0]?.context).toMatchObject({ sessionId, operation: "journal.append", stage: "serialize",
        rollback: "succeeded", journalCommitted: false, previousOffset: expect.any(Number), seq: expect.any(Number) });
      expect(records[0]?.error?.cause?.cause).toMatchObject({ name: "TypeError", message: expect.stringContaining("BigInt") });
      expect(await readFile(join(directory, "logs/service.log"), "utf8")).not.toContain("must-not-log-this-value");
      expect((await store.getSession(sessionId))?.messages.map(value => value.id)).toEqual(["saved"]);
    } finally { coordinator.dispose(); store.close(); }
  });

  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("continues after a real metadata read failure in the activity preview", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-preview-failure-"));
    directories.push(directory);
    const store = new NcpAgentSessionJournalStore(directory);
    await store.importSessionSnapshot({ sessionId, messages: [message("saved")], metadata: {},
      createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z" });
    const metadata = join(directory, `${sessionId}.metadata.json`);
    const original = await readFile(metadata);
    const coordinator = new SessionEventCoordinatorService({ eventBus: new EventBus(), journalStore: store,
      appendSessionEvent: store.appendSessionEvent, getSessionRecord: store.getSession,
      listUnfinishedRuns: async () => [], updateSessionMetadata: (id, patch) => store.setSessionMetadata({ sessionId: id, metadata: patch }) });
    const actor = new SessionRun({ sessionId, messages: [message("saved")] }, undefined, undefined, coordinator.persist);
    try {
      await chmod(metadata, 0);
      await expect(actor.applyEvents([{ type: NcpEventType.RunStarted, payload: { sessionId, runId: "preview-run" } }])).resolves.toBeUndefined();
      await chmod(metadata, 0o600);
      await expect(actor.applyEvents([sent("continue")])).resolves.toBeUndefined();
      expect((await store.getSession(sessionId))?.messages.map(value => value.id)).toEqual(["saved", "continue"]);
      expect(await readFile(metadata)).toEqual(original);
    } finally { await chmod(metadata, 0o600); actor.dispose(); coordinator.dispose(); store.close(); }
  });

  it("keeps an already persisted message usable when its derived catalog update fails", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-catalog-failure-"));
    directories.push(directory);
    const store = new NcpAgentSessionJournalStore(directory);
    await store.importSessionSnapshot({ sessionId, messages: [message("saved")], metadata: {},
      createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z" });
    const catalog = (store as unknown as { summaryIndexStore: { upsertForEvent: (...args: unknown[]) => Promise<void> } }).summaryIndexStore;
    const failCatalog = vi.spyOn(catalog, "upsertForEvent").mockRejectedValueOnce(Object.assign(new Error("fixture catalog busy"), { code: "SQLITE_BUSY" }));
    const coordinator = new SessionEventCoordinatorService({ eventBus: new EventBus(), journalStore: store,
      appendSessionEvent: store.appendSessionEvent, getSessionRecord: store.getSession,
      listUnfinishedRuns: async () => [], updateSessionMetadata: (id, metadata) => store.setSessionMetadata({ sessionId: id, metadata }) });
    const actor = new SessionRun({ sessionId, messages: [message("saved")] }, undefined, undefined, coordinator.persist);
    try {
      await expect(actor.applyEvents([sent("committed")])).resolves.toBeUndefined();
      expect((await store.getSession(sessionId))?.messages.map(value => value.id)).toEqual(["saved", "committed"]);
      await expect(actor.applyEvents([sent("continue")])).resolves.toBeUndefined();
      expect(actor.getSnapshot().messages.map(value => value.id)).toEqual(["saved", "committed", "continue"]);
    } finally { failCatalog.mockRestore(); actor.dispose(); coordinator.dispose(); store.close(); }
  });

});

describe("session journal durability safeguards", () => {
  it.skipIf(process.platform === "win32" || process.getuid?.() === 0)("does not treat an unreadable existing journal as a missing session", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-journal-read-failure-"));
    directories.push(directory);
    const store = new NcpAgentSessionJournalStore(directory);
    await store.importSessionSnapshot({ sessionId, messages: [message("preserved")], metadata: {}, createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z" });
    const original = await readFile(join(directory, `${sessionId}.jsonl`));
    try {
      await chmod(directory, 0);
      await expect(store.getSession(sessionId)).rejects.toMatchObject({ code: "EACCES" });
    } finally { await chmod(directory, 0o700); store.close(); }
    expect(await readFile(join(directory, `${sessionId}.jsonl`))).toEqual(original);
    const cold = new NcpAgentSessionJournalStore(directory);
    try { expect((await cold.getSession(sessionId))?.messages.map(value => value.id)).toEqual(["preserved"]); }
    finally { cold.close(); }
  });

  it("rejects a runtime event before actor state can diverge from the cold journal", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-journal-failure-"));
    directories.push(directory);
    const store = new NcpAgentSessionJournalStore(directory);
    await store.importSessionSnapshot({ sessionId, messages: [message("persisted")], metadata: {}, createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z" });
    const eventBus = new EventBus();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const coordinator = new SessionEventCoordinatorService({
      eventBus, appendSessionEvent: store.appendSessionEvent, getSessionRecord: store.getSession,
      journalStore: store, listUnfinishedRuns: async () => [],
      updateSessionMetadata: (id, metadata) => store.setSessionMetadata({ sessionId: id, metadata }),
    });
    await coordinator.start();
    const run = new SessionRun({ sessionId, messages: [message("persisted")] }, undefined, undefined, coordinator.persist);
    const path = join(directory, `${sessionId}.jsonl`);
    const original = await readFile(path);
    await rename(path, `${path}.saved`);
    await mkdir(path);
    const event = sent("must-not-be-memory-only");
    let rejected: unknown;
    try {
      await run.applyEvents([event]);
      eventBus.emit(eventKeys.ncpEvent, event, { emittedAt: new Date().toISOString(), source: "agent-run-request" });
    } catch (error) { rejected = error; }
    await coordinator.flushSession(sessionId).catch(() => undefined);
    await rm(path, { recursive: true });
    await rename(`${path}.saved`, path);
    coordinator.dispose();
    store.close();
    const cold = new NcpAgentSessionJournalStore(directory);
    try {
      const restored = await cold.getSession(sessionId);
      console.info("journal-failure-baseline", { rejected: Boolean(rejected), live: run.getSnapshot().messages.map(value => value.id), cold: restored?.messages.map(value => value.id), errorLogs: errors.mock.calls.length });
      expect(await readFile(path)).toEqual(original);
      expect(restored?.messages.map(value => value.id)).toEqual(["persisted"]);
      expect(rejected).toBeDefined();
      expect(run.getSnapshot().messages.map(value => value.id)).toEqual(["persisted"]);
    } finally { cold.close(); run.dispose(); }
  });

  it("reports the original filesystem cause once instead of flooding logs with latch wrappers", async () => {
    const eventBus = new EventBus();
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cause = Object.assign(new Error("fixture disk exhausted"), { code: "ENOSPC", errno: -28, syscall: "write", path: "/fixture/journal.jsonl" });
    const coordinator = new SessionEventCoordinatorService({
      eventBus, appendSessionEvent: async () => { throw cause; }, getSessionRecord: async () => null,
      journalStore: { synchronizeSessionMessageProjection: async () => undefined },
      listUnfinishedRuns: async () => [], updateSessionMetadata: async () => true,
    });
    await coordinator.start();
    try {
      for (let index = 0; index < 50; index++) {
        eventBus.emit(eventKeys.ncpEvent, sent(`failed-${index}`), { emittedAt: new Date().toISOString(), source: "agent-run-request" });
        await coordinator.flushSession(sessionId).catch(() => undefined);
      }
      console.info("journal-failure-log-baseline", { count: errors.mock.calls.length, last: String(errors.mock.calls.at(-1)?.[0]) });
      expect(errors).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(errors.mock.calls)).toContain("ENOSPC");
      expect(JSON.stringify(errors.mock.calls)).toContain("fixture disk exhausted");
    } finally { coordinator.dispose(); }
  });

  it("rolls back a failed JSON value without corrupting the source or allowing an in-memory success", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-json-write-failure-"));
    directories.push(directory);
    const store = new NcpAgentSessionJournalStore(directory);
    await store.importSessionSnapshot({ sessionId, messages: [message("saved")], metadata: {}, createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z" });
    const path = join(directory, `${sessionId}.jsonl`);
    const original = await readFile(path);
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const coordinator = new SessionEventCoordinatorService({ eventBus: new EventBus(), journalStore: store,
      appendSessionEvent: store.appendSessionEvent, getSessionRecord: store.getSession, listUnfinishedRuns: async () => [],
      updateSessionMetadata: (id, metadata) => store.setSessionMetadata({ sessionId: id, metadata }) });
    const actor = new SessionRun({ sessionId, messages: [message("saved")] }, undefined, undefined, coordinator.persist);
    try {
      const event = sent("unserializable");
      if (event.type === NcpEventType.MessageSent) event.payload.message.metadata = { unsupported: BigInt(42) };
      await expect(actor.applyEvents([event])).rejects.toMatchObject({ code: "SESSION_JOURNAL_WRITE_FAILED" });
      expect(actor.getSnapshot().messages.map(value => value.id)).toEqual(["saved"]);
      expect(await readFile(path)).toEqual(original);
      expect(JSON.stringify(logged.mock.calls)).toContain("BigInt");
      await expect(coordinator.persist(sent("later"))).rejects.toMatchObject({ code: "SESSION_JOURNAL_WRITE_FAILED" });
      expect(logged).toHaveBeenCalledOnce();
    } finally { coordinator.dispose(); actor.dispose(); store.close(); }
    const cold = new NcpAgentSessionJournalStore(directory);
    try {
      expect((await cold.getSession(sessionId))?.messages.map(value => value.id)).toEqual(["saved"]);
      expect((await cold.listSessionSummaries()).map(value => value.sessionId)).toContain(sessionId);
    } finally { cold.close(); }
  });

  it("preserves a 20 MiB journal through three compactions and high-frequency Unicode writes", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nextclaw-large-journal-"));
    directories.push(directory);
    const store = new NcpAgentSessionJournalStore(directory);
    const history = Array.from({ length: 1106 }, (_, index) => ({ ...message(`history-${index}`),
      parts: [{ type: "text" as const, text: "x".repeat(19_000) + '\n"quoted" \\ 中文🙂 {"valid":"text"}' }] }));
    await store.importSessionSnapshot({ sessionId, messages: history, metadata: {}, createdAt: "2026-11-14T00:00:00.000Z", updatedAt: "2026-11-14T00:00:00.000Z" });
    const journalPath = join(directory, `${sessionId}.jsonl`);
    expect((await stat(journalPath)).size).toBeGreaterThan(20 * 1024 * 1024);
    const coordinator = new SessionEventCoordinatorService({ eventBus: new EventBus(), journalStore: store,
      appendSessionEvent: store.appendSessionEvent, getSessionRecord: async id => {
        const summary = await store.getSessionSummary(id);
        if (!summary) return null;
        const page = await store.listSessionMessagePage({ sessionId: id, limit: 4 });
        return { ...summary, metadata: summary.metadata ?? {}, messages: page.messages };
      }, listUnfinishedRuns: async () => [], updateSessionMetadata: (id, metadata) => store.setSessionMetadata({ sessionId: id, metadata }) });
    const actor = new SessionRun({ sessionId, messages: history }, undefined, undefined, coordinator.persist);
    const provider = { chat: vi.fn(async () => ({ content: "# Saved context\nContinue the verified read-only task and preserve the original history.", finishReason: "stop", usage: {} })) };
    const compaction = new AgentRunContextCompactionManager({ resolveAgentProfileForRun: () => ({ contextTokens: 200_000, reservedContextTokens: 10_000 }) }, provider, null,
      { captureCompactionSource: async (id, ids) => { await coordinator.flushSession(id); return store.captureCompactionSource(id, ids); } });
    try {
      for (let round = 0; round < 3; round++) {
        const events = await compaction.runManual({ sessionId, agentId: "main", model: "fixture", contextBlocks: [],
          messages: actor.getSnapshot().messages, metadata: (await store.getSessionSummary(sessionId))?.metadata ?? {} });
        await actor.applyEvents(events);
        const marker = events.find(event => event.type === NcpEventType.MessageSent
          && event.payload.message.metadata?.checkpoint && (event.payload.message.metadata.checkpoint as { status?: string }).status === "compressed");
        expect(marker).toBeDefined();
        const id = `stream-${round}`;
        const payload = { sessionId, messageId: id };
        const text = '片段🙂 " \\ \n {value}'.repeat(400);
        await actor.applyEvents([{ type: NcpEventType.MessageSent, payload: { sessionId, message: { ...message(id), status: "streaming", parts: [] } } },
          { type: NcpEventType.MessageTextStart, payload }]);
        for (const delta of Array.from(text)) await actor.applyEvents([{ type: NcpEventType.MessageTextDelta, payload: { ...payload, delta } }]);
        await actor.applyEvents([{ type: NcpEventType.MessageTextEnd, payload },
          { type: NcpEventType.MessageCompleted, payload: { sessionId, message: { ...message(id), parts: [{ type: "text", text }] } } }]);
        await coordinator.flushSession(sessionId);
      }
      expect(provider.chat).toHaveBeenCalledTimes(3);
    } finally { coordinator.dispose(); actor.dispose(); store.close(); }
    const cold = new NcpAgentSessionJournalStore(directory);
    try {
      const record = await cold.getSession(sessionId);
      expect(record?.messages.find(value => value.id === "history-0")?.parts).toEqual(history[0]!.parts);
      expect(record?.messages.find(value => value.id === "history-1105")?.parts).toEqual(history.at(-1)!.parts);
      for (let round = 0; round < 3; round++) expect(record?.messages.find(value => value.id === `stream-${round}`)?.parts)
        .toEqual([{ type: "text", text: '片段🙂 " \\ \n {value}'.repeat(400) }]);
      expect((await cold.listSessionSummaries()).map(value => value.sessionId)).toContain(sessionId);
    } finally { cold.close(); }
  }, 30_000);
});
