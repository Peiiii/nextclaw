import { copyFile, link, mkdir, open, rename, rm, stat, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { type NcpMessage, type NcpSessionSummary } from "@nextclaw/ncp";
import {
  createNcpAgentSessionSummary,
  type LoadedNcpAgentJournalSession,
  NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
  NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE,
  type NcpAgentSessionJournalEventEntry,
  type NcpAgentSessionJournalReplayEvent,
  normalizeNcpSessionId,
  safeNcpSessionFilename,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { loadNcpAgentSessionSummary } from "./ncp-agent-session-journal-summary-recovery.store.js";
import { isNcpAgentRunLifecycleEvent, type UnfinishedNcpAgentRun } from "@kernel/utils/ncp-agent-unfinished-run.utils.js";
import { NcpAgentUnfinishedRunStore } from "@kernel/stores/ncp-agent-unfinished-run.store.js";
import { NcpAgentSessionMetadataStore } from "./ncp-agent-session-metadata.store.js";
import { NcpAgentSessionMessageProjectionStore } from "./ncp-agent-session-message-projection.store.js";
import { SessionJournalLoaderStore } from "./session-journal-loader.store.js";
import { NcpAgentSessionSummaryIndexStore } from "./ncp-agent-session-summary-index.store.js";
import { NcpAgentSessionSummaryReadStore } from "./ncp-agent-session-summary-read.store.js";
import { assertSessionJournalTailComplete, recoverSessionJournalMaintenance } from "./session-journal-maintenance.store.js";
import type { SessionListPageOptions, SessionMessagePage, SessionMetadataUpdate, SessionPersistence } from "@kernel/types/session.types.js";
import { sessionJsonChunks } from "@kernel/utils/session-message-chunks.utils.js";
import { syncSessionJournalDirectory, syncSessionJournalFile } from "@kernel/utils/session-journal-durability.utils.js";
import { NcpEventType } from "@nextclaw/ncp";
import type { ContextCompactionCheckpoint } from "@nextclaw/core/context-compaction";
export class NcpAgentSessionJournalStore implements SessionPersistence {
  private readonly nextSeqBySession = new Map<string, number>();
  private readonly writeChains = new Map<string, Promise<void>>();
  private readonly metadataStore: NcpAgentSessionMetadataStore;
  private readonly messageProjectionStore: NcpAgentSessionMessageProjectionStore;
  private readonly journalLoaderStore: SessionJournalLoaderStore;
  private readonly unfinishedRunStore: NcpAgentUnfinishedRunStore;
  private readonly summaryIndexStore: NcpAgentSessionSummaryIndexStore;
  private readonly summaryReadStore: NcpAgentSessionSummaryReadStore;
  constructor(private readonly journalDir: string) {
    this.metadataStore = new NcpAgentSessionMetadataStore(journalDir);
    this.messageProjectionStore = new NcpAgentSessionMessageProjectionStore(journalDir);
    this.journalLoaderStore = new SessionJournalLoaderStore(this.metadataStore);
    this.summaryIndexStore = new NcpAgentSessionSummaryIndexStore(
      journalDir,
      async (sessionId) => this.loadSession(sessionId),
      async (sessionId) => {
        try {
          const journalStat = await stat(this.sessionPath(sessionId));
          return await loadNcpAgentSessionSummary({
            sessionId,
            journalPath: this.sessionPath(sessionId),
            updatedAt: journalStat.mtime.toISOString(),
            metadataStore: this.metadataStore,
            projectionStore: this.messageProjectionStore,
          });
        } catch {
          return null;
        }
      },
    );
    this.summaryReadStore = new NcpAgentSessionSummaryReadStore({
      summaryIndex: this.summaryIndexStore,
      readJournalModifiedAt: async (sessionId) => (await stat(this.sessionPath(sessionId))).mtime.toISOString(),
      readMetadata: (sessionId, fallback) => this.metadataStore.read(sessionId, fallback),
      readProjectedMessageCount: async (sessionId) => (await this.messageProjectionStore.readMeta(sessionId))?.total ?? null,
    });
    this.unfinishedRunStore = new NcpAgentUnfinishedRunStore(journalDir, this.summaryIndexStore.listRunRecoveryCheckpoints, this.summaryIndexStore.writeRunRecoveryCheckpoint);
  }
  initialize = async (): Promise<void> => { await recoverSessionJournalMaintenance(this.journalDir); await this.summaryIndexStore.initialize(); };
  close = (): void => this.summaryIndexStore.close();

  appendSessionEvent = async (params: {
    sessionId: string;
    event: NcpAgentSessionJournalReplayEvent;
    signal?: AbortSignal;
  }): Promise<void> => {
    const sessionId = normalizeNcpSessionId(params.sessionId);
    if (!sessionId) {
      return;
    }
    return this.enqueueWrite(sessionId, () =>
      this.appendSessionEventNow({
        ...params,
        sessionId
      })
    );
  };
  synchronizeSessionMessageProjection = (sessionId: string) => this.messageProjectionStore.synchronizeSource(normalizeNcpSessionId(sessionId));
  getSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    if (!normalizedSessionId) {
      return null;
    }
    await this.writeChains.get(normalizedSessionId);
    const loaded = await this.loadSession(normalizedSessionId);
    if (!loaded) {
      return null;
    }
    return loaded.record;
  };
  listSessionSummaries = async (options?: { limit?: number }): Promise<NcpSessionSummary[]> => {
    return await this.summaryReadStore.list(options?.limit);
  };
  listSessionSummaryPage = (options: SessionListPageOptions) => this.summaryReadStore.listPage(options);
  getSessionSummary = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    if (!normalizedSessionId) {
      return null;
    }
    const summary = await this.summaryReadStore.get(normalizedSessionId);
    const meta = await this.messageProjectionStore.readMeta(normalizedSessionId);
    if (!summary || !meta) return summary;
    const header = meta.legacyMetadata;
    if (!header) return { ...summary, messageCount: meta.total };
    const current = await this.metadataStore.read(normalizedSessionId, header);
    return { ...summary, ...current, messageCount: meta.total };
  };
  listUnfinishedRuns = (): Promise<UnfinishedNcpAgentRun[]> =>
    this.unfinishedRunStore.list();
  listSessionMessages = async (sessionId: string): Promise<NcpMessage[]> => {
    const session = await this.getSession(sessionId);
    return session ? session.messages.map((message) => structuredClone(message)) : [];
  };
  readSessionMessagePart: NonNullable<SessionPersistence["readSessionMessagePart"]> = async params =>
    this.messageProjectionStore.readPart(normalizeNcpSessionId(params.sessionId), params.messageId, params.part, params.cursor);
  loadSessionRunSeed = async (sessionId: string): Promise<NcpMessage[]> => {
    await this.messageProjectionStore.prepare(normalizeNcpSessionId(sessionId), { wait: true });
    const window = await this.messageProjectionStore.readRunWindow(normalizeNcpSessionId(sessionId));
    if (!window) throw new Error("Session history index is preparing; retry when preparation completes.");
    return window.messages;
  };
  prepareSessionHistory: NonNullable<SessionPersistence["prepareSessionHistory"]> = async (sessionId, options) => {
    const id = normalizeNcpSessionId(sessionId);
    const write = this.writeChains.get(id);
    if (write && !options?.wait) return { status: "queued", processedBytes: 0, totalBytes: 0 };
    if (write) await write;
    const state = await this.messageProjectionStore.prepare(id, options);
    if (state?.status === "ready") {
      const previous = await this.summaryIndexStore.get(id);
      const meta = await this.messageProjectionStore.readMeta(id);
      if (previous && meta && previous.messageCount !== meta.total) {
        await this.summaryIndexStore.upsert({ ...previous, messageCount: meta.total });
      }
    }
    return state;
  };
  cancelSessionHistoryPreparation = (sessionId: string) => this.messageProjectionStore.cancelPreparation(normalizeNcpSessionId(sessionId));
  listSessionQuestionMessages = (sessionId: string, questionId?: string) => this.messageProjectionStore.readQuestionMessages(normalizeNcpSessionId(sessionId), questionId);
  findSessionMessageByIngressKey = (sessionId: string, key: string) => this.messageProjectionStore.findIngressMessage(normalizeNcpSessionId(sessionId), key);
  captureCompactionSource = (sessionId: string, messageIds: readonly string[]) => this.messageProjectionStore.captureSource(normalizeNcpSessionId(sessionId), messageIds);
  listSessionMessagePage = async (params: {
    sessionId: string;
    limit: number;
    cursor?: string;
  }): Promise<SessionMessagePage | null> => {
    const sessionId = normalizeNcpSessionId(params.sessionId);
    if (!sessionId) {
      return null;
    }
    return await this.messageProjectionStore.listPage({
      sessionId,
      limit: params.limit,
      cursor: params.cursor
    });
  };
  updateSessionMessageProjectionContextWindow = async (
    sessionId: string,
    contextWindow: Record<string, unknown> | null
  ): Promise<void> => {
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    if (!normalizedSessionId) {
      return;
    }
    await this.messageProjectionStore.updateContextWindow(normalizedSessionId, contextWindow);
  };
  getSessionMessageProjectionContextWindow = async (
    sessionId: string,
  ): Promise<Record<string, unknown> | null> => {
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    if (!normalizedSessionId) {
      return null;
    }
    const contextWindow = (await this.messageProjectionStore.readMeta(normalizedSessionId))?.contextWindow;
    return contextWindow ? structuredClone(contextWindow) : null;
  };
  setSessionMetadata = async (params: { sessionId: string; metadata: Record<string, unknown> }): Promise<boolean> => {
    const sessionId = normalizeNcpSessionId(params.sessionId);
    if (!sessionId) {
      return false;
    }
    return this.enqueueWrite(sessionId, () =>
      this.setSessionMetadataNow({
        ...params,
        sessionId
      })
    );
  };
  updateSessionMetadata = async (params: SessionMetadataUpdate): Promise<boolean> => {
    const sessionId = normalizeNcpSessionId(params.sessionId);
    if (!sessionId) {
      return false;
    }
    return this.enqueueWrite(sessionId, () =>
      this.updateSessionMetadataNow({
        ...params,
        sessionId
      })
    );
  };
  private setSessionMetadataNow = async (params: {
    sessionId: string;
    metadata: Record<string, unknown>;
  }): Promise<boolean> => {
    const { metadata, sessionId } = params;
    let journalStat: Awaited<ReturnType<typeof stat>>;
    try {
      journalStat = await stat(this.sessionPath(sessionId));
    } catch {
      return false;
    }
    const summary = await this.summaryReadStore.get(sessionId);
    const activity = await this.metadataStore.read(sessionId, {
      metadata: {},
      createdAt: summary?.createdAt ?? journalStat.birthtime.toISOString(),
      updatedAt: summary?.updatedAt ?? journalStat.mtime.toISOString(),
    });
    const nextRecord: AgentSessionRecord = {
      sessionId,
      ...(activity.agentId ? { agentId: activity.agentId } : {}),
      messages: [],
      createdAt: activity.createdAt,
      updatedAt: activity.updatedAt,
      metadata: structuredClone(metadata)
    };
    await this.metadataStore.write(nextRecord);
    await this.summaryIndexStore.upsert(summary
      ? { ...summary, metadata: structuredClone(metadata) }
      : createNcpAgentSessionSummary(nextRecord));
    return true;
  };
  private updateSessionMetadataNow = async (params: SessionMetadataUpdate): Promise<boolean> => {
    const { sessionId, metadata, expectedMetadata } = params;
    let journalStat: Awaited<ReturnType<typeof stat>>;
    try {
      journalStat = await stat(this.sessionPath(sessionId));
    } catch {
      return false;
    }
    const summary = await this.summaryReadStore.get(sessionId);
    const activity = await this.metadataStore.read(sessionId, {
      metadata: {},
      createdAt: summary?.createdAt ?? journalStat.birthtime.toISOString(),
      updatedAt: summary?.updatedAt ?? journalStat.mtime.toISOString(),
    });
    if (expectedMetadata && Object.entries(expectedMetadata).some(
      ([key, value]) => activity.metadata?.[key] !== value,
    )) return false;
    return await this.setSessionMetadataNow({
      sessionId,
      metadata: {
        ...structuredClone(activity.metadata),
        ...structuredClone(metadata)
      }
    });
  };
  importSessionSnapshot = (record: AgentSessionRecord): Promise<void> => this.enqueueWrite(normalizeNcpSessionId(record.sessionId), () => this.importSessionSnapshotNow(record));
  private importSessionSnapshotNow = async (record: AgentSessionRecord): Promise<void> => {
    const sessionId = normalizeNcpSessionId(record.sessionId);
    if (!sessionId) {
      return;
    }
    await this.ensureJournalDir();
    const nextRecord = { ...record, sessionId, metadata: structuredClone(record.metadata ?? {}) };
    const path = this.sessionPath(sessionId);
    const staged = `${path}.import-${randomUUID()}.tmp`;
    const backup = `${path}.import-backup`;
    const marker = `${path}.import-maintenance`;
    if (await stat(marker).catch(() => null)) throw new Error("An interrupted session import requires startup recovery before another import.");
    const previousStat = await stat(path).catch(() => null);
    const previousSummary = await this.summaryReadStore.get(sessionId);
    const previousMetadata = await this.metadataStore.read(sessionId, { metadata: previousSummary?.metadata ?? {},
      createdAt: previousSummary?.createdAt ?? new Date(0).toISOString(), updatedAt: previousSummary?.updatedAt ?? new Date(0).toISOString() });
    let activated = false;
    const output = await open(staged, "wx");
    try {
    for (const [index, message] of nextRecord.messages.entries()) {
      const entry: NcpAgentSessionJournalEventEntry = {
        _type: "event",
        version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
        seq: index + 1,
        timestamp: message.timestamp ?? nextRecord.updatedAt,
        event: {
          type: NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE,
          payload: {
            sessionId,
            message,
          }
        }
      };
      for (const chunk of sessionJsonChunks(entry)) await output.writeFile(chunk);
      await output.writeFile("\n");
    }
    await output.sync(); await output.close();
    await rm(backup, { force: true });
    if (previousStat) await link(path, backup);
    const intent = await open(marker, "wx");
    try { await intent.writeFile(JSON.stringify({ sessionId, snapshot: { hadSource: Boolean(previousStat), metadata: previousMetadata } })); await intent.sync(); }
    finally { await intent.close(); }
    await syncSessionJournalDirectory(this.journalDir);
    await rename(staged, path); activated = true;
    const nextSeq = nextRecord.messages.length + 1;
    const journalStat = await stat(path);
    this.nextSeqBySession.set(sessionId, nextSeq);
    await this.messageProjectionStore.rebuild({
      sessionId,
      messages: nextRecord.messages,
      projectedJournalOffset: journalStat.size,
      nextSeq,
    });
    await this.metadataStore.write(nextRecord);
    await this.summaryIndexStore.upsert(createNcpAgentSessionSummary(nextRecord));
    await syncSessionJournalDirectory(this.journalDir);
    await rm(marker);
    await syncSessionJournalDirectory(this.journalDir);
    await rm(backup, { force: true });
    } catch (error) {
      await output.close().catch(() => undefined);
      if (activated) {
        if (previousStat) {
          await copyFile(backup, staged);
          await syncSessionJournalFile(staged);
          await rename(staged, path);
        } else await rm(path, { force: true });
        await this.messageProjectionStore.delete(sessionId);
        if (previousStat) {
          await this.metadataStore.write({ sessionId, ...previousMetadata });
          if (previousSummary) await this.summaryIndexStore.upsert(previousSummary);
        } else { await this.metadataStore.delete(sessionId); await this.summaryIndexStore.remove(sessionId); }
      }
      this.nextSeqBySession.delete(sessionId);
      await rm(marker, { force: true });
      await syncSessionJournalDirectory(this.journalDir);
      throw error;
    } finally { await rm(staged, { force: true }); }
  };
  deleteSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    if (!normalizedSessionId) {
      return null;
    }
    const existing = await this.getSession(normalizedSessionId);
    this.nextSeqBySession.delete(normalizedSessionId);
    try {
      await unlink(this.sessionPath(normalizedSessionId));
    } catch {
      // The journal may already be absent when deleting a legacy-only session.
    }
    await this.metadataStore.delete(normalizedSessionId);
    await rm(`${this.sessionPath(normalizedSessionId)}.import-backup`, { force: true });
    await this.messageProjectionStore.delete(normalizedSessionId);
    await this.summaryIndexStore.remove(normalizedSessionId);
    return existing;
  };
  hasSession = async (sessionId: string): Promise<boolean> => {
    const normalizedSessionId = normalizeNcpSessionId(sessionId);
    if (!normalizedSessionId) {
      return false;
    }
    return this.summaryIndexStore.has(normalizedSessionId);
  };
  private appendSessionEventNow = async (params: {
    sessionId: string;
    event: NcpAgentSessionJournalReplayEvent;
    signal?: AbortSignal;
  }): Promise<void> => {
    const { event, sessionId } = params;
    const updatedAt = new Date().toISOString();
    await this.ensureJournalDir();
    const path = this.sessionPath(sessionId);
    if (!this.nextSeqBySession.has(sessionId)) {
      const journalBytes = (await stat(path).catch(() => null))?.size ?? 0;
      let meta = await this.messageProjectionStore.readMeta(sessionId);
      if (!meta && journalBytes === 0) {
        await this.messageProjectionStore.rebuild({ sessionId, messages: [], projectedJournalOffset: 0, nextSeq: 1 });
        meta = await this.messageProjectionStore.readMeta(sessionId);
      } else if (!meta || meta.projectedJournalOffset !== journalBytes) {
        await this.messageProjectionStore.prepare(sessionId, { wait: true });
        meta = await this.messageProjectionStore.readMeta(sessionId);
      }
      this.nextSeqBySession.set(sessionId, meta?.nextSeq ?? 1);
    }
    const nextSeq = this.nextSeqBySession.get(sessionId)!;
    if (event.type === NcpEventType.MessageSent && event.payload.message.metadata?.nextclaw_timeline_kind === "context_compaction") {
      const checkpoint = event.payload.message.metadata.checkpoint as ContextCompactionCheckpoint;
      if (checkpoint.status === "compressed" && checkpoint.source && !await this.messageProjectionStore.validateSource(sessionId, checkpoint.source)) {
        throw Object.assign(new Error("Compaction source changed before durable installation."), { code: "CONTEXT_COMPACTION_STALE", journalCommitRejected: true });
      }
    }
    const entry: NcpAgentSessionJournalEventEntry = {
      _type: "event",
      version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
      seq: nextSeq,
      timestamp: updatedAt,
      event,
    };
    const written = await this.appendJournalEntry(path, entry, params.signal);
    this.nextSeqBySession.set(sessionId, nextSeq + 1);
    const journalOffset = written.offset;
    try { await this.messageProjectionStore.appendEvent(sessionId, event, journalOffset, nextSeq + 1, written.previousOffset, updatedAt); }
    catch (error) { console.warn("Session message index requires repair after a durable append", { sessionId, error: error instanceof Error ? error.message : String(error) }); }
    const projection = await this.messageProjectionStore.readMeta(sessionId);
    await this.summaryIndexStore.upsertForEvent({ sessionId, event, updatedAt, projectedMessageCount: projection?.total });
    if (isNcpAgentRunLifecycleEvent(event)) await this.summaryIndexStore.recordRunRecoveryEvent({ sessionId, event, journalOffset: journalOffset ?? (await stat(path)).size });
  };

  private loadSession = async (sessionId: string): Promise<LoadedNcpAgentJournalSession | null> => {
    const loaded = await this.journalLoaderStore.load(sessionId, this.sessionPath(sessionId));
    if (loaded) this.nextSeqBySession.set(sessionId, loaded.nextSeq);
    return loaded;
  };
  private appendJournalEntry = async (path: string, entry: NcpAgentSessionJournalEventEntry, signal?: AbortSignal): Promise<{ previousOffset: number; offset: number }> => {
    if (signal?.aborted) throw Object.assign(signal.reason instanceof Error ? signal.reason : new DOMException("Cancelled", "AbortError"), { journalCommitRejected: true });
    await assertSessionJournalTailComplete(path);
    const file = await open(path, "a");
    const previousOffset = (await file.stat()).size;
    let completed = false;
    try {
      let offset = previousOffset;
      const write = async (text: string) => {
        const buffer = Buffer.from(text);
        let position = 0;
        while (position < buffer.length) {
          const result = await file.write(buffer, position, buffer.length - position, null);
          if (!result.bytesWritten) throw new Error("Session journal append made no progress.");
          position += result.bytesWritten; offset += result.bytesWritten;
        }
      };
      for (const chunk of sessionJsonChunks(entry)) await write(chunk);
      await write("\n");
      if (signal?.aborted) {
        await file.truncate(previousOffset); await file.sync();
        throw Object.assign(signal.reason instanceof Error ? signal.reason : new DOMException("Cancelled", "AbortError"), { journalCommitRejected: true });
      }
      const event = entry.event;
      if (event.type === NcpEventType.MessageSent && event.payload.message.metadata?.nextclaw_timeline_kind === "context_compaction"
        && (event.payload.message.metadata.checkpoint as { status?: string } | undefined)?.status === "compressed") await file.sync();
      completed = true;
      return { previousOffset, offset };
    } catch (error) {
      if (!completed) {
        await file.truncate(previousOffset); await file.sync();
        if (error instanceof Error) Object.assign(error, { journalCommitRejected: true });
      }
      throw error;
    } finally { await file.close(); }
  };
  private ensureJournalDir = async (): Promise<void> => {
    await mkdir(this.journalDir, { recursive: true });
  };

  private enqueueWrite = <T>(sessionId: string, operation: () => Promise<T>): Promise<T> => {
    const next = (this.writeChains.get(sessionId) ?? Promise.resolve()).then(operation);
    const settled = next.then(() => undefined, () => undefined);
    this.writeChains.set(sessionId, settled);
    void settled.finally(() => { if (this.writeChains.get(sessionId) === settled) this.writeChains.delete(sessionId); });
    return next;
  };

  private sessionPath = (sessionId: string): string => {
    return join(this.journalDir, `${safeNcpSessionFilename(sessionId.replace(/:/g, "_"))}.jsonl`);
  };
}
