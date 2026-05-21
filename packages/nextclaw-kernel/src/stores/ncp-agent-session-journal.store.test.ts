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
      session: createRecord([userMessage]),
      event: {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId,
          message: userMessage,
        },
      },
      updatedAt: "2026-05-14T00:00:00.000Z",
    });
    await store.appendSessionEvent({
      session: createRecord([userMessage]),
      event: {
        type: NcpEventType.MessageTextStart,
        payload: {
          sessionId,
          messageId: "assistant-1",
        },
      },
      updatedAt: "2026-05-14T00:00:01.000Z",
    });
    await store.appendSessionEvent({
      session: createRecord([
        userMessage,
        {
          id: "assistant-1",
          sessionId,
          role: "assistant",
          status: "streaming",
          parts: [{ type: "text", text: "hel" }],
          timestamp: "2026-05-14T00:00:01.000Z",
        },
      ]),
      event: {
        type: NcpEventType.MessageTextDelta,
        payload: {
          sessionId,
          messageId: "assistant-1",
          delta: "hel",
        },
      },
      updatedAt: "2026-05-14T00:00:02.000Z",
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
      metadata: { label: "Journal test" },
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

  it("skips corrupted journal lines without losing later valid events", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);

    await store.appendSessionEvent({
      session: createRecord([userMessage]),
      event: {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId,
          message: userMessage,
        },
      },
      updatedAt: "2026-05-14T00:00:00.000Z",
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

    expect(session?.metadata).toMatchObject({
      label: "Journal test",
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user" });
    expect(messages[1]).toMatchObject({
      id: "assistant-1",
      status: "streaming",
      parts: [{ type: "text", text: "hi" }],
    });
  });

  it("writes fetched html payloads as one valid JSONL line", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);
    const html = "\n            \r\n            <div class=\"bdsharebuttonbox\">bad html</div>";

    await store.appendSessionEvent({
      session: createRecord([userMessage]),
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
      updatedAt: "2026-05-14T00:00:02.000Z",
    });

    const raw = await readFile(join(tempDir, `${sessionId}.jsonl`), "utf-8");
    const lines = raw.split("\n").filter((line) => line.trim());

    expect(lines).toHaveLength(1);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it("updates metadata without rewriting the message journal", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);

    await store.appendSessionEvent({
      session: createRecord([userMessage]),
      event: {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId,
          message: userMessage,
        },
      },
      updatedAt: "2026-05-14T00:00:00.000Z",
    });
    const journalPath = join(tempDir, `${sessionId}.jsonl`);
    const before = await readFile(journalPath, "utf-8");

    await store.updateSessionMetadata({
      sessionId,
      metadata: { label: "Updated", last_activity_preview: { text: "hello" } },
      updatedAt: "2026-05-14T00:00:03.000Z",
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
    expect(session?.messages).toHaveLength(1);
  });
});
