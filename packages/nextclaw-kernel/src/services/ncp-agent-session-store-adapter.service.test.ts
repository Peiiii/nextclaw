import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NcpEventType } from "@nextclaw/ncp";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { NcpAgentSessionStoreAdapter } from "./ncp-agent-session-store-adapter.service.js";

const sessionId = "legacy-session";
const timestamp = "2026-05-14T00:00:00.000Z";

class TestSessionManager {
  readonly session = {
    key: sessionId,
    agentId: "main",
    messages: [{
      role: "user",
      content: "legacy message",
      timestamp,
    }],
    metadata: { label: "Legacy" },
    createdAt: new Date(timestamp),
    updatedAt: new Date(timestamp),
  };

  getIfExists = (key: string) => key === sessionId ? this.session : null;
}

describe("NcpAgentSessionStoreAdapter", () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("falls back to legacy messages when a historical session has no journal yet", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-legacy-session-"));
    const adapter = new NcpAgentSessionStoreAdapter(
      new TestSessionManager() as never,
      { journalStore: new NcpAgentSessionJournalStore(tempDir) },
    );

    const messages = await adapter.listSessionMessages(sessionId);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: "user",
      parts: [{ type: "text", text: "legacy message" }],
    });
  });

  it("seeds legacy history before the first journal append for a historical session", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-legacy-journal-"));
    const journalStore = new NcpAgentSessionJournalStore(tempDir);
    const adapter = new NcpAgentSessionStoreAdapter(
      new TestSessionManager() as never,
      { journalStore },
    );

    await adapter.appendSessionEvent?.({
      session: {
        sessionId,
        agentId: "main",
        createdAt: timestamp,
        updatedAt: "2026-05-14T00:00:01.000Z",
        metadata: { label: "Legacy" },
      },
      event: {
        type: NcpEventType.MessageTextDelta,
        payload: {
          sessionId,
          messageId: "assistant-1",
          delta: "new",
        },
      },
      updatedAt: "2026-05-14T00:00:01.000Z",
    });

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const messages = await reloaded.listSessionMessages(sessionId);

    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      role: "user",
      parts: [{ type: "text", text: "legacy message" }],
    });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      parts: [{ type: "text", text: "new" }],
    });
  });

  it("does not rematerialize existing journal sessions when snapshot save is called", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nextclaw-journal-save-"));
    const journalStore = new NcpAgentSessionJournalStore(tempDir);
    const adapter = new NcpAgentSessionStoreAdapter(
      new TestSessionManager() as never,
      { journalStore },
    );

    await journalStore.appendSessionEvent({
      session: {
        sessionId,
        agentId: "main",
        createdAt: timestamp,
        updatedAt: "2026-05-14T00:00:01.000Z",
        metadata: {
          label: "Journal",
          last_activity_preview: {
            state: "completed",
            timestamp: "2026-05-14T00:00:01.000Z",
            replyText: "final reply",
          },
        },
      },
      event: {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId,
          message: {
            id: "user-1",
            sessionId,
            role: "user",
            status: "final",
            timestamp,
            parts: [{ type: "text", text: "hello" }],
          },
        },
      },
      updatedAt: "2026-05-14T00:00:01.000Z",
    });

    await adapter.saveSession({
      sessionId,
      agentId: "main",
      createdAt: timestamp,
      updatedAt: "2026-05-14T00:00:02.000Z",
      metadata: { label: "Updated" },
      messages: [],
    });

    const reloaded = new NcpAgentSessionJournalStore(tempDir);
    const session = await reloaded.getSession(sessionId);

    expect(session?.messages).toHaveLength(1);
    expect(session?.metadata).toMatchObject({
      label: "Updated",
      last_activity_preview: {
        state: "completed",
        timestamp: "2026-05-14T00:00:01.000Z",
        replyText: "final reply",
      },
    });
  });
});
