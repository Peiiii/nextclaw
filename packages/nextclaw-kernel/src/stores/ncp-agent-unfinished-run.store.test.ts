import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { NcpAgentSessionJournalStore } from "./ncp-agent-session-journal.store.js";

const sessionId = "unfinished-run-checkpoint";
const userMessage: NcpMessage = {
  id: "user-message",
  sessionId,
  role: "user",
  status: "final",
  parts: [{ type: "text", text: "hello" }],
  timestamp: "2026-05-14T00:00:00.000Z",
};

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
  tempDir = null;
});

async function createStore(): Promise<NcpAgentSessionJournalStore> {
  tempDir = await mkdtemp(join(tmpdir(), "nextclaw-unfinished-run-"));
  const store = new NcpAgentSessionJournalStore(tempDir);
  await store.importSessionSnapshot({
    sessionId,
    messages: [userMessage],
    createdAt: userMessage.timestamp,
    updatedAt: userMessage.timestamp,
    metadata: {},
  });
  return store;
}

describe("NcpAgentUnfinishedRunStore", () => {
  it("keeps a checkpointed unfinished run across a large non-lifecycle tail", async () => {
    const store = await createStore();
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.RunStarted,
        payload: { sessionId, runId: "active-run" },
      },
    });
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.MessageTextDelta,
        payload: { sessionId, messageId: "assistant", delta: "x".repeat(70 * 1024) },
      },
    });

    await expect(store.listUnfinishedRuns()).resolves.toEqual([
      expect.objectContaining({ runId: "active-run" }),
    ]);
    store.close();
  });

  it("does not revive an older run after the newest run reached a terminal event", async () => {
    const store = await createStore();
    for (const event of [
      { type: NcpEventType.RunStarted, payload: { sessionId, runId: "older-run" } },
      { type: NcpEventType.RunStarted, payload: { sessionId, runId: "newest-run" } },
      { type: NcpEventType.RunFinished, payload: { sessionId, runId: "newest-run" } },
    ] as const) {
      await store.appendSessionEvent({ sessionId, event });
    }

    await expect(store.listUnfinishedRuns()).resolves.toEqual([]);
    store.close();
  });

  it("ignores a terminal event for another run id", async () => {
    const store = await createStore();
    await store.appendSessionEvent({
      sessionId,
      event: { type: NcpEventType.RunStarted, payload: { sessionId, runId: "active-run" } },
    });
    await store.appendSessionEvent({
      sessionId,
      event: {
        type: NcpEventType.RunError,
        payload: { sessionId, runId: "different-run", error: "other failure" },
      },
    });

    await expect(store.listUnfinishedRuns()).resolves.toEqual([
      expect.objectContaining({ runId: "active-run" }),
    ]);
    store.close();
  });
});
