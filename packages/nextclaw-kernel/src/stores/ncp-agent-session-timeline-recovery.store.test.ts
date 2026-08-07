import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  timestamp: "2026-05-14T00:00:00.000Z"
};
const assistantMessage: NcpMessage = {
  id: "assistant-1",
  sessionId,
  role: "assistant",
  status: "final",
  parts: [{ type: "text", text: "hi" }],
  timestamp: "2026-05-14T00:00:02.000Z"
};

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = null;
});

describe("NCP agent session timeline recovery", () => {
  it("projects an orphaned streaming assistant before a later user boundary", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);
    await store.importSessionSnapshot({
      sessionId,
      messages: [userMessage],
      createdAt: userMessage.timestamp,
      updatedAt: userMessage.timestamp,
      metadata: {}
    });
    await store.appendSessionEvent({
      sessionId,
      event: { type: NcpEventType.RunStarted, payload: { sessionId, runId: "run-old" } }
    });
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageTextDelta,
        payload: { sessionId, messageId: "assistant-old", delta: "partial" }
      }
    });
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId,
          message: {
            ...userMessage,
            id: "user-later",
            parts: [{ type: "text", text: "later" }],
            timestamp: new Date(Date.now() + 60_000).toISOString()
          }
        }
      }
    });

    expect(await store.listSessionMessagePage({ sessionId, limit: 10 })).toMatchObject({
      total: 3,
      messages: [
        { id: "user-1" },
        { id: "assistant-old", status: "streaming", parts: [{ text: "partial" }] },
        { id: "user-later" }
      ]
    });
  });

  it("rebuilds a previous projection version from the journal", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const store = new NcpAgentSessionJournalStore(tempDir);
    await store.importSessionSnapshot({
      sessionId,
      messages: [userMessage, assistantMessage],
      createdAt: userMessage.timestamp,
      updatedAt: assistantMessage.timestamp,
      metadata: {}
    });
    const metaPath = join(tempDir, ".message-projections", sessionId, "meta.json");
    const legacyMeta = JSON.parse(await readFile(metaPath, "utf-8")) as Record<string, unknown>;
    await writeFile(metaPath, `${JSON.stringify({ ...legacyMeta, version: 2 })}\n`, "utf-8");

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    expect(await reloaded.listSessionMessagePage({ sessionId, limit: 10 })).toMatchObject({
      total: 2,
      messages: [{ id: "user-1" }, { id: "assistant-1" }]
    });
    expect(JSON.parse(await readFile(metaPath, "utf-8"))).toMatchObject({ version: 3 });
  });

  it("preserves an orphaned assistant when a different run starts after restart", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-journal-"));
    const journalPath = join(tempDir, `${sessionId}.jsonl`);
    const events = [
      { type: NcpEventType.MessageSent, payload: { sessionId, message: userMessage } },
      { type: NcpEventType.RunStarted, payload: { sessionId, runId: "run-old" } },
      {
        type: NcpEventType.MessageTextDelta,
        payload: { sessionId, messageId: "assistant-old", delta: "partial" }
      },
      {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId,
          message: {
            ...userMessage,
            id: "user-later",
            parts: [{ type: "text", text: "later" }],
            timestamp: "2026-05-14T00:00:02.000Z"
          }
        }
      },
      { type: NcpEventType.RunStarted, payload: { sessionId, runId: "run-new" } },
      {
        type: NcpEventType.MessageTextDelta,
        payload: { sessionId, messageId: "assistant-new", delta: "new reply" }
      }
    ];
    const timestamps = ["00.000", "01.000", "01.100", "02.000", "03.000", "03.100"];
    const entries = events.map((event, index) => ({
      _type: "event",
      version: 1,
      seq: index + 1,
      timestamp: `2026-05-14T00:00:${timestamps[index]}Z`,
      event
    }));
    await writeFile(journalPath, `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf-8");

    const messages = await new NcpAgentSessionJournalStore(tempDir).listSessionMessages(sessionId);
    expect(messages.map((message) => message.id)).toEqual([
      "user-1",
      "assistant-old",
      "user-later",
      "assistant-new"
    ]);
    expect(messages[1]).toMatchObject({ status: "final", parts: [{ text: "partial" }] });
    expect(messages[3]).toMatchObject({ status: "streaming", parts: [{ text: "new reply" }] });
  });
});
