import { describe, expect, it, vi } from "vitest";
import { EventBus, eventKeys } from "@nextclaw/shared";

vi.mock("@kernel/agent-runtime/context/context-compaction-preflight.service.js", () => ({
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
    updatedAt: string;
  }) => {
    const { agentId, messages, metadata, sessionId, status, updatedAt } = params;
    return {
      ...(agentId ? { agentId } : {}),
      messageCount: messages.length,
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
      updatedAt: new Date("2026-05-12T00:00:00.000Z"),
    };
    this.sessions.set(key, session);
    return session;
  };

  getIfExists = (key: string): TestSession | null => this.sessions.get(key) ?? null;

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
      created_at: "2026-05-12T00:00:00.000Z",
      updated_at: session.updatedAt.toISOString(),
      path: session.key,
      ...(session.agentId ? { agentId: session.agentId } : {}),
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
