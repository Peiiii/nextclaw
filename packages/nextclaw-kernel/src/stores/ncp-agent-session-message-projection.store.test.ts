import { appendFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { NcpMessage } from "@nextclaw/ncp";
import { SessionMessageCursorError } from "@kernel/types/session.types.js";
import { NcpAgentSessionMessageProjectionStore } from "./ncp-agent-session-message-projection.store.js";

const sessionId = "session-1";

function message(index: number, text = `message-${index}`): NcpMessage {
  return {
    id: `message-${index}`,
    sessionId,
    role: index % 2 === 0 ? "assistant" : "user",
    status: "final",
    parts: [{ type: "text", text }],
    timestamp: `2026-07-18T00:00:${String(index).padStart(2, "0")}.000Z`,
  };
}

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("NcpAgentSessionMessageProjectionStore", () => {
  it("reads the newest page and walks backward without overlap", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-message-projection-"));
    const store = new NcpAgentSessionMessageProjectionStore(tempDir);
    await store.rebuild({
      sessionId,
      messages: [1, 2, 3, 4, 5].map((index) => message(index)),
      projectedJournalOffset: 500,
    });

    const newest = await store.readPage({ sessionId, limit: 2 });
    const middle = await store.readPage({
      sessionId,
      limit: 2,
      cursor: newest?.pageInfo.startCursor ?? undefined,
    });
    const oldest = await store.readPage({
      sessionId,
      limit: 2,
      cursor: middle?.pageInfo.startCursor ?? undefined,
    });

    expect(newest).toMatchObject({
      total: 5,
      messages: [{ id: "message-4" }, { id: "message-5" }],
      pageInfo: { hasPreviousPage: true },
    });
    expect(middle).toMatchObject({
      messages: [{ id: "message-2" }, { id: "message-3" }],
      pageInfo: { hasPreviousPage: true },
    });
    expect(oldest).toMatchObject({
      messages: [{ id: "message-1" }],
      pageInfo: { hasPreviousPage: false },
    });
  });

  it("updates the latest snapshot and appends new messages without inflating total", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-message-projection-"));
    const store = new NcpAgentSessionMessageProjectionStore(tempDir);
    await store.rebuild({
      sessionId,
      messages: [message(1), message(2, "partial")],
      projectedJournalOffset: 200,
    });

    await expect(
      store.synchronize({
        sessionId,
        messages: [message(2, "complete"), message(3)],
        projectedJournalOffset: 300,
      }),
    ).resolves.toBe(true);

    expect(await store.readPage({ sessionId, limit: 10 })).toMatchObject({
      total: 3,
      messages: [
        { id: "message-1" },
        { id: "message-2", parts: [{ text: "complete" }] },
        { id: "message-3" },
      ],
    });
  });

  it("merges an unstable tail into the newest page without duplicating the latest message", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-message-projection-"));
    const store = new NcpAgentSessionMessageProjectionStore(tempDir);
    await store.rebuild({
      sessionId,
      messages: [message(1), message(2, "partial")],
      projectedJournalOffset: 200,
    });

    expect(
      await store.readPage({
        sessionId,
        limit: 2,
        tailMessages: [message(2, "new partial"), message(3)],
      }),
    ).toMatchObject({
      total: 3,
      messages: [
        { id: "message-2", parts: [{ text: "new partial" }] },
        { id: "message-3" },
      ],
    });
  });

  it("rejects malformed and out-of-range cursors", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-message-projection-"));
    const store = new NcpAgentSessionMessageProjectionStore(tempDir);
    await store.rebuild({
      sessionId,
      messages: [message(1)],
      projectedJournalOffset: 100,
    });

    await expect(
      store.readPage({ sessionId, limit: 1, cursor: "broken" }),
    ).rejects.toBeInstanceOf(SessionMessageCursorError);
  });

  it("invalidates a projection whose data file no longer matches metadata", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-message-projection-"));
    const store = new NcpAgentSessionMessageProjectionStore(tempDir);
    await store.rebuild({
      sessionId,
      messages: [message(1)],
      projectedJournalOffset: 100,
    });
    await appendFile(
      join(tempDir, ".message-projections", sessionId, "messages.jsonl"),
      "orphan",
      "utf-8",
    );

    await expect(store.readMeta(sessionId)).resolves.toBeNull();
  });
});
