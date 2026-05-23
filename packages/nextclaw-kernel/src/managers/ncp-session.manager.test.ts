import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionManager } from "@nextclaw/core";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { EventBus } from "@nextclaw/shared";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { NcpSessionManager } from "./ncp-session.manager.js";

vi.mock("@kernel/features/context-compaction/index.js", () => ({
  ContextCompactionManager: class {
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
  const sessionManager = new SessionManager({ sessionsDir });
  const journalStore = new NcpAgentSessionJournalStore(join(sessionsDir, ".ncp-agent-journal"));
  const onSessionUpdated = vi.fn();
  for (const record of records) {
    await journalStore.importSessionSnapshot(record);
  }
  const manager = new NcpSessionManager({
    eventBus,
    getConfig: createConfig,
    journalStore,
    onSessionUpdated,
    sessionManager,
  });
  return {
    eventBus,
    journalStore,
    manager,
    onSessionUpdated,
    sessionManager,
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

describe("NcpSessionManager", () => {
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

  it("patches metadata and publishes realtime summary events from one owner", async () => {
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
    expect(fixture.onSessionUpdated).toHaveBeenCalledWith("session-1");
    expect(events).toEqual(["session.summary.upsert", "session.summary.delete"]);
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
    expect(fixture.sessionManager.getIfExists(created.sessionId)).toBeNull();
  });

  it("imports a legacy session only when appending a new event", async () => {
    const fixture = await createFixture();
    const legacy = fixture.sessionManager.createSession({
      task: "legacy",
      title: "Legacy",
      sourceSessionMetadata: {},
      metadataOverrides: { label: "Legacy" },
    });

    expect(await fixture.journalStore.hasSession(legacy.sessionId)).toBe(false);
    expect(await fixture.manager.getSession(legacy.sessionId)).toMatchObject({
      sessionId: legacy.sessionId,
      metadata: { label: "Legacy" },
    });
    expect(await fixture.journalStore.hasSession(legacy.sessionId)).toBe(false);

    await fixture.manager.appendSessionEvent({
      session: {
        sessionId: legacy.sessionId,
        createdAt: legacy.createdAt,
        updatedAt: "2026-05-12T00:00:00.000Z",
        metadata: {},
      },
      event: {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId: legacy.sessionId,
          message: createMessage({
            id: "user-1",
            sessionId: legacy.sessionId,
            text: "hello",
          }),
        },
      },
      updatedAt: "2026-05-12T00:00:00.000Z",
    });

    expect(await fixture.journalStore.hasSession(legacy.sessionId)).toBe(true);
  });
});
