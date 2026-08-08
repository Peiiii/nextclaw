import type { NcpEndpointEvent } from "@nextclaw/ncp";
import { NcpEventType } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { SessionActivityPreviewEventService } from "@kernel/contributions/session-activity-preview/index.js";
import { readContextCompactionCheckpoint } from "@kernel/features/context-compaction/index.js";
import { CONTEXT_COMPACTION_METADATA_KEY } from "@nextclaw/core";
import type { NcpAgentSessionJournalReplayEvent } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { readEventSessionId } from "@kernel/utils/session-manager.utils.js";
import type { UnfinishedNcpAgentRun } from "@kernel/utils/ncp-agent-unfinished-run.utils.js";

const SESSION_METADATA_PATCH_RUN_METADATA_KIND = "session_metadata_patch";

type SessionEventIngestionServiceOptions = {
  appendSessionEvent: (params: {
    sessionId: string;
    event: NcpAgentSessionJournalReplayEvent;
  }) => Promise<void>;
  getSessionRecord: (sessionId: string) => Promise<AgentSessionRecord | null>;
  listUnfinishedRuns: () => Promise<UnfinishedNcpAgentRun[]>;
  onError: (sessionId: string, error: unknown) => void;
  updateSessionMetadata: (
    sessionId: string,
    metadata: Record<string, unknown>,
  ) => Promise<boolean>;
  subscribe: (handler: (event: NcpEndpointEvent) => void) => () => void;
};

function isDurableSessionEvent(event: NcpEndpointEvent): boolean {
  return event.type !== NcpEventType.ContextWindowUpdated;
}

function readRuntimeSessionMetadataPatch(
  event: NcpEndpointEvent,
): Record<string, unknown> | null {
  if (event.type !== NcpEventType.RunMetadata) {
    return null;
  }
  const metadata = event.payload.metadata;
  if (
    metadata.kind !== SESSION_METADATA_PATCH_RUN_METADATA_KIND ||
    !metadata.sessionMetadataPatch ||
    typeof metadata.sessionMetadataPatch !== "object" ||
    Array.isArray(metadata.sessionMetadataPatch)
  ) {
    return null;
  }
  const patch = metadata.sessionMetadataPatch as Record<string, unknown>;
  return Object.keys(patch).length > 0 ? structuredClone(patch) : null;
}

export class SessionEventIngestionService {
  private readonly activityPreview: SessionActivityPreviewEventService;
  private readonly chains = new Map<string, Promise<void>>();
  private cleanup: (() => void) | null = null;

  constructor(private readonly options: SessionEventIngestionServiceOptions) {
    this.activityPreview = new SessionActivityPreviewEventService({
      getSessionRecord: options.getSessionRecord,
      updateSessionMetadata: options.updateSessionMetadata,
    });
  }

  handleEvent = (event: NcpEndpointEvent): void => {
    void this.ingestEvent(event).catch((error: unknown) => {
      const sessionId = readEventSessionId(event);
      if (sessionId) {
        this.options.onError(sessionId, error);
      }
    });
  };

  start = async (): Promise<void> => {
    if (this.cleanup) {
      return;
    }
    this.cleanup = this.options.subscribe(this.handleEvent);
    const endedAt = new Date().toISOString();
    for (const run of await this.options.listUnfinishedRuns()) {
      await this.ingestEvent({
        occurredAt: endedAt,
        type: NcpEventType.RunError,
        payload: {
          sessionId: run.sessionId,
          messageId: run.messageId,
          runId: run.runId,
          startedAt: run.startedAt,
          endedAt,
          error: "Run interrupted: the previous NextClaw runtime stopped before a terminal event was recorded.",
          interrupted: true,
        },
      });
    }
  };

  ingestEvent = async (event: NcpEndpointEvent): Promise<void> => {
    const sessionId = readEventSessionId(event);
    if (!sessionId || !isDurableSessionEvent(event)) {
      return;
    }
    const next = (this.chains.get(sessionId) ?? Promise.resolve())
      .then(() => this.handleDurableEvent(sessionId, event));
    this.chains.set(sessionId, next.catch(() => undefined));
    await next;
  };

  dispose = (): void => {
    this.cleanup?.();
    this.cleanup = null;
    this.chains.clear();
    this.activityPreview.clear();
  };

  private handleDurableEvent = async (
    sessionId: string,
    event: NcpEndpointEvent,
  ): Promise<void> => {
    const preview = this.activityPreview.projectEvent(event, new Date().toISOString());
    const metadataPatch = readRuntimeSessionMetadataPatch(event);
    if (metadataPatch) {
      await this.options.updateSessionMetadata(sessionId, metadataPatch);
      return;
    }
    await this.options.appendSessionEvent({
      event: event as NcpAgentSessionJournalReplayEvent,
      sessionId,
    });
    if (event.type === NcpEventType.MessageSent) {
      const checkpoint = readContextCompactionCheckpoint(event.payload.message);
      if (checkpoint) {
        await this.options.updateSessionMetadata(sessionId, {
          [CONTEXT_COMPACTION_METADATA_KEY]: checkpoint,
        });
      }
    }
    if (preview) {
      await this.activityPreview.updatePreview(preview);
    }
  };
}
