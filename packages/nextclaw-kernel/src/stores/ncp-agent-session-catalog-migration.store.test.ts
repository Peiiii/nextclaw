import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { NcpAgentSessionJournalStore } from "./ncp-agent-session-journal.store.js";
import { NCP_AGENT_SESSION_JOURNAL_INDEX_FILE, NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE } from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { NcpMessage } from "@nextclaw/ncp";

const sessionId = "ncp-migration-session-1";
const message: NcpMessage = {
  id: "migration-message-1",
  sessionId,
  role: "user",
  status: "final",
  parts: [{ type: "text", text: "recover this session" }],
  timestamp: "2026-08-23T11:11:00.000Z",
};

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

async function writeLegacyJournal(journalDir: string, id: string, nextMessage: NcpMessage): Promise<void> {
  await writeFile(
    join(journalDir, `${id}.jsonl`),
    `${JSON.stringify({
      _type: "event",
      version: 1,
      seq: 1,
      timestamp: nextMessage.timestamp,
      event: {
        type: NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE,
        payload: { sessionId: id, message: nextMessage },
      },
    })}\n`,
    "utf8",
  );
}

describe("NcpAgentSessionJournalStore SQLite catalog migration", () => {
  it("rebuilds a missing list record from the legacy journal and preserves the old index", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-catalog-migration-"));
    await writeLegacyJournal(tempDir, sessionId, message);
    const legacyIndex = JSON.stringify({ version: 1, records: [] }) + "\n";
    await writeFile(join(tempDir, NCP_AGENT_SESSION_JOURNAL_INDEX_FILE), legacyIndex, "utf8");

    const store = new NcpAgentSessionJournalStore(tempDir);
    await store.initialize();
    await expect(store.listSessionSummaries()).resolves.toEqual([
      expect.objectContaining({
        sessionId,
        messageCount: 1,
        lastMessageAt: message.timestamp,
      }),
    ]);
    await expect(store.listSessionMessages(sessionId)).resolves.toEqual([message]);
    await expect(readFile(join(tempDir, NCP_AGENT_SESSION_JOURNAL_INDEX_FILE), "utf8"))
      .resolves.toBe(legacyIndex);
    await expect(readFile(join(tempDir, ".ncp-agent-session-catalog.sqlite"), "utf8"))
      .resolves.toBeTruthy();
  });

  it("recovers from a corrupt legacy index and does not resurrect a deleted session", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-catalog-migration-"));
    await writeLegacyJournal(tempDir, sessionId, message);
    await writeFile(join(tempDir, NCP_AGENT_SESSION_JOURNAL_INDEX_FILE), "not-json\n", "utf8");

    const store = new NcpAgentSessionJournalStore(tempDir);
    await expect(store.hasSession(sessionId)).resolves.toBe(true);
    await expect(store.deleteSession(sessionId)).resolves.toMatchObject({ sessionId });
    await expect(new NcpAgentSessionJournalStore(tempDir).listSessionSummaries()).resolves.toEqual([]);
  });

  it("keeps concurrent runtime writes for different sessions", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-ncp-catalog-concurrency-"));
    const first = new NcpAgentSessionJournalStore(tempDir);
    const second = new NcpAgentSessionJournalStore(tempDir);
    const firstMessage = { ...message, sessionId: "ncp-concurrent-1", id: "concurrent-message-1" };
    const secondMessage = { ...message, sessionId: "ncp-concurrent-2", id: "concurrent-message-2" };

    await Promise.all([first.initialize(), second.initialize()]);

    await Promise.all([
      first.importSessionSnapshot({
        sessionId: firstMessage.sessionId,
        messages: [firstMessage],
        createdAt: firstMessage.timestamp,
        updatedAt: firstMessage.timestamp,
        metadata: {},
      }),
      second.importSessionSnapshot({
        sessionId: secondMessage.sessionId,
        messages: [secondMessage],
        createdAt: secondMessage.timestamp,
        updatedAt: secondMessage.timestamp,
        metadata: {},
      }),
    ]);

    await expect(new NcpAgentSessionJournalStore(tempDir).listSessionSummaries()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sessionId: firstMessage.sessionId, messageCount: 1 }),
        expect.objectContaining({ sessionId: secondMessage.sessionId, messageCount: 1 }),
      ]),
    );
  });
});
