import { describe, expect, it, vi } from "vitest";
import { CONTEXT_COMPACTION_METADATA_KEY, type ContextCompactionCheckpoint } from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import type { AppEventEnvelope } from "@nextclaw/shared";
import { buildContextCompactionTimelineNcpMessage } from "@kernel/features/context-compaction/index.js";
import { SessionEventIngestionService } from "@kernel/services/session-event-ingestion.service.js";
import { replayNcpAgentSessionEvents } from "@kernel/utils/ncp-agent-session-replay.utils.js";

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

describe("SessionEventIngestionService failure isolation", () => {
  it.each(["CONTEXT_COMPACTION_STALE", "AbortError"])("does not latch an intentionally rejected commit: %s", async code => {
    const rejection = Object.assign(new Error("safely rejected"), { code, journalCommitRejected: true });
    const appendSessionEvent = vi.fn().mockRejectedValueOnce(rejection).mockResolvedValue(undefined);
    const onError = vi.fn();
    const service = new SessionEventIngestionService({ appendSessionEvent,
      getSessionRecord: async () => null, listUnfinishedRuns: async () => [], onError,
      subscribe: () => () => undefined, updateSessionMetadata: async () => true });
    try {
      await expect(service.ingestEvent(createMarkerEvent("compressing"))).rejects.toBe(rejection);
      await expect(service.ingestEvent(createMarkerEvent("cancelled"))).resolves.toBeUndefined();
      await expect(service.flushSession(SESSION_ID)).resolves.toBeUndefined();
      expect(onError).not.toHaveBeenCalled();
    } finally { service.dispose(); }
  });

  it("retains the first metadata JSON cause and isolates a healthy session", async () => {
    const cause = new SyntaxError("Unexpected token in session metadata JSON");
    const updateSessionMetadata = vi.fn().mockRejectedValueOnce(cause).mockResolvedValue(true);
    const onError = vi.fn();
    const appendSessionEvent = vi.fn(async () => undefined);
    const service = new SessionEventIngestionService({ appendSessionEvent,
      getSessionRecord: async () => null, listUnfinishedRuns: async () => [], onError,
      subscribe: () => () => undefined, updateSessionMetadata });
    try {
      const patch: NcpEndpointEvent = { type: NcpEventType.RunMetadata, payload: { sessionId: SESSION_ID,
        metadata: { kind: "session_metadata_patch", sessionMetadataPatch: { fixture: true } } } };
      await expect(service.ingestEvent(patch)).rejects.toMatchObject({ code: "SESSION_JOURNAL_WRITE_FAILED", cause });
      const first = onError.mock.calls[0]?.[1];
      await expect(service.ingestEvent(createMarkerEvent("failed"))).rejects.toBe(first);
      await expect(service.flushSession(SESSION_ID)).rejects.toBe(first);
      expect(onError).toHaveBeenCalledOnce();
      await expect(service.ingestEvent({ type: NcpEventType.RunStarted, payload: { sessionId: "healthy", runId: "healthy-run" } })).resolves.toBeUndefined();
      expect(appendSessionEvent).toHaveBeenCalledOnce();
    } finally { service.dispose(); }
  });

});

describe("SessionEventIngestionService context compaction", () => {
  it("refuses later writes and restart flush after a failed durable write", async () => {
    const appendSessionEvent = vi.fn().mockRejectedValueOnce(new Error("disk full")).mockResolvedValue(undefined);
    const service = new SessionEventIngestionService({
      appendSessionEvent, getSessionRecord: async () => null, listUnfinishedRuns: async () => [],
      onError: vi.fn(), subscribe: () => () => undefined, updateSessionMetadata: async () => true,
    });
    await expect(service.ingestEvent(createMarkerEvent("compressing"))).rejects.toThrow("disk full");
    await expect(service.ingestEvent(createMarkerEvent("failed"))).rejects.toThrow("refusing further writes");
    expect(appendSessionEvent).toHaveBeenCalledTimes(1);
    await expect(service.flushSession(SESSION_ID)).rejects.toThrow("refusing further writes");
    await expect(service.flushSession("unaffected-session")).resolves.toBeUndefined();
    await expect(service.flush()).rejects.toThrow("session journal write failed");
    service.dispose();
  });

  it("coalesces only adjacent matching deltas and flushes before every boundary", async () => {
    const events: NcpEndpointEvent[] = [];
    const service = new SessionEventIngestionService({
      appendSessionEvent: async ({ event }) => { events.push(event as NcpEndpointEvent); },
      getSessionRecord: async () => null, listUnfinishedRuns: async () => [],
      onError: vi.fn(), subscribe: () => () => undefined, updateSessionMetadata: async () => true,
    });
    const delta = (value: string, messageId = "assistant-1"): NcpEndpointEvent => ({
      occurredAt: "2026-09-29T00:00:00.000Z",
      type: NcpEventType.MessageReasoningDelta,
      payload: { sessionId: SESSION_ID, messageId, delta: value },
    });
    await service.ingestEvent(delta("思"));
    await service.ingestEvent(delta("考"));
    await service.ingestEvent(delta("B", "assistant-2"));
    await service.ingestEvent(createMarkerEvent("compressing"));
    await service.flushSession(SESSION_ID);
    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageReasoningDelta,
      NcpEventType.MessageReasoningDelta,
      NcpEventType.MessageSent,
    ]);
    expect(events[0]?.payload).toMatchObject({ messageId: "assistant-1", delta: "思考" });
    expect(events[1]?.payload).toMatchObject({ messageId: "assistant-2", delta: "B" });
    service.dispose();
  });

  it("preserves replayed reasoning and tool arguments after online coalescing", async () => {
    const persisted: NcpEndpointEvent[] = [];
    const service = new SessionEventIngestionService({
      appendSessionEvent: async ({ event }) => { persisted.push(event as NcpEndpointEvent); },
      getSessionRecord: async () => null, listUnfinishedRuns: async () => [],
      onError: vi.fn(), subscribe: () => () => undefined, updateSessionMetadata: async () => true,
    });
    const payload = { sessionId: SESSION_ID, messageId: "assistant-1" };
    const raw: NcpEndpointEvent[] = [
      { type: NcpEventType.MessageReasoningStart, payload },
      { type: NcpEventType.MessageReasoningDelta, payload: { ...payload, delta: "先" } },
      { type: NcpEventType.MessageReasoningDelta, payload: { ...payload, delta: "想" } },
      { type: NcpEventType.MessageReasoningEnd, payload },
      { type: NcpEventType.MessageToolCallStart, payload: { ...payload, toolCallId: "tool-1", toolName: "exec" } },
      { type: NcpEventType.MessageToolCallArgsDelta, payload: { ...payload, toolCallId: "tool-1", delta: "{\"x\":" } },
      { type: NcpEventType.MessageToolCallArgsDelta, payload: { ...payload, toolCallId: "tool-1", delta: "1}" } },
      { type: NcpEventType.MessageToolCallEnd, payload: { sessionId: SESSION_ID, toolCallId: "tool-1" } },
    ];
    const timed = raw.map((event, index) => ({ ...event, occurredAt: `2026-09-29T00:00:0${index}.000Z` }));
    for (const event of timed) await service.ingestEvent(event);
    await service.flushSession(SESSION_ID);
    expect(persisted).toHaveLength(raw.length - 2);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-09-29T00:00:10.000Z"));
      expect(await replayNcpAgentSessionEvents(persisted))
        .toEqual(await replayNcpAgentSessionEvents(timed));
    } finally { vi.useRealTimers(); }
    service.dispose();
  });

  it("flushes a pending delta after the 100 ms age limit", async () => {
    vi.useFakeTimers();
    try {
      const appendSessionEvent = vi.fn(async () => undefined);
      const service = new SessionEventIngestionService({
        appendSessionEvent, getSessionRecord: async () => null, listUnfinishedRuns: async () => [],
        onError: vi.fn(), subscribe: () => () => undefined, updateSessionMetadata: async () => true,
      });
      await service.ingestEvent({
        type: NcpEventType.MessageTextDelta,
        payload: { sessionId: SESSION_ID, messageId: "assistant-1", delta: "a" },
      });
      expect(appendSessionEvent).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(100);
      await service.flushSession(SESSION_ID);
      expect(appendSessionEvent).toHaveBeenCalledTimes(1);
      service.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps pending chunks isolated when two sessions interleave", async () => {
    const recorded: Array<{ sessionId: string; delta: string }> = [];
    const service = new SessionEventIngestionService({
      appendSessionEvent: async ({ sessionId, event }) => {
        if (event.type === NcpEventType.MessageTextDelta) recorded.push({ sessionId, delta: event.payload.delta });
      },
      getSessionRecord: async () => null, listUnfinishedRuns: async () => [],
      onError: vi.fn(), subscribe: () => () => undefined, updateSessionMetadata: async () => true,
    });
    const delta = (sessionId: string, value: string): NcpEndpointEvent => ({
      type: NcpEventType.MessageTextDelta,
      payload: { sessionId, messageId: "assistant-1", delta: value },
    });
    await service.ingestEvent(delta("session-a", "a"));
    await service.ingestEvent(delta("session-b", "x"));
    await service.ingestEvent(delta("session-a", "b"));
    await service.ingestEvent(delta("session-b", "y"));
    await service.flush();
    expect(recorded).toEqual([
      { sessionId: "session-a", delta: "ab" },
      { sessionId: "session-b", delta: "xy" },
    ]);
    service.dispose();
  });

  it("flushes the durable chain before a session owner deletes its files", async () => {
    let subscribed: ((event: NcpEndpointEvent, envelope: AppEventEnvelope<NcpEndpointEvent>) => void) | null = null;
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
    const handler = subscribed as ((event: NcpEndpointEvent, envelope: AppEventEnvelope<NcpEndpointEvent>) => void) | null;
    expect(handler).not.toBeNull();
    const event = createMarkerEvent("compressing");
    handler?.(event, { type: "ncp.event", payload: event });

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
