import { describe, expect, it, vi } from "vitest";
import { EventBus, eventKeys } from "@nextclaw/shared";

vi.mock("@kernel/features/native-runtime/index.js", () => ({
  ContextCompactionPreflightService: class {
    preview = () => null;
  },
}));

vi.mock("@kernel/utils/ncp-session-message-adapter.utils.js", () => ({
  toNcpMessages: (sessionId: string, messages: Array<{ content: unknown; role: string; timestamp: string }>) =>
    messages.map((message, index) => ({
      id: `${sessionId}:${index}`,
      parts: typeof message.content === "string"
        ? [{ type: "text", text: message.content }]
        : [],
      role: message.role,
      sessionId,
      status: "final",
      timestamp: message.timestamp,
    })),
}));

vi.mock("@kernel/utils/ncp-session-summary.utils.js", () => ({
  createNcpSessionSummary: (params: {
    agentId?: string;
    messages: unknown[];
    metadata?: Record<string, unknown>;
    sessionId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }) => {
    const { agentId, messages, metadata, sessionId, status, createdAt, updatedAt } = params;
    return {
      ...(agentId ? { agentId } : {}),
      messageCount: messages.length,
      createdAt,
      metadata,
      sessionId,
      status,
      updatedAt,
    };
  },
}));

import { NcpSessionApiService } from "./ncp-session-api.service.js";

type TestSession = {
  agentId?: string;
  events: unknown[];
  key: string;
  messages: Array<{
    content: unknown;
    role: string;
    timestamp: string;
  }>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

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

class TestSessionManager {
  private readonly sessions = new Map<string, TestSession>();
  readonly loadedSessionKeys: string[] = [];

  getOrCreate = (key: string): TestSession => {
    const existing = this.sessions.get(key);
    if (existing) {
      return existing;
    }
    const session: TestSession = {
      events: [],
      key,
      messages: [],
      metadata: {},
      createdAt: new Date("2026-05-12T00:00:00.000Z"),
      updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    };
    this.sessions.set(key, session);
    return session;
  };

  getIfExists = (key: string): TestSession | null => {
    this.loadedSessionKeys.push(key);
    return this.sessions.get(key) ?? null;
  };

  addMessage = (session: TestSession, role: string, content: unknown): void => {
    session.messages.push({
      content,
      role,
      timestamp: "2026-05-12T00:00:00.000Z",
    });
  };

  save = (session: TestSession): void => {
    this.sessions.set(session.key, session);
  };

  delete = (key: string): boolean => this.sessions.delete(key);

  listSessions = () =>
    [...this.sessions.values()].map((session) => ({
      key: session.key,
      created_at: session.createdAt.toISOString(),
      updated_at: session.updatedAt.toISOString(),
      path: session.key,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      messageCount: session.messages.length,
      ...(session.messages.at(-1)?.timestamp ? { lastMessageAt: session.messages.at(-1)?.timestamp } : {}),
      metadata: session.metadata,
    }));
}

function createServiceFixture(): {
  eventBus: EventBus;
  ncpSessionApi: NcpSessionApiService;
  sessionManager: TestSessionManager;
} {
  const sessionManager = new TestSessionManager();
  const eventBus = new EventBus();
  const ncpSessionApi = new NcpSessionApiService({
    eventBus,
    getConfig: createConfig,
    sessionManager: sessionManager as never,
  });
  return {
    eventBus,
    ncpSessionApi,
    sessionManager,
  };
}

describe("NcpSessionApiService", () => {
  it("serves UI session API directly from the kernel session manager", async () => {
    const fixture = createServiceFixture();
    const session = fixture.sessionManager.getOrCreate("session-1");
    session.agentId = "main";
    session.metadata = { label: "Before" };
    fixture.sessionManager.addMessage(session, "user", "hello");
    fixture.sessionManager.save(session);

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

  it("builds the limited session list from metadata without loading full records", async () => {
    const fixture = createServiceFixture();
    const oldSession = fixture.sessionManager.getOrCreate("old-session");
    oldSession.createdAt = new Date("2026-05-10T00:00:00.000Z");
    oldSession.updatedAt = new Date("2026-05-10T00:00:00.000Z");
    fixture.sessionManager.save(oldSession);
    const newestSession = fixture.sessionManager.getOrCreate("newest-session");
    newestSession.createdAt = new Date("2026-05-09T00:00:00.000Z");
    newestSession.updatedAt = new Date("2026-05-12T00:00:00.000Z");
    fixture.sessionManager.addMessage(newestSession, "user", "hello");
    fixture.sessionManager.save(newestSession);
    const middleSession = fixture.sessionManager.getOrCreate("middle-session");
    middleSession.createdAt = new Date("2026-05-11T00:00:00.000Z");
    middleSession.updatedAt = new Date("2026-05-11T00:00:00.000Z");
    fixture.sessionManager.save(middleSession);

    const summaries = await fixture.ncpSessionApi.listSessions({ limit: 1 });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.sessionId).toBe("newest-session");
    expect(summaries[0]?.messageCount).toBe(1);
    expect(fixture.sessionManager.loadedSessionKeys).toEqual([]);
    fixture.ncpSessionApi.dispose();
  });

  it("keeps metadata-only session updates out of the list ordering clock", async () => {
    const fixture = createServiceFixture();
    const firstSession = fixture.sessionManager.getOrCreate("first-session");
    firstSession.createdAt = new Date("2026-05-12T10:00:00.000Z");
    firstSession.updatedAt = new Date("2026-05-12T10:00:00.000Z");
    fixture.sessionManager.save(firstSession);
    const secondSession = fixture.sessionManager.getOrCreate("second-session");
    secondSession.createdAt = new Date("2026-05-12T09:00:00.000Z");
    secondSession.updatedAt = new Date("2026-05-12T09:00:00.000Z");
    fixture.sessionManager.save(secondSession);

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
    const fixture = createServiceFixture();
    const events: string[] = [];
    fixture.eventBus.subscribeAll((event) => {
      events.push(event.type);
    });
    const session = fixture.sessionManager.getOrCreate("session-1");
    session.metadata = { label: "Before" };
    fixture.sessionManager.save(session);

    const updated = await fixture.ncpSessionApi.updateSession("session-1", {
      metadata: { label: "After" },
    });
    await fixture.ncpSessionApi.deleteSession("session-1");

    expect(updated?.metadata).toEqual({ label: "After" });
    expect(events).toEqual(["session.summary.upsert", "session.summary.delete"]);
    fixture.ncpSessionApi.dispose();
  });

  it("publishes summaries from kernel session update events during its lifecycle", async () => {
    const fixture = createServiceFixture();
    const events: string[] = [];
    fixture.eventBus.subscribeAll((event) => {
      events.push(event.type);
    });
    fixture.sessionManager.save(fixture.sessionManager.getOrCreate("session-1"));

    fixture.ncpSessionApi.start();
    fixture.eventBus.emit(eventKeys.sessionUpdated, { sessionKey: "session-1" });
    await vi.waitFor(() => {
      expect(events).toContain("session.summary.upsert");
    });

    fixture.ncpSessionApi.dispose();
  });
});
