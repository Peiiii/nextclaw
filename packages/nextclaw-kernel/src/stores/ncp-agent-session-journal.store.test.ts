import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import { NcpAgentSessionJournalStore } from "./ncp-agent-session-journal.store.js";

const sessionId = "session-1";
const userMessage: NcpMessage = {
  id: "user-1",
  sessionId,
  role: "user",
  status: "final",
  parts: [{ type: "text", text: "hello" }],
  timestamp: "2026-05-14T00:00:00.000Z",
};
const assistantMessage: NcpMessage = {
  id: "assistant-1",
  sessionId,
  role: "assistant",
  status: "final",
  parts: [{ type: "text", text: "hi" }],
  timestamp: "2026-05-14T00:00:02.000Z",
};

type RawJournalLine = {
  _type: string;
  event?: {
    type: string;
  };
};

function createRecord(messages: NcpMessage[]) {
  return {
    sessionId,
    messages,
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:01.000Z",
    metadata: { label: "Journal test" },
  };
}

async function readJournalEventTypes(journalDir: string): Promise<string[]> {
  const raw = await readFile(join(journalDir, `${sessionId}.jsonl`), "utf-8");
  return raw
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as RawJournalLine)
    .filter((entry) => entry._type === "event")
    .map((entry) => entry.event?.type ?? "");
}

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("NcpAgentSessionJournalStore", () => {
  it("replays half-written streaming assistant messages from append-only events", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);

    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId,
          message: userMessage,
        },
      },
    });
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageTextStart,
        payload: {
          sessionId,
          messageId: "assistant-1",
        },
      },
    });
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageTextDelta,
        payload: {
          sessionId,
          messageId: "assistant-1",
          delta: "hel",
        },
      },
    });

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const messages = await reloaded.listSessionMessages(sessionId);
    const summaries = await reloaded.listSessionSummaries();

    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      id: "assistant-1",
      role: "assistant",
      status: "streaming",
      parts: [{ type: "text", text: "hel" }],
    });
    expect(summaries[0]).toMatchObject({
      sessionId,
      messageCount: 2,
      lastMessageAt: userMessage.timestamp,
    });
    expect(summaries[0]?.metadata).toBeUndefined();
  });

  it("keeps journal timestamps for orphaned streaming messages during replay", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const journalPath = join(tempDir, `${sessionId}.jsonl`);
    await writeFile(
      journalPath,
      [
        {
          _type: "event",
          version: 1,
          seq: 1,
          timestamp: "2026-05-14T00:00:01.000Z",
          event: {
            type: NcpEventType.MessageReasoningDelta,
            payload: {
              sessionId,
              messageId: "assistant-orphan",
              delta: "thinking",
            },
          },
        },
        {
          _type: "event",
          version: 1,
          seq: 2,
          timestamp: "2026-05-14T00:00:02.000Z",
          event: {
            type: NcpEventType.MessageAbort,
            payload: {
              sessionId,
              messageId: "assistant-orphan",
            },
          },
        },
      ].map((entry) => JSON.stringify(entry)).join("\n") + "\n",
      "utf-8",
    );

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const messages = await reloaded.listSessionMessages(sessionId);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: "assistant-orphan",
      status: "final",
      timestamp: "2026-05-14T00:00:01.000Z",
    });
  });

  it("materializes legacy records so historical history survives reload", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);

    await store.importSessionSnapshot(createRecord([userMessage, assistantMessage]));

    const eventTypes = await readJournalEventTypes(tempDir);

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const messages = await reloaded.listSessionMessages(sessionId);
    const summaries = await reloaded.listSessionSummaries();

    expect(eventTypes).toEqual([
      NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE,
      NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE,
    ]);
    expect(eventTypes).not.toContain(NcpEventType.MessageSent);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: "user",
      parts: [{ type: "text", text: "hello" }],
    });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      parts: [{ type: "text", text: "hi" }],
    });
    expect(summaries[0]).toMatchObject({
      sessionId,
      messageCount: 2,
      metadata: { label: "Journal test" },
    });
  });
});

describe("NcpAgentSessionJournalStore metadata recovery", () => {
  it("recovers assistant snapshot history that was written with a draft status", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);

    await store.importSessionSnapshot(createRecord([
      {
        id: "assistant-1",
        sessionId,
        role: "assistant",
        status: "pending",
        parts: [{ type: "text", text: "already done" }],
        timestamp: "2026-05-14T00:00:02.000Z",
      },
    ]));

    const eventTypes = await readJournalEventTypes(tempDir);
    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const messages = await reloaded.listSessionMessages(sessionId);

    expect(eventTypes).toEqual([NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE]);
    expect(eventTypes).not.toContain(NcpEventType.MessageSent);
    expect(messages[0]).toMatchObject({
      id: "assistant-1",
      status: "final",
      parts: [{ type: "text", text: "already done" }],
    });
  });

  it("recovers legacy assistant message.sent history that was written with a draft status", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);

    await store.importSessionSnapshot(createRecord([]));

    const journalPath = join(tempDir, `${sessionId}.jsonl`);
    const raw = await readFile(journalPath, "utf-8");
    await writeFile(
      journalPath,
      raw + JSON.stringify({
        _type: "event",
        version: 1,
        seq: 1,
        timestamp: "2026-05-14T00:00:02.000Z",
        event: {
          type: NcpEventType.MessageSent,
          payload: {
            sessionId,
            message: {
              id: "assistant-1",
              sessionId,
              role: "assistant",
              status: "pending",
              parts: [{ type: "text", text: "already done" }],
              timestamp: "2026-05-14T00:00:02.000Z",
            },
          },
        },
      }) + "\n",
      "utf-8",
    );

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const messages = await reloaded.listSessionMessages(sessionId);

    expect(messages[0]).toMatchObject({
      id: "assistant-1",
      status: "final",
      parts: [{ type: "text", text: "already done" }],
    });
  });

  it("expands legacy context compaction marker ids during replay", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const journalPath = join(tempDir, `${sessionId}.jsonl`);
    const legacyMessageId = `${sessionId}:service:context-compaction:ctx-1`;
    await writeFile(
      journalPath,
      [10, 20].map((coveredCount, index) => JSON.stringify({
        _type: "event",
        version: 1,
        seq: index + 1,
        timestamp: `2026-05-14T00:00:0${index + 1}.000Z`,
        event: {
          type: NcpEventType.MessageSent,
          payload: {
            sessionId,
            message: {
              id: legacyMessageId,
              sessionId,
              role: "service",
              status: "final",
              timestamp: `2026-05-14T00:00:0${index + 1}.000Z`,
              parts: [{ type: "text", text: "Earlier context was auto-compacted" }],
              metadata: {
                nextclaw_timeline_kind: "context_compaction",
                checkpoint: {
                  version: 1,
                  id: "ctx-1",
                  status: "compressed",
                  summary: `summary ${coveredCount}`,
                  coveredMessageCount: coveredCount,
                  coveredSessionMessageCount: coveredCount,
                  originalEstimatedTokens: 100,
                  projectedEstimatedTokens: 10,
                  createdAt: "2026-05-14T00:00:00.000Z",
                  updatedAt: `2026-05-14T00:00:0${index + 1}.000Z`,
                },
              },
            },
          },
        },
      })).join("\n") + "\n",
      "utf-8",
    );

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const messages = await reloaded.listSessionMessages(sessionId);

    expect(messages.map((message) => message.id)).toEqual([
      `${legacyMessageId}:10`,
      `${legacyMessageId}:20`,
    ]);
  });

  it("skips corrupted journal lines without losing later valid events", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);

    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId,
          message: userMessage,
        },
      },
    });

    const journalPath = join(tempDir, `${sessionId}.jsonl`);
    const raw = await readFile(journalPath, "utf-8");
    await writeFile(
      journalPath,
      [
        raw.trimEnd(),
        '\\n            <div class="bdsharebuttonbox">bad html</div>',
        JSON.stringify({
          _type: "event",
          version: 1,
          seq: 2,
          timestamp: "2026-05-14T00:00:02.000Z",
          event: {
            type: NcpEventType.MessageTextStart,
            payload: {
              sessionId,
              messageId: "assistant-1",
            },
          },
        }),
        JSON.stringify({
          _type: "event",
          version: 1,
          seq: 3,
          timestamp: "2026-05-14T00:00:03.000Z",
          event: {
            type: NcpEventType.MessageTextDelta,
            payload: {
              sessionId,
              messageId: "assistant-1",
              delta: "hi",
            },
          },
        }),
      ].join("\n") + "\n",
      "utf-8",
    );

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const session = await reloaded.getSession(sessionId);
    const messages = await reloaded.listSessionMessages(sessionId);
    const summaries = await reloaded.listSessionSummaries();

    expect(session?.metadata).toEqual({});
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user" });
    expect(messages[1]).toMatchObject({
      id: "assistant-1",
      status: "streaming",
      parts: [{ type: "text", text: "hi" }],
    });
    expect(summaries[0]?.lastMessageAt).toBe(userMessage.timestamp);
  });

  it("writes fetched html payloads as one valid JSONL line", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);
    const html = "\n            \r\n            <div class=\"bdsharebuttonbox\">bad html</div>";

    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageCompleted,
        payload: {
          sessionId,
          message: {
            id: "assistant-1",
            sessionId,
            role: "assistant",
            status: "final",
            timestamp: "2026-05-14T00:00:02.000Z",
            parts: [
              {
                type: "tool-invocation",
                toolCallId: "tool-1",
                toolName: "web_fetch",
                state: "result",
                args: { url: "https://example.com" },
                result: html,
              },
            ],
          },
        },
      },
    });

    const raw = await readFile(join(tempDir, `${sessionId}.jsonl`), "utf-8");
    const lines = raw.split("\n").filter((line) => line.trim());

    expect(lines).toHaveLength(1);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

});

describe("NcpAgentSessionJournalStore tool result replay", () => {
  it("does not let stale completed snapshots downgrade replayed tool results", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);

    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageToolCallStart,
        payload: {
          sessionId,
          messageId: "assistant-1",
          toolCallId: "tool-1",
          toolName: "Bash",
        },
      },
    });
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageToolCallEnd,
        payload: {
          sessionId,
          toolCallId: "tool-1",
        },
      },
    });
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageToolCallResult,
        payload: {
          sessionId,
          toolCallId: "tool-1",
          content: "pwd output",
        },
      },
    });
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageCompleted,
        payload: {
          sessionId,
          message: {
            id: "assistant-1",
            sessionId,
            role: "assistant",
            status: "final",
            timestamp: "2026-05-14T00:00:02.000Z",
            parts: [
              {
                type: "tool-invocation",
                toolCallId: "tool-1",
                toolName: "Bash",
                state: "call",
                args: { command: "pwd" },
              },
            ],
          },
        },
      },
    });
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.RunFinished,
        payload: {
          sessionId,
          messageId: "assistant-1",
          runId: "run-1",
        },
      },
    });

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const messages = await reloaded.listSessionMessages(sessionId);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: "assistant-1",
      status: "final",
      parts: [
        {
          type: "tool-invocation",
          toolCallId: "tool-1",
          toolName: "Bash",
          state: "result",
          args: { command: "pwd" },
          result: "pwd output",
        },
      ],
    });
  });
});

describe("NcpAgentSessionJournalStore metadata writes", () => {
  it("updates metadata without rewriting the message journal", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);

    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId,
          message: userMessage,
        },
      },
    });
    const journalPath = join(tempDir, `${sessionId}.jsonl`);
    const before = await readFile(journalPath, "utf-8");
    const beforeSession = await store.getSession(sessionId);

    await store.updateSessionMetadata({
      sessionId,
      metadata: { label: "Updated", last_activity_preview: { text: "hello" } },
    });

    const after = await readFile(journalPath, "utf-8");
    const metadataRaw = await readFile(join(tempDir, `${sessionId}.metadata.json`), "utf-8");
    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const session = await reloaded.getSession(sessionId);

    expect(after).toBe(before);
    expect(JSON.parse(metadataRaw)).toMatchObject({
      _type: "metadata",
      metadata: {
        label: "Updated",
        last_activity_preview: { text: "hello" },
      },
    });
    expect(session?.metadata).toEqual({
      label: "Updated",
      last_activity_preview: { text: "hello" },
    });
    expect(session?.updatedAt).toBe(beforeSession?.updatedAt);
    expect(session?.messages).toHaveLength(1);
  });

  it("does not let later event appends overwrite stored metadata", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);

    await store.importSessionSnapshot(createRecord([userMessage]));
    const beforeMetadataUpdate = await store.getSession(sessionId);
    await store.updateSessionMetadata({
      sessionId,
      metadata: {
        last_activity_preview: {
          state: "completed",
          timestamp: "2026-05-14T00:00:03.000Z",
          replyText: "final assistant reply",
        },
      },
    });
    const afterMetadataUpdate = await store.getSession(sessionId);
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.RunFinished,
        payload: { sessionId, runId: "run-1" },
      },
    });

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const session = await reloaded.getSession(sessionId);
    const [summary] = await reloaded.listSessionSummaries();
    expect(session?.metadata?.last_activity_preview).toMatchObject({
      state: "completed",
      replyText: "final assistant reply",
    });
    expect(summary?.metadata?.last_activity_preview).toMatchObject({
      state: "completed",
      replyText: "final assistant reply",
    });
    expect(afterMetadataUpdate?.updatedAt).toBe(beforeMetadataUpdate?.updatedAt);
    expect(session?.updatedAt).not.toBe(afterMetadataUpdate?.updatedAt);
  });

  it("preserves child-session relation metadata when updating runtime metadata", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);
    await store.importSessionSnapshot({
      ...createRecord([]),
      metadata: {
        label: "Child",
        parent_session_id: "parent-session-1",
        spawned_by_request_id: "request-1",
      },
    });

    await store.updateSessionMetadata({
      sessionId,
      metadata: { last_activity_preview: { state: "completed" } },
    });

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const session = await reloaded.getSession(sessionId);
    expect(session?.metadata).toMatchObject({
      parent_session_id: "parent-session-1",
      spawned_by_request_id: "request-1",
      last_activity_preview: { state: "completed" },
    });
  });

  it("fails closed when the metadata sidecar is corrupted instead of overwriting it", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);
    await store.importSessionSnapshot({
      ...createRecord([]),
      metadata: {
        label: "Project session",
        project_root: "/tmp/project-alpha",
      },
    });
    const metadataPath = join(tempDir, `${sessionId}.metadata.json`);
    await writeFile(metadataPath, "{", "utf-8");
    const reloaded = new NcpAgentSessionJournalStore(tempDir);

    await expect(reloaded.updateSessionMetadata({
      sessionId,
      metadata: {
        runtime: "native",
        last_channel: "ui",
      },
    })).rejects.toThrow();

    await expect(readFile(metadataPath, "utf-8")).resolves.toBe("{");
  });

});
