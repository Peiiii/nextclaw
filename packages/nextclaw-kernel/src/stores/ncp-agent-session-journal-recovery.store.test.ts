import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import {
  NcpAgentSessionJournalStore,
  NcpAgentSessionJournalWriterConflictError,
} from "./ncp-agent-session-journal.store.js";

const sessionId = "session-1";
const userMessage: NcpMessage = {
  id: "user-1",
  sessionId,
  role: "user",
  status: "final",
  parts: [{ type: "text", text: "hello" }],
  timestamp: "2026-05-14T00:00:00.000Z",
};

function createRecord(messages: NcpMessage[]) {
  return {
    sessionId,
    messages,
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:01.000Z",
    metadata: { label: "Journal recovery test" },
  };
}

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("NcpAgentSessionJournalStore recovery", () => {
  it("allows only one runtime writer for a journal directory", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const first = new NcpAgentSessionJournalStore(tempDir);
    const second = new NcpAgentSessionJournalStore(tempDir);

    await first.start();
    await expect(second.start()).rejects.toBeInstanceOf(NcpAgentSessionJournalWriterConflictError);

    await first.dispose();
    await second.start();
    await second.dispose();
  });

  it("ignores an unknown late tool event in an incremental projection tail", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);
    await store.importSessionSnapshot(createRecord([userMessage]));
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageToolCallStart,
        payload: {
          sessionId,
          messageId: "assistant-unknown-tail",
          toolCallId: "tool-unknown-tail",
          toolName: "exec_command",
        },
      },
    });

    await expect(store.listSessionMessagePage({ sessionId, limit: 10 })).resolves.toMatchObject({
      total: 1,
      messages: [{ id: "user-1" }],
    });
  });

  it("does not treat a synthetic interruption as authoritative when the producer continued", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);
    const messageId = "assistant-continued-after-recovery";
    const runId = "run-continued-after-recovery";
    const append = async (event: Parameters<typeof store.appendSessionEvent>[0]["event"]) => {
      await store.appendSessionEvent({ sessionId, event });
    };

    await append({
      type: NcpEventType.RunStarted,
      payload: { sessionId, messageId, runId, startedAt: "2026-05-14T00:00:02.000Z" },
    });
    await append({ type: NcpEventType.MessageTextStart, payload: { sessionId, messageId } });
    await append({ type: NcpEventType.MessageTextDelta, payload: { sessionId, messageId, delta: "before" } });
    await append({
      type: NcpEventType.RunError,
      payload: {
        sessionId,
        messageId,
        runId,
        error: "Run interrupted: the previous runtime stopped.",
        interrupted: true,
      },
    });
    await append({ type: NcpEventType.MessageTextDelta, payload: { sessionId, messageId, delta: " after" } });
    await append({ type: NcpEventType.MessageTextEnd, payload: { sessionId, messageId } });
    await append({
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId,
        messageId,
        toolCallId: "tool-continued-after-recovery",
        toolName: "exec_command",
      },
    });
    await append({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId,
        toolCallId: "tool-continued-after-recovery",
        content: "tool output",
        final: true,
      },
    });
    await append({ type: NcpEventType.RunFinished, payload: { sessionId, messageId, runId, endedAt: "2026-05-14T00:00:05.000Z" } });

    await expect(store.getSession(sessionId)).resolves.toMatchObject({
      messages: [{
        id: messageId,
        role: "assistant",
        status: "final",
        parts: [
          { type: "text", text: "before after" },
          expect.objectContaining({
            type: "tool-invocation",
            toolCallId: "tool-continued-after-recovery",
            state: "result",
            result: "tool output",
          }),
        ],
      }],
    });
  });

  it("does not recreate a terminal assistant from late streaming events", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);
    const assistantId = "assistant-late-event";
    await store.importSessionSnapshot(createRecord([
      userMessage,
      {
        id: assistantId,
        sessionId,
        role: "assistant",
        status: "streaming",
        parts: [{ type: "text", text: "before interruption" }],
        timestamp: "2026-05-14T00:00:02.000Z",
      },
    ]));
    await store.appendSessionEvent({
      sessionId,
      event: {
        occurredAt: "2026-05-14T00:00:03.000Z",
        type: NcpEventType.RunError,
        payload: { sessionId, messageId: assistantId, runId: "run-late-event", error: "interrupted" },
      },
    });
    await store.appendSessionEvent({
      sessionId,
      event: {
        occurredAt: "2026-05-14T00:00:04.000Z",
        type: NcpEventType.MessageToolCallStart,
        payload: {
          sessionId,
          messageId: assistantId,
          toolCallId: "tool-late-event",
          toolName: "exec_command",
        },
      },
    });
    const page = await store.listSessionMessagePage({ sessionId, limit: 10 });
    const assistant = page?.messages.find((message) => message.id === assistantId);
    expect(assistant).toMatchObject({
      id: assistantId,
      status: "error",
      parts: [{ type: "text", text: "before interruption" }],
    });
    expect(assistant?.parts).toHaveLength(1);
  });
});
