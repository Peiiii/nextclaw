import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import type { EventBus } from "@nextclaw/shared";
import { eventKeys } from "@nextclaw/shared";
import type { SessionPersistence } from "@kernel/types/session.types.js";
import type { NcpAgentSessionJournalReplayEvent } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { UnfinishedNcpAgentRun } from "@kernel/utils/ncp-agent-unfinished-run.utils.js";
import { PERSISTED_SESSION_EVENT_SOURCE, SessionEventIngestionService } from "./session-event-ingestion.service.js";

type SessionEventCoordinatorServiceOptions = {
  appendSessionEvent: (params: {
    sessionId: string;
    event: NcpAgentSessionJournalReplayEvent;
  }) => Promise<void>;
  eventBus: EventBus;
  getSessionRecord: (sessionId: string) => Promise<AgentSessionRecord | null>;
  journalStore: Pick<SessionPersistence, "synchronizeSessionMessageProjection">;
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
      onError: (sessionId, error) => {
        const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
        console.error(`[session-manager] failed to handle ncp event for ${sessionId}: ${detail}`);
      },
      subscribe: (handler) => options.eventBus.on(eventKeys.ncpEvent, handler),
      updateSessionMetadata: options.updateSessionMetadata,
    });
  }

  start = async (): Promise<void> => await this.ingestion.start();
  dispose = (): void => this.ingestion.dispose();
  flushSession = async (sessionId: string): Promise<void> => await this.ingestion.flushSession(sessionId);
  flush = async (): Promise<void> => await this.ingestion.flush();

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
