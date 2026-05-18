import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
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

function createRecord(messages: NcpMessage[]) {
  return {
    sessionId,
    messages,
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:01.000Z",
    metadata: { label: "Journal test" },
  };
}

describe("NcpAgentSessionJournalStore", () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

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

  it("persists replaceSession records so legacy history survives reload", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);

    await store.replaceSession(createRecord([userMessage]));

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const messages = await reloaded.listSessionMessages(sessionId);
    const summaries = await reloaded.listSessionSummaries();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: "user",
      parts: [{ type: "text", text: "hello" }],
    });
    expect(summaries[0]).toMatchObject({
      sessionId,
      messageCount: 1,
      metadata: { label: "Journal test" },
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

    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});
