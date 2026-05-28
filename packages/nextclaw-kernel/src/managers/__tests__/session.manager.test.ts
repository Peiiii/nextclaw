import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NcpMessage } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { EventBus } from "@nextclaw/shared";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { SessionManager } from "@kernel/managers/session.manager.js";

vi.mock("@kernel/features/context-compaction/index.js", () => ({
  ContextWindowPreviewManager: class {
    preview = () => null;
  },
}));

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-session-manager-"));
  tempDirs.push(dir);
  return dir;
}

function createConfig() {
  return {
    agents: {
      defaults: {
        workspace: "",
        model: "",
        engine: "native",
        engineConfig: {},
        thinkingDefault: "off",
        models: {},
        contextTokens: 200000,
        maxToolIterations: 1000,
      },
      list: [],
    },
  } as never;
}

function createMessage(params: {
  id: string;
  sessionId: string;
  text: string;
  timestamp?: string;
  role?: NcpMessage["role"];
}): NcpMessage {
  const {
    id,
    role = "user",
    sessionId,
    text,
    timestamp = "2026-05-12T00:00:00.000Z",
  } = params;
  return {
    id,
    sessionId,
    role,
    status: "final",
    parts: [{ type: "text", text }],
    timestamp,
  };
}

function createRecord(params: {
  sessionId: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
  messages?: NcpMessage[];
  createdAt?: string;
  updatedAt?: string;
}): AgentSessionRecord {
  const {
    agentId,
    createdAt = "2026-05-12T00:00:00.000Z",
    messages = [],
    metadata = {},
    sessionId,
    updatedAt = createdAt,
  } = params;
  return {
    sessionId,
    ...(agentId ? { agentId } : {}),
    messages: messages.map((message) => structuredClone(message)),
    createdAt,
    updatedAt,
    metadata: structuredClone(metadata),
  };
}

async function createFixture(records: AgentSessionRecord[] = []) {
  const eventBus = new EventBus();
  const sessionsDir = createTempDir();
  const journalStore = new NcpAgentSessionJournalStore(join(sessionsDir, ".ncp-agent-journal"));
  const handleSessionUpdated = vi.fn();
  const sessionSearch = {
    handleSessionUpdated,
  };
  for (const record of records) {
    await journalStore.importSessionSnapshot(record);
  }
  const manager = new SessionManager({
    configManager: { loadConfig: createConfig } as never,
    eventBus,
    journalStore,
    sessionSearch: sessionSearch as never,
  });
  return {
    eventBus,
    journalStore,
    manager,
    handleSessionUpdated,
  };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SessionManager", () => {
  it("serves UI session API from the journal owner", async () => {
    const fixture = await createFixture([
      createRecord({
        sessionId: "session-1",
        agentId: "main",
        metadata: { label: "Before" },
        messages: [createMessage({ id: "user-1", sessionId: "session-1", text: "hello" })],
      }),
    ]);

    const summaries = await fixture.manager.listSessions();
    const messages = await fixture.manager.listSessionMessages("session-1");

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      agentId: "main",
      messageCount: 1,
      metadata: { label: "Before" },
      sessionId: "session-1",
      status: "idle",
    });
    expect(messages[0]).toMatchObject({
      role: "user",
      sessionId: "session-1",
    });
  });

  it("updates metadata and publishes realtime summary events from one owner", async () => {
    const fixture = await createFixture([
      createRecord({
        sessionId: "session-1",
        metadata: { label: "Before" },
      }),
    ]);
    const events: string[] = [];
    fixture.eventBus.subscribeAll((event) => {
      events.push(event.type);
    });

    const updated = await fixture.manager.updateSession("session-1", {
      metadata: { label: "After" },
    });
    await fixture.manager.deleteSession("session-1");

    expect(updated?.metadata).toEqual({ label: "After" });
    expect(fixture.handleSessionUpdated).toHaveBeenCalledWith("session-1");
    expect(events).toEqual([
      "session.metadata.changed",
      "session.updated",
      "session.summary.upsert",
      "session.updated",
      "session.summary.delete",
    ]);
  });

  it("merges session metadata updates without dropping child-session identity", async () => {
    const fixture = await createFixture([
      createRecord({
        sessionId: "child-session-1",
        metadata: {
          label: "Child",
          parent_session_id: "parent-session-1",
          spawned_by_request_id: "request-1",
        },
      }),
    ]);

    const updated = await fixture.manager.updateSession("child-session-1", {
      metadata: {
        last_activity_preview: {
          state: "completed",
          timestamp: "2026-05-23T00:00:00.000Z",
        },
      },
    });

    expect(updated?.metadata).toMatchObject({
      label: "Child",
      parent_session_id: "parent-session-1",
      spawned_by_request_id: "request-1",
      last_activity_preview: {
        state: "completed",
      },
    });
  });

  it("creates new sessions in the journal instead of legacy SessionManager", async () => {
    const fixture = await createFixture();

    const created = await fixture.manager.createSession({
      task: "Draft run",
      title: "Draft run",
      sourceSessionMetadata: {},
      metadataOverrides: { preferred_model: "openai/gpt-5" },
      sessionType: "native",
    });

    expect(created.sessionId).toMatch(/^ncp-/);
    expect(await fixture.journalStore.getSession(created.sessionId)).toMatchObject({
      sessionId: created.sessionId,
      metadata: {
        label: "Draft run",
        preferred_model: "openai/gpt-5",
      },
    });
  });

  it("internally derives stable agent run sessions from peerId", async () => {
    const fixture = await createFixture();

    const first = await fixture.manager.getOrCreateAgentRunSession({
      agentId: "main",
      metadata: { agent_peer_scope: "panel-app:mood-calendar" },
      peerId: "mood-summary",
      task: "Summarize mood",
    });
    const second = await fixture.manager.getOrCreateAgentRunSession({
      agentId: "main",
      metadata: { agent_peer_scope: "panel-app:mood-calendar" },
      peerId: "mood-summary",
      task: "Continue mood",
    });
    const other = await fixture.manager.getOrCreateAgentRunSession({
      agentId: "main",
      metadata: { agent_peer_scope: "panel-app:other" },
      peerId: "mood-summary",
      task: "Other app",
    });

    expect(first.sessionId).toMatch(/^agent-peer-/);
    expect(second.sessionId).toBe(first.sessionId);
    expect(other.sessionId).not.toBe(first.sessionId);
    expect(await fixture.journalStore.getSession(first.sessionId)).toMatchObject({
      metadata: {
        agent_peer_id: "mood-summary",
        agent_peer_scope: "panel-app:mood-calendar",
      },
    });
  });
});
