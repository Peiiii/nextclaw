import type { SessionMessagePage } from "@kernel/types/session.types.js";
import type { LoadedNcpAgentJournalSession } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { decodeNcpAgentSessionMessageCursor, encodeNcpAgentSessionMessageCursor } from "@kernel/utils/ncp-agent-session-message-projection.utils.js";
import {
  NcpAgentSessionMessageProjectionPersistenceStore,
  type ReadProjectionPageParams,
} from "./ncp-agent-session-message-projection-persistence.store.js";

export type MessageProjectionSource = {
  loadSession(sessionId: string): Promise<LoadedNcpAgentJournalSession | null>;
};

type FileSystemError = Error & { code?: string; projectionRenameAttempts?: number };
type ProjectionMutation = "rebuild" | "synchronize" | "synchronizeJournalTail" | "updateContextWindow" | "delete";
type ProjectionRebuildParams = Parameters<NcpAgentSessionMessageProjectionPersistenceStore["rebuild"]>[0];
type ProjectionSynchronizeParams = Parameters<NcpAgentSessionMessageProjectionPersistenceStore["synchronize"]>[0];

export class NcpAgentSessionMessageProjectionStore {
  private readonly operationChains = new Map<string, Promise<void>>();
  private readonly degradedSessionIds = new Set<string>();
  private readonly persistence: NcpAgentSessionMessageProjectionPersistenceStore;

  constructor(journalDir: string, private readonly source?: MessageProjectionSource) {
    this.persistence = new NcpAgentSessionMessageProjectionPersistenceStore(journalDir);
  }

  readMeta = async (sessionId: string) =>
    await this.enqueue(sessionId, async () =>
      this.degradedSessionIds.has(sessionId) ? null : await this.persistence.readMeta(sessionId),
    );

  rebuild = async (params: ProjectionRebuildParams): Promise<void> => {
    await this.mutate(params.sessionId, "rebuild", async () => {
      await this.persistence.rebuild(params);
      this.recover(params.sessionId, "rebuild");
    });
  };

  synchronize = async (params: ProjectionSynchronizeParams): Promise<boolean> =>
    await this.mutate(params.sessionId, "synchronize", async () => {
      if (await this.rebuildIfDegraded(params.sessionId, "synchronize")) return true;
      return await this.persistence.synchronize(params);
    }, false);

  synchronizeJournalTail = async (params: { sessionId: string; journalOffset: number }): Promise<boolean> =>
    await this.mutate(params.sessionId, "synchronizeJournalTail", async () => {
      if (await this.rebuildIfDegraded(params.sessionId, "synchronizeJournalTail")) return true;
      return await this.persistence.synchronizeJournalTail(params);
    }, false);

  updateContextWindow = async (sessionId: string, contextWindow: Record<string, unknown> | null): Promise<void> => {
    await this.mutate(sessionId, "updateContextWindow", async () => {
      if (!this.degradedSessionIds.has(sessionId)) await this.persistence.updateContextWindow(sessionId, contextWindow);
    });
  };

  listPage = async (params: Omit<ReadProjectionPageParams, "tailMessages">): Promise<SessionMessagePage | null> =>
    await this.enqueue(params.sessionId, async () => {
      if (this.degradedSessionIds.has(params.sessionId)) return await this.readJournalPage(params);
      try {
        const page = await this.persistence.listPage(params);
        if (page) return page;
        const loaded = await this.source?.loadSession(params.sessionId);
        if (!loaded) return null;
        await this.persistence.rebuild({
          sessionId: params.sessionId,
          messages: loaded.record.messages,
          projectedJournalOffset: loaded.journalOffset,
        });
        return await this.persistence.listPage(params);
      } catch (error) {
        if (!this.isProjectionStorageError(error)) throw error;
        this.degrade(params.sessionId, "listPage", error);
        return await this.readJournalPage(params);
      }
    });

  readPage = async (params: ReadProjectionPageParams): Promise<SessionMessagePage | null> =>
    await this.enqueue(params.sessionId, async () =>
      this.degradedSessionIds.has(params.sessionId) ? await this.readJournalPage(params) : await this.persistence.readPage(params),
    );

  delete = async (sessionId: string): Promise<void> => {
    await this.mutate(sessionId, "delete", async () => {
      await this.persistence.delete(sessionId);
      this.degradedSessionIds.delete(sessionId);
    });
  };

  private rebuildIfDegraded = async (sessionId: string, operation: ProjectionMutation): Promise<boolean> => {
    if (!this.degradedSessionIds.has(sessionId)) return false;
    const loaded = await this.source?.loadSession(sessionId);
    if (!loaded) return false;
    await this.persistence.rebuild({
      sessionId,
      messages: loaded.record.messages,
      projectedJournalOffset: loaded.journalOffset,
    });
    this.recover(sessionId, operation);
    return true;
  };

  private enqueue = async <T>(sessionId: string, operation: () => Promise<T>): Promise<T> => {
    const previous = this.operationChains.get(sessionId) ?? Promise.resolve();
    const next = previous.then(operation);
    const settled = next.then(() => undefined, () => undefined);
    this.operationChains.set(sessionId, settled);
    void settled.finally(() => {
      if (this.operationChains.get(sessionId) === settled) this.operationChains.delete(sessionId);
    });
    return await next;
  };

  private mutate = async <T>(sessionId: string, operation: ProjectionMutation, mutation: () => Promise<T>, fallback?: T): Promise<T> =>
    await this.enqueue(sessionId, async () => {
      try {
        return await mutation();
      } catch (error) {
        if (!this.isProjectionStorageError(error)) throw error;
        this.degrade(sessionId, operation, error);
        return fallback as T;
      }
    });

  private isProjectionStorageError = (error: unknown): error is FileSystemError =>
    error instanceof Error && typeof (error as FileSystemError).code === "string";

  private degrade = (sessionId: string, operation: string, error: FileSystemError): void => {
    if (this.degradedSessionIds.has(sessionId)) return;
    this.degradedSessionIds.add(sessionId);
    console.warn("Session message projection degraded", {
      sessionId,
      operation,
      code: error.code,
      renameAttempts: error.projectionRenameAttempts ?? 1,
      fallback: "journal-replay",
    });
  };

  private recover = (sessionId: string, operation: string): void => {
    if (!this.degradedSessionIds.delete(sessionId)) return;
    console.info("Session message projection recovered", { sessionId, operation });
  };

  private readJournalPage = async (params: Omit<ReadProjectionPageParams, "tailMessages">): Promise<SessionMessagePage | null> => {
    const { cursor, limit: requestedLimit, sessionId } = params;
    const loaded = await this.source?.loadSession(sessionId);
    if (!loaded) return null;
    const messages = loaded.record.messages.map((message) => structuredClone(message));
    const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, Math.trunc(requestedLimit))) : 40;
    const boundary = cursor ? decodeNcpAgentSessionMessageCursor(cursor, messages.length + 1) : messages.length + 1;
    const endOrdinal = Math.min(messages.length, boundary - 1);
    const startOrdinal = Math.max(1, endOrdinal - limit + 1);
    const pageMessages = startOrdinal <= endOrdinal ? messages.slice(startOrdinal - 1, endOrdinal) : [];
    return {
      messages: pageMessages,
      messageDetailCursors: Object.fromEntries(
        pageMessages.map((message, index) => [message.id, encodeNcpAgentSessionMessageCursor(startOrdinal + index)]),
      ),
      total: messages.length,
      pageInfo: {
        startCursor: pageMessages.length ? encodeNcpAgentSessionMessageCursor(startOrdinal) : null,
        hasPreviousPage: startOrdinal > 1,
      },
      contextWindow: null,
    };
  };
}
