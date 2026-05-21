import { describe, expect, it, vi } from "vitest";
import { EventBus, eventKeys } from "@nextclaw/shared";
import type { NcpMessage } from "@nextclaw/ncp";
import type { AgentSessionRecord, AgentSessionStore } from "@nextclaw/ncp-toolkit";
import { NcpSessionApiService } from "./ncp-session-api.service.js";

vi.mock("@kernel/features/context-compaction/index.js", () => ({
  ContextCompactionPreflightService: class {
    preview = () => null;
  },
}));

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

class TestAgentSessionStore implements AgentSessionStore {
  updateMetadataCallCount = 0;
  readonly loadedSessionIds: string[] = [];
  private readonly records = new Map<string, AgentSessionRecord>();

  constructor(records: AgentSessionRecord[]) {
    for (const record of records) {
      this.records.set(record.sessionId, structuredClone(record));
    }
  }

  getSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    this.loadedSessionIds.push(sessionId);
    const record = this.records.get(sessionId);
    return record ? structuredClone(record) : null;
  };

  listSessions = async (): Promise<AgentSessionRecord[]> =>
    [...this.records.values()].map((record) => structuredClone(record));

  listSessionMessages = async (sessionId: string): Promise<NcpMessage[]> =>
    this.records.get(sessionId)?.messages.map((message) => structuredClone(message)) ?? [];

  saveSession = async (record: AgentSessionRecord): Promise<void> => {
    this.records.set(record.sessionId, structuredClone(record));
  };

  updateSessionMetadata = async (params: {
    sessionId: string;
    metadata: Record<string, unknown>;
    updatedAt: string;
  }): Promise<boolean> => {
    const { metadata, sessionId, updatedAt } = params;
    const record = this.records.get(sessionId);
    if (!record) {
      return false;
    }
    this.updateMetadataCallCount += 1;
    this.records.set(sessionId, {
      ...record,
      metadata: structuredClone(metadata),
      updatedAt,
    });
    return true;
  };

  deleteSession = async (sessionId: string): Promise<AgentSessionRecord | null> => {
    const record = this.records.get(sessionId);
    if (!record) {
      return null;
    }
    this.records.delete(sessionId);
    return structuredClone(record);
  };
}

function createServiceFixture(records: AgentSessionRecord[] = []): {
  eventBus: EventBus;
  ncpAgentSessionStore: TestAgentSessionStore;
  ncpSessionApi: NcpSessionApiService;
} {
  const eventBus = new EventBus();
  const ncpAgentSessionStore = new TestAgentSessionStore(records);
  const ncpSessionApi = new NcpSessionApiService({
    eventBus,
    getConfig: createConfig,
    ncpAgentSessionStore,
    sessionManager: {} as never,
  });
  return {
    eventBus,
    ncpAgentSessionStore,
    ncpSessionApi,
  };
}

describe("NcpSessionApiService", () => {
  it("serves UI session API from the agent session store owner", async () => {
    const fixture = createServiceFixture([
      createRecord({
        sessionId: "session-1",
        agentId: "main",
        metadata: { label: "Before" },
        messages: [createMessage({ id: "user-1", sessionId: "session-1", text: "hello" })],
      }),
    ]);

    const summaries = await fixture.ncpSessionApi.listSessions();
    const messages = await fixture.ncpSessionApi.listSessionMessages("session-1");

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      agentId: "main",
      messageCount: 1,
      metadata: { label: "Before" },
      sessionId: "session-1",
      status: "idle",
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      role: "user",
      sessionId: "session-1",
    });
    fixture.ncpSessionApi.dispose();
  });

  it("overlays live runtime status on store-backed summaries", async () => {
    const record = createRecord({
      sessionId: "session-1",
      messages: [createMessage({ id: "user-1", sessionId: "session-1", text: "hello" })],
    });
    const fixture = createServiceFixture([record]);
    const service = new NcpSessionApiService({
      eventBus: fixture.eventBus,
      getConfig: createConfig,
      isLiveSessionRunning: (sessionId) => sessionId === "session-1",
      ncpAgentSessionStore: fixture.ncpAgentSessionStore,
      sessionManager: {} as never,
    });

    const summaries = await service.listSessions();
    const summary = await service.getSession("session-1");

    expect(summaries[0]).toMatchObject({
      sessionId: "session-1",
      status: "running",
    });
    expect(summary).toMatchObject({
      sessionId: "session-1",
      status: "running",
    });
    expect(fixture.ncpAgentSessionStore.loadedSessionIds).toEqual(["session-1"]);
    service.dispose();
    fixture.ncpSessionApi.dispose();
  });

  it("updates NCP session metadata without replacing message history", async () => {
    const fixture = createServiceFixture([
      createRecord({
        sessionId: "session-1",
        metadata: { label: "Before" },
        messages: [createMessage({ id: "journal:user", sessionId: "session-1", text: "journal" })],
      }),
    ]);

    const updated = await fixture.ncpSessionApi.updateSession("session-1", {
      metadata: { label: "After" },
    });

    expect(updated?.metadata).toEqual({ label: "After" });
    expect(updated?.messageCount).toBe(1);
    expect(fixture.ncpAgentSessionStore.updateMetadataCallCount).toBe(1);
    fixture.ncpSessionApi.dispose();
  });

  it("builds the limited session list from store records ordered by activity", async () => {
    const fixture = createServiceFixture([
      createRecord({
        sessionId: "old-session",
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:00:00.000Z",
      }),
      createRecord({
        sessionId: "newest-session",
        createdAt: "2026-05-09T00:00:00.000Z",
        updatedAt: "2026-05-12T00:00:00.000Z",
        messages: [createMessage({
          id: "newest:user",
          sessionId: "newest-session",
          text: "hello",
          timestamp: "2026-05-12T00:00:00.000Z",
        })],
      }),
      createRecord({
        sessionId: "middle-session",
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
      }),
    ]);

    const summaries = await fixture.ncpSessionApi.listSessions({ limit: 1 });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.sessionId).toBe("newest-session");
    expect(summaries[0]?.messageCount).toBe(1);
    expect(fixture.ncpAgentSessionStore.loadedSessionIds).toEqual([]);
    fixture.ncpSessionApi.dispose();
  });

  it("keeps metadata-only session updates out of the list ordering clock", async () => {
    const fixture = createServiceFixture([
      createRecord({
        sessionId: "first-session",
        createdAt: "2026-05-12T10:00:00.000Z",
        updatedAt: "2026-05-12T10:00:00.000Z",
      }),
      createRecord({
        sessionId: "second-session",
        createdAt: "2026-05-12T09:00:00.000Z",
        updatedAt: "2026-05-12T09:00:00.000Z",
      }),
    ]);

    await fixture.ncpSessionApi.updateSession("second-session", {
      metadata: { ui_last_read_at: "2026-05-12T09:00:00.000Z" },
    });
    const summaries = await fixture.ncpSessionApi.listSessions();

    expect(summaries.map((summary) => summary.sessionId)).toEqual(["first-session", "second-session"]);
    expect(summaries[1]?.metadata).toEqual({
      ui_last_read_at: "2026-05-12T09:00:00.000Z",
    });
    fixture.ncpSessionApi.dispose();
  });

  it("updates session metadata and publishes realtime summary events from one owner", async () => {
    const fixture = createServiceFixture([
      createRecord({
        sessionId: "session-1",
        metadata: { label: "Before" },
      }),
    ]);
    const events: string[] = [];
    fixture.eventBus.subscribeAll((event) => {
      events.push(event.type);
    });

    const updated = await fixture.ncpSessionApi.updateSession("session-1", {
      metadata: { label: "After" },
    });
    await fixture.ncpSessionApi.deleteSession("session-1");

    expect(updated?.metadata).toEqual({ label: "After" });
    expect(events).toEqual(["session.summary.upsert", "session.summary.delete"]);
    fixture.ncpSessionApi.dispose();
  });

  it("publishes summaries from kernel session update events during its lifecycle", async () => {
    const fixture = createServiceFixture([
      createRecord({ sessionId: "session-1" }),
    ]);
    const events: string[] = [];
    fixture.eventBus.subscribeAll((event) => {
      events.push(event.type);
    });

    fixture.ncpSessionApi.start();
    fixture.eventBus.emit(eventKeys.sessionUpdated, { sessionKey: "session-1" });
    await vi.waitFor(() => {
      expect(events).toContain("session.summary.upsert");
    });

    fixture.ncpSessionApi.dispose();
  });
});
