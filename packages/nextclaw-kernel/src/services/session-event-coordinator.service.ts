import { NcpEventType, type NcpEndpointEvent, type NcpMessage } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import type { EventBus } from "@nextclaw/shared";
import { eventKeys } from "@nextclaw/shared";
import type { SessionPersistence } from "@kernel/types/session.types.js";
import type { NcpAgentSessionJournalReplayEvent } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { UnfinishedNcpAgentRun } from "@kernel/utils/ncp-agent-unfinished-run.utils.js";
import { PERSISTED_SESSION_EVENT_SOURCE, SessionEventIngestionService } from "./session-event-ingestion.service.js";
import { readSessionJournalFailureContext, SESSION_JOURNAL_FAILURE_SOURCE } from "@kernel/utils/session-journal-error.utils.js";
import { readEventMessageId, readEventRunId } from "@kernel/utils/ncp-agent-session-replay-event.utils.js";

type SessionEventCoordinatorServiceOptions = {
  appendSessionEvent: (params: {
    sessionId: string;
    event: NcpAgentSessionJournalReplayEvent;
    signal?: AbortSignal;
  }) => Promise<void>;
  eventBus: EventBus;
  getSessionRecord: (sessionId: string) => Promise<AgentSessionRecord | null>;
  journalStore: Pick<SessionPersistence, "synchronizeSessionMessageProjection"> & Partial<Pick<SessionPersistence, "loadSessionRunSeed" | "prepareSessionHistory" | "getSessionSummary">>;
  listUnfinishedRuns: () => Promise<UnfinishedNcpAgentRun[]>;
  updateSessionMetadata: (
    sessionId: string,
    metadata: Record<string, unknown>,
  ) => Promise<boolean>;
};

export type PublishSessionEventParams = {
  sessionId: string;
  event: NcpEndpointEvent;
  source: string;
  synchronizeMessageProjection?: boolean;
  persistFirst?: boolean;
};

export class SessionEventCoordinatorService {
  private readonly ingestion: SessionEventIngestionService;

  constructor(private readonly options: SessionEventCoordinatorServiceOptions) {
    this.ingestion = new SessionEventIngestionService({
      appendSessionEvent: options.appendSessionEvent,
      getSessionRecord: options.getSessionRecord,
      listUnfinishedRuns: options.listUnfinishedRuns,
      onError: (sessionId, error, event) => {
        const payload = event && "payload" in event ? event.payload : undefined;
        const detail = error instanceof Error ? error.message : String(error);
        console.error(`[session-manager] failed to handle ncp event for ${sessionId}: ${detail}`, {
          event: "session.persistence.failed", outcome: "failed", sessionId, eventType: event?.type,
          operation: event?.type === NcpEventType.RunMetadata ? "metadata.update" : "event.ingest",
          ...(event ? { runId: readEventRunId(event), messageId: readEventMessageId(event) } : {}),
          ...(payload && "correlationId" in payload ? { correlationId: payload.correlationId } : {}),
          nodeVersion: process.version, platform: process.platform,
          ...readSessionJournalFailureContext(error),
        }, error);
        const endedAt = new Date().toISOString();
        options.eventBus.emit(eventKeys.ncpEvent, {
          type: NcpEventType.RunError, occurredAt: endedAt,
          payload: { sessionId, endedAt, interrupted: true,
            ...(payload && "messageId" in payload ? { messageId: payload.messageId } : {}),
            ...(payload && "runId" in payload ? { runId: payload.runId } : {}),
            ...(payload && "correlationId" in payload ? { correlationId: payload.correlationId } : {}),
            error: error instanceof Error ? error.message : String(error) },
        }, { emittedAt: endedAt, source: SESSION_JOURNAL_FAILURE_SOURCE });
      },
      subscribe: (handler) => options.eventBus.on(eventKeys.ncpEvent, handler),
      updateSessionMetadata: options.updateSessionMetadata,
    });
  }

  start = async (): Promise<void> => await this.ingestion.start();
  dispose = (): void => this.ingestion.dispose();
  flushSession = async (sessionId: string): Promise<void> => await this.ingestion.flushSession(sessionId);
  flush = async (): Promise<void> => await this.ingestion.flush();
  persist = (event: NcpEndpointEvent, signal?: AbortSignal): Promise<void> => this.ingestion.ingestEvent(event, signal);

  loadRunSeed = async (sessionId: string): Promise<NcpMessage[]> => {
    if (!this.options.journalStore.loadSessionRunSeed) throw new Error("This session host does not support bounded run loading.");
    await this.ingestion.flushSession(sessionId);
    return this.options.journalStore.loadSessionRunSeed(sessionId);
  };

  recoverRun = (sessionId: string): Promise<NcpMessage[]> => this.ingestion.recoverSession(sessionId, async () => {
    const store = this.options.journalStore;
    if (!store.loadSessionRunSeed || !store.getSessionSummary) throw new Error("This session host does not support bounded recovery.");
    const state = await store.prepareSessionHistory?.(sessionId, { retry: true, wait: true });
    if (state && state.status !== "ready") throw new Error(state.error ?? "Session history recovery is not ready.");
    if (!await store.getSessionSummary(sessionId)) throw new Error("The saved session is unavailable; its original files were retained.");
    await this.options.appendSessionEvent({ sessionId, event: {
      type: NcpEventType.RunMetadata, occurredAt: new Date().toISOString(),
      payload: { sessionId, metadata: { kind: "session_storage_recovery" } },
    } });
    return store.loadSessionRunSeed(sessionId);
  });

  publish = async (params: PublishSessionEventParams): Promise<void> => {
    const { event, sessionId, source, synchronizeMessageProjection, persistFirst } = params;
    if (persistFirst) {
      await this.ingestion.ingestEvent(event);
      if (synchronizeMessageProjection) {
        await this.options.journalStore.synchronizeSessionMessageProjection(sessionId);
      }
      this.options.eventBus.emit(eventKeys.ncpEvent, event, {
        emittedAt: new Date().toISOString(),
        source: PERSISTED_SESSION_EVENT_SOURCE,
      });
      return;
    }
    this.options.eventBus.emit(eventKeys.ncpEvent, event, {
      emittedAt: new Date().toISOString(),
      source,
    });
    await this.ingestion.flushSession(sessionId);
    if (synchronizeMessageProjection) {
      await this.options.journalStore.synchronizeSessionMessageProjection(sessionId);
    }
  };
}
