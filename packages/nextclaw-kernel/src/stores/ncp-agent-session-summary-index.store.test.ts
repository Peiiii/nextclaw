import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { NcpAgentSessionSummaryIndexStore } from "./ncp-agent-session-summary-index.store.js";
import { openSqliteDatabase } from "./sqlite-database.store.js";

const sessionId = "desktop-session-catalog-regression";
const userMessage: NcpMessage = {
  id: "user-message-1",
  sessionId,
  role: "user",
  status: "final",
  parts: [{ type: "text", text: "hello" }],
  timestamp: "2026-09-01T03:15:00.000Z",
};

let store: NcpAgentSessionSummaryIndexStore | null = null;
let tempDir: string | null = null;

afterEach(async () => {
  store?.close();
  store = null;
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("NcpAgentSessionSummaryIndexStore", () => {
  it("persists a session event with strict SQLite named-parameter binding", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-session-summary-index-"));
    store = new NcpAgentSessionSummaryIndexStore(tempDir, async () => null);

    await expect(
      store.upsertForEvent({
        sessionId,
        event: {
          type: NcpEventType.MessageSent,
          payload: { sessionId, message: userMessage },
        },
        updatedAt: userMessage.timestamp,
      }),
    ).resolves.toBeUndefined();

    await expect(store.listPage({ offset: 0, limit: 20 })).resolves.toEqual([
      expect.objectContaining({
        sessionId,
        messageCount: 1,
        lastMessageAt: userMessage.timestamp,
        status: "idle",
      }),
    ]);
    await expect(store.count()).resolves.toBe(1);
  });

  it("does not load known journal contents when reopening a migrated catalog", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-session-summary-index-"));
    store = new NcpAgentSessionSummaryIndexStore(tempDir, async () => null);
    await store.upsert({
      sessionId,
      messageCount: 1,
      createdAt: userMessage.timestamp,
      updatedAt: userMessage.timestamp,
      lastMessageAt: userMessage.timestamp,
      status: "idle",
    });
    store.close();

    await writeFile(
      join(tempDir, `${sessionId}.jsonl`),
      "known journal must not be read\n",
      "utf8",
    );
    let fullLoadCount = 0;
    let summaryLoadCount = 0;
    store = new NcpAgentSessionSummaryIndexStore(
      tempDir,
      async () => {
        fullLoadCount += 1;
        return null;
      },
      async () => {
        summaryLoadCount += 1;
        return null;
      },
    );

    await store.initialize();

    expect(fullLoadCount).toBe(0);
    expect(summaryLoadCount).toBe(0);
    await expect(store.list()).resolves.toEqual([
      expect.objectContaining({ sessionId, messageCount: 1 }),
    ]);
    store.close();
    const database = await openSqliteDatabase(join(tempDir, ".ncp-agent-session-catalog.sqlite"));
    expect(database.prepare("SELECT value FROM storage_meta WHERE key = 'schema_version'").get()).toEqual({ value: "2" });
    database.close();
  });
});
