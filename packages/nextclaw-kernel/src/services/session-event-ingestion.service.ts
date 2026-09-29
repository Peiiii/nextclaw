import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type { AppEventEnvelope } from "@nextclaw/shared";
import { NcpEventType } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { SessionActivityPreviewEventService } from "@kernel/contributions/session-activity-preview/index.js";
import { readContextCompactionCheckpoint } from "@kernel/features/context-compaction/index.js";
import { CONTEXT_COMPACTION_METADATA_KEY } from "@nextclaw/core";
import type { NcpAgentSessionJournalReplayEvent } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { readEventSessionId } from "@kernel/utils/session-manager.utils.js";
import type { UnfinishedNcpAgentRun } from "@kernel/utils/ncp-agent-unfinished-run.utils.js";
import {
  canCoalesceSessionJournalDeltas,
  coalesceSessionJournalDeltas,
  isSessionJournalDelta,
  SESSION_JOURNAL_DELTA_MAX_AGE_MS,
  SESSION_JOURNAL_DELTA_MAX_BYTES,
} from "@kernel/utils/session-journal-delta-coalescer.utils.js";

const SESSION_METADATA_PATCH_RUN_METADATA_KIND = "session_metadata_patch";
export const PERSISTED_SESSION_EVENT_SOURCE = "session-event-coordinator:persisted";

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
  subscribe: (handler: (event: NcpEndpointEvent, envelope: AppEventEnvelope<NcpEndpointEvent>) => void) => () => void;
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
  private readonly failedWrites = new Map<string, unknown>();
  private readonly pendingDeltas = new Map<string, { event: NcpEndpointEvent; timer: ReturnType<typeof setTimeout> }>();
  private cleanup: (() => void) | null = null;

  constructor(private readonly options: SessionEventIngestionServiceOptions) {
    this.activityPreview = new SessionActivityPreviewEventService({
      getSessionRecord: options.getSessionRecord,
      updateSessionMetadata: options.updateSessionMetadata,
    });
  }

  handleEvent = (event: NcpEndpointEvent, envelope: AppEventEnvelope<NcpEndpointEvent>): void => {
    if (envelope.source === PERSISTED_SESSION_EVENT_SOURCE) return;
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
    this.throwIfFailed(sessionId);
    if (isSessionJournalDelta(event)) {
      const pending = this.pendingDeltas.get(sessionId);
      if (pending && canCoalesceSessionJournalDeltas(pending.event, event)) {
        const merged = coalesceSessionJournalDeltas(pending.event as typeof event, event);
        if (Buffer.byteLength(merged.payload.delta, "utf8") <= SESSION_JOURNAL_DELTA_MAX_BYTES) {
          pending.event = merged;
          if (Buffer.byteLength(merged.payload.delta, "utf8") < SESSION_JOURNAL_DELTA_MAX_BYTES) return;
          await this.flushPendingDelta(sessionId);
          return;
        }
      }
      this.flushPendingDelta(sessionId);
      if (Buffer.byteLength(event.payload.delta, "utf8") >= SESSION_JOURNAL_DELTA_MAX_BYTES) {
        await this.enqueue(sessionId, event);
        return;
      }
      const timer = setTimeout(() => {
        void this.flushPendingDelta(sessionId).catch((error: unknown) => this.options.onError(sessionId, error));
      }, SESSION_JOURNAL_DELTA_MAX_AGE_MS);
      timer.unref?.();
      this.pendingDeltas.set(sessionId, { event: structuredClone(event), timer });
      return;
    }
    this.flushPendingDelta(sessionId);
    await this.enqueue(sessionId, event);
  };

  flushSession = async (sessionId: string): Promise<void> => {
    this.flushPendingDelta(sessionId);
    await this.chains.get(sessionId);
    this.throwIfFailed(sessionId);
  };

  flush = async (): Promise<void> => {
    for (const sessionId of this.pendingDeltas.keys()) this.flushPendingDelta(sessionId);
    await Promise.all([...this.chains.values()]);
    if (this.failedWrites.size > 0) {
      throw new Error("Cannot prepare a restart after a session journal write failed.");
    }
  };

  dispose = (): void => {
    this.cleanup?.();
    this.cleanup = null;
    for (const pending of this.pendingDeltas.values()) clearTimeout(pending.timer);
    this.pendingDeltas.clear();
    this.chains.clear();
    this.failedWrites.clear();
    this.activityPreview.clear();
  };

  private flushPendingDelta = (sessionId: string): Promise<void> => {
    const pending = this.pendingDeltas.get(sessionId);
    if (!pending) return Promise.resolve();
    clearTimeout(pending.timer);
    this.pendingDeltas.delete(sessionId);
    const next = this.enqueue(sessionId, pending.event);
    void next.catch((error: unknown) => this.options.onError(sessionId, error));
    return next;
  };

  private enqueue = (sessionId: string, event: NcpEndpointEvent): Promise<void> => {
    const next = (this.chains.get(sessionId) ?? Promise.resolve()).then(() => {
      this.throwIfFailed(sessionId);
      return this.handleDurableEvent(sessionId, event);
    });
    this.chains.set(sessionId, next.catch((error: unknown) => {
      this.failedWrites.set(sessionId, error);
    }));
    return next;
  };

  private throwIfFailed = (sessionId: string): void => {
    if (this.failedWrites.has(sessionId)) {
      throw new Error(`Session journal write failed for ${sessionId}; refusing further writes until recovery.`, {
        cause: this.failedWrites.get(sessionId),
      });
    }
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
