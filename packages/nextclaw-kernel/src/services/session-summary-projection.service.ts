import type { AgentContextWindowManager } from "@kernel/managers/agent-context-window.manager.js";
import type { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { createNcpAgentSessionSummary } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { SessionWorkingDirResolver } from "@kernel/services/session-working-dir-resolver.service.js";
import type { SessionSearchService } from "@nextclaw/core";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { eventKeys, type EventBus } from "@nextclaw/shared";

export type SessionSummaryProjectionServiceOptions = {
  agentContextWindowManager: AgentContextWindowManager;
  eventBus: EventBus;
  getSessionRecord: (sessionId: string) => Promise<AgentSessionRecord | null>;
  journalStore: NcpAgentSessionJournalStore;
  sessionSearch: SessionSearchService;
  workingDirResolver: SessionWorkingDirResolver;
};

export class SessionSummaryProjectionService {
  constructor(
    private readonly options: SessionSummaryProjectionServiceOptions,
  ) {}

  createWithContextWindow = async (
    record: AgentSessionRecord,
  ): Promise<NcpSessionSummary> => {
    const summary = this.options.workingDirResolver.withWorkingDir(
      createNcpAgentSessionSummary(record),
    );
    const contextWindow =
      await this.options.agentContextWindowManager.previewSession({
        requestMetadata: record.metadata ?? {},
        sessionId: record.sessionId,
        sessionMessages: record.messages,
        storedAgentId: record.agentId,
        storedMetadata: record.metadata ?? {},
      });
    return contextWindow ? { ...summary, contextWindow } : summary;
  };

  publishChange = async (sessionKey: string): Promise<void> => {
    this.options.eventBus.emit(
      eventKeys.sessionUpdated,
      { sessionKey },
      {
        emittedAt: new Date().toISOString(),
        source: "ncp-session",
      },
    );
    await this.options.sessionSearch.handleSessionUpdated(sessionKey);
    const record = await this.options.getSessionRecord(sessionKey);
    if (!record) {
      this.options.eventBus.emit(eventKeys.sessionSummaryDelete, {
        sessionKey,
      });
      return;
    }
    const summary = await this.createWithContextWindow(record);
    await this.options.journalStore.updateSessionMessageProjectionContextWindow(
      sessionKey,
      summary.contextWindow ?? null,
    );
    this.options.eventBus.emit(eventKeys.sessionSummaryUpsert, { summary });
  };
}
