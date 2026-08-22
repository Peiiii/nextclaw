import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import { NcpAgentSessionJournalStore } from "./ncp-agent-session-journal.store.js";

const sessionId = "session-compaction-recovery";
let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("NcpAgentSessionJournalStore context compaction recovery", () => {
  it("recovers an orphaned compressing marker from the later run terminal", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId,
          message: {
            id: "context-compaction-orphan",
            sessionId,
            role: "service",
            status: "final",
            timestamp: "2026-08-08T00:00:00.000Z",
            parts: [{ type: "text", text: "Compressing earlier context" }],
            metadata: {
              nextclaw_timeline_kind: "context_compaction",
              checkpoint: {
                version: 1,
                id: "ctx-orphan",
                status: "compressing",
                summary: "Compressing earlier context for the next model request.",
                coveredMessageCount: 10,
                coveredSessionMessageCount: 10,
                originalEstimatedTokens: 30_000,
                projectedEstimatedTokens: 29_000,
                createdAt: "2026-08-08T00:00:00.000Z",
                updatedAt: "2026-08-08T00:00:00.000Z",
              },
            },
          },
        },
      },
    });
    await store.listSessionMessagePage({ sessionId, limit: 10 });
    await store.appendSessionEvent({
      sessionId,
      event: {
        occurredAt: "2026-08-08T00:00:01.000Z",
        type: NcpEventType.MessageAbort,
        payload: {
          sessionId,
          messageId: "assistant-1",
          runId: "run-1",
        },
      },
    });

    const page = await store.listSessionMessagePage({ sessionId, limit: 10 });

    expect(page?.messages).toEqual([
      expect.objectContaining({
        id: "context-compaction-orphan",
        metadata: expect.objectContaining({
          checkpoint: expect.objectContaining({
            status: "cancelled",
            updatedAt: "2026-08-08T00:00:01.000Z",
          }),
        }),
        parts: [{ type: "text", text: "Context compaction was cancelled" }],
      }),
    ]);
  });

  it("only recovers the compaction marker linked to a terminal run", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);
    const createMarker = (messageId: string, continuationMessageId: string) => ({
      id: messageId,
      sessionId,
      role: "service" as const,
      status: "final" as const,
      timestamp: "2026-08-08T00:00:00.000Z",
      parts: [{ type: "text" as const, text: "Compressing earlier context" }],
      metadata: {
        nextclaw_timeline_kind: "context_compaction",
        checkpoint: {
          version: 1,
          id: messageId,
          status: "compressing" as const,
          summary: "Compressing earlier context for the next model request.",
          continuationMessageId,
          coveredMessageCount: 10,
          coveredSessionMessageCount: 10,
          originalEstimatedTokens: 30_000,
          projectedEstimatedTokens: 29_000,
          createdAt: "2026-08-08T00:00:00.000Z",
          updatedAt: "2026-08-08T00:00:00.000Z",
        },
      },
    });

    for (const message of [
      createMarker("context-compaction-1", "assistant-1"),
      createMarker("context-compaction-2", "assistant-2"),
    ]) {
      await store.appendSessionEvent({
        sessionId,
        event: { type: NcpEventType.MessageSent, payload: { sessionId, message } },
      });
    }
    await store.appendSessionEvent({
      sessionId,
      event: {
        occurredAt: "2026-08-08T00:00:01.000Z",
        type: NcpEventType.RunError,
        payload: {
          sessionId,
          messageId: "assistant-1",
          runId: "run-1",
          error: "first run failed",
        },
      },
    });

    const page = await store.listSessionMessagePage({ sessionId, limit: 10 });

    expect(page?.messages).toEqual([
      expect.objectContaining({
        id: "context-compaction-1",
        metadata: expect.objectContaining({
          checkpoint: expect.objectContaining({ status: "failed" }),
        }),
        parts: [{ type: "text", text: "Context compaction failed" }],
      }),
      expect.objectContaining({
        id: "context-compaction-2",
        metadata: expect.objectContaining({
          checkpoint: expect.objectContaining({ status: "compressing" }),
        }),
        parts: [{ type: "text", text: "Compressing earlier context" }],
      }),
    ]);
  });
});
