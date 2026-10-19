import type { SessionHistoryPreparation, SessionMessagePage } from "@kernel/types/session.types.js";
import type { NcpAgentSessionJournalReplayEvent } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { NcpAgentSessionMessageProjectionPersistenceStore, type ReadProjectionPageParams } from "./ncp-agent-session-message-projection-persistence.store.js";
import { SessionMessagePreparationStore } from "./session-message-preparation.store.js";

type Rebuild = Parameters<NcpAgentSessionMessageProjectionPersistenceStore["rebuild"]>[0];
type Synchronize = Parameters<NcpAgentSessionMessageProjectionPersistenceStore["synchronize"]>[0];

export class NcpAgentSessionMessageProjectionStore {
  private readonly operationChains = new Map<string, Promise<void>>();
  private readonly persistence: NcpAgentSessionMessageProjectionPersistenceStore;
  private readonly preparation: SessionMessagePreparationStore;
  constructor(journalDir: string) {
    this.persistence = new NcpAgentSessionMessageProjectionPersistenceStore(journalDir);
    this.preparation = new SessionMessagePreparationStore(async (sessionId, signal, progress) => {
      await this.enqueue(sessionId, async () => {
        const meta = await this.persistence.readMeta(sessionId, true).catch(() => null);
        const identity = await this.persistence.journalIdentity(sessionId);
        const bytes = await this.persistence.journalBytes(sessionId);
        if (!meta || meta.journalIdentity !== identity || meta.projectedJournalOffset > (bytes ?? 0)) await this.persistence.delete(sessionId);
        await this.persistence.prepare(sessionId, signal, progress);
      });
    });
  }

  readMeta = (sessionId: string) => this.persistence.readMeta(sessionId);
  readPart = (sessionId: string, messageId: string, part: number, cursor?: string) =>
    this.enqueue(sessionId, () => this.persistence.readPart(sessionId, messageId, part, cursor));
  readRunWindow = (sessionId: string) => this.enqueue(sessionId, () => this.persistence.readRunWindow(sessionId));
  readQuestionMessages = (sessionId: string, questionId?: string) => this.enqueue(sessionId, () => this.persistence.readQuestionMessages(sessionId, questionId));
  findIngressMessage = (sessionId: string, key: string) => this.enqueue(sessionId, () => this.persistence.findIngressMessage(sessionId, key));
  captureSource = (sessionId: string, messageIds: readonly string[]) => this.enqueue(sessionId, () => this.persistence.captureSource(sessionId, messageIds));
  validateSource = (sessionId: string, source: Parameters<NcpAgentSessionMessageProjectionPersistenceStore["validateSource"]>[1]) => this.enqueue(sessionId, () => this.persistence.validateSource(sessionId, source));

  prepare = async (sessionId: string, options: { retry?: boolean; wait?: boolean } = {}): Promise<SessionHistoryPreparation | null> => {
    const active = this.preparation.get(sessionId);
    if (active && ["queued", "preparing"].includes(active.status)) {
      if (options.wait) await this.preparation.wait(sessionId);
      return this.preparation.get(sessionId);
    }
    const bytes = await this.persistence.journalBytes(sessionId);
    if (bytes === null) return null;
    let healthy = false;
    try {
      const meta = await this.persistence.readMeta(sessionId);
      healthy = Boolean(meta && meta.projectedJournalOffset === bytes && meta.journalIdentity === await this.persistence.journalIdentity(sessionId));
    } catch (error) {
      // Derived corruption is recoverable; never delete or rewrite the original journal.
      if (!(error instanceof Error) || !("code" in error)) throw error;
    }
    if (healthy) return { status: "ready", processedBytes: bytes, totalBytes: bytes };
    const state = this.preparation.start(sessionId, bytes, options.retry || active?.status === "ready");
    if (options.wait) { await this.preparation.wait(sessionId); return this.preparation.get(sessionId); }
    return state;
  };
  cancelPreparation = (sessionId: string) => this.preparation.cancel(sessionId);

  rebuild = (params: Rebuild) => this.enqueue(params.sessionId, () => this.persistence.rebuild(params));
  synchronize = (params: Synchronize) => this.enqueue(params.sessionId, () => this.persistence.synchronize(params));
  synchronizeSource = async (sessionId: string): Promise<boolean> => {
    const result = await this.prepare(sessionId, { retry: true, wait: true });
    return result?.status === "ready";
  };
  synchronizeJournalTail = async (params: { sessionId: string; journalOffset: number }): Promise<boolean> => this.synchronizeSource(params.sessionId);
  appendEvent = (sessionId: string, event: NcpAgentSessionJournalReplayEvent, offset: number, nextSeq: number, previousOffset?: number, timestamp?: string) =>
    this.enqueue(sessionId, () => this.persistence.appendEvent(sessionId, event, offset, nextSeq, previousOffset, timestamp));
  updateContextWindow = (sessionId: string, contextWindow: Record<string, unknown> | null) =>
    this.enqueue(sessionId, () => this.persistence.updateContextWindow(sessionId, contextWindow));

  // Read paths stay read-only. The SessionManager readiness boundary explicitly starts maintenance.
  listPage = (params: Omit<ReadProjectionPageParams, "tailMessages">): Promise<SessionMessagePage | null> =>
    this.enqueue(params.sessionId, () => this.persistence.listPage(params));
  readPage = (params: ReadProjectionPageParams) => this.enqueue(params.sessionId, () => this.persistence.readPage(params));
  delete = async (sessionId: string): Promise<void> => {
    this.preparation.cancel(sessionId);
    await this.enqueue(sessionId, () => this.persistence.delete(sessionId));
  };

  private enqueue = async <T>(sessionId: string, operation: () => Promise<T>): Promise<T> => {
    const next = (this.operationChains.get(sessionId) ?? Promise.resolve()).then(operation);
    const settled = next.then(() => undefined, () => undefined);
    this.operationChains.set(sessionId, settled);
    void settled.finally(() => { if (this.operationChains.get(sessionId) === settled) this.operationChains.delete(sessionId); });
    return next;
  };
}
