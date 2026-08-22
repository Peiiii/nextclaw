import { describe, expect, it, vi } from "vitest";
import { CONTEXT_COMPACTION_METADATA_KEY, type ContextCompactionCheckpoint } from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import { buildContextCompactionTimelineNcpMessage } from "@kernel/features/context-compaction/index.js";
import { SessionEventIngestionService } from "@kernel/services/session-event-ingestion.service.js";

const SESSION_ID = "session-context-compaction-ingestion";

function createCheckpoint(status: ContextCompactionCheckpoint["status"]): ContextCompactionCheckpoint {
  return {
    version: 1,
    id: "ctx-ingestion",
    status,
    summary: "# Compressed Working Context\n\n## Continuation Contract\nContinue.",
    coveredMessageCount: 12,
    coveredSessionMessageCount: 12,
    originalEstimatedTokens: 30_000,
    projectedEstimatedTokens: 20_000,
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:01.000Z",
  };
}

function createMarkerEvent(status: ContextCompactionCheckpoint["status"]): NcpEndpointEvent {
  return {
    occurredAt: "2026-08-08T00:00:01.000Z",
    type: NcpEventType.MessageSent,
    payload: {
      sessionId: SESSION_ID,
      message: buildContextCompactionTimelineNcpMessage({
        checkpoint: createCheckpoint(status),
        messageId: "context-compaction-message-ingestion",
        sessionId: SESSION_ID,
      }),
    },
  };
}

describe("SessionEventIngestionService context compaction", () => {
  it("flushes the durable chain before a session owner deletes its files", async () => {
    let subscribed: ((event: NcpEndpointEvent) => void) | null = null;
    let releaseAppend: (() => void) | null = null;
    const appendSessionEvent = vi.fn(() => new Promise<void>((resolve) => {
      releaseAppend = resolve;
    }));
    const service = new SessionEventIngestionService({
      appendSessionEvent,
      getSessionRecord: async () => null,
      listUnfinishedRuns: async () => [],
      onError: vi.fn(),
      subscribe: (handler) => {
        subscribed = handler;
        return () => undefined;
      },
      updateSessionMetadata: async () => true,
    });
    await service.start();
    const handler = subscribed as ((event: NcpEndpointEvent) => void) | null;
    expect(handler).not.toBeNull();
    handler?.(createMarkerEvent("compressing"));

    let flushed = false;
    const flush = service.flushSession(SESSION_ID).then(() => {
      flushed = true;
    });
    await Promise.resolve();
    expect(flushed).toBe(false);
    releaseAppend?.();
    await flush;
    expect(flushed).toBe(true);
  });

  it("appends the completed marker before projecting checkpoint metadata", async () => {
    const operations: string[] = [];
    const appendSessionEvent = vi.fn(async () => {
      operations.push("journal");
    });
    const updateSessionMetadata = vi.fn(async () => {
      operations.push("metadata");
      return true;
    });
    const service = new SessionEventIngestionService({
      appendSessionEvent,
      getSessionRecord: async () => null,
      listUnfinishedRuns: async () => [],
      onError: vi.fn(),
      subscribe: () => () => undefined,
      updateSessionMetadata,
    });

    await service.ingestEvent(createMarkerEvent("compressed"));

    expect(operations).toEqual(["journal", "metadata"]);
    expect(updateSessionMetadata).toHaveBeenCalledWith(SESSION_ID, {
      [CONTEXT_COMPACTION_METADATA_KEY]: expect.objectContaining({
        id: "ctx-ingestion",
        status: "compressed",
      }),
    });
  });

  it("persists transient and failed markers without installing either as a checkpoint", async () => {
    const appendSessionEvent = vi.fn(async () => undefined);
    const updateSessionMetadata = vi.fn(async () => true);
    const service = new SessionEventIngestionService({
      appendSessionEvent,
      getSessionRecord: async () => null,
      listUnfinishedRuns: async () => [],
      onError: vi.fn(),
      subscribe: () => () => undefined,
      updateSessionMetadata,
    });

    await service.ingestEvent(createMarkerEvent("compressing"));
    await service.ingestEvent(createMarkerEvent("failed"));

    expect(appendSessionEvent).toHaveBeenCalledTimes(2);
    expect(updateSessionMetadata).not.toHaveBeenCalled();
  });
});
