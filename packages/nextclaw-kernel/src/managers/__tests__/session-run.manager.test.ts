import { describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpAgentRuntime, type NcpEndpointEvent } from "@nextclaw/ncp";
import { EventBus, eventKeys } from "@nextclaw/shared";
import {
  InMemoryAgentSessionStore,
  type AgentSessionRecord,
  type RuntimeFactoryParams,
} from "@nextclaw/ncp-toolkit";
import { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import type { AgentRuntimeManager } from "@kernel/managers/agent-runtime.manager.js";

function createRuntimeManagerStub(): AgentRuntimeManager {
  return {
    createRuntime: vi.fn((_params: RuntimeFactoryParams): NcpAgentRuntime => ({
      run: async function* (): AsyncGenerator<never> {},
    })),
    listSessionTypes: vi.fn(() => ({ defaultType: "native", options: [] })),
    resolveSessionMetadata: vi.fn((metadata: Record<string, unknown>) => ({
      ...metadata,
      runtime: "native",
      session_type: "native",
      runtime_type: "native",
    })),
  } as unknown as AgentRuntimeManager;
}

function createRuntimeManagerCapture(
  onCreate: (params: RuntimeFactoryParams) => void,
): AgentRuntimeManager {
  return {
    createRuntime: vi.fn((params: RuntimeFactoryParams): NcpAgentRuntime => {
      onCreate(params);
      return { run: async function* (): AsyncGenerator<never> {} };
    }),
    listSessionTypes: vi.fn(() => ({ defaultType: "native", options: [] })),
    resolveSessionMetadata: vi.fn((metadata: Record<string, unknown>) => ({
      ...metadata,
      runtime: "native",
      session_type: "native",
      runtime_type: "native",
    })),
  } as unknown as AgentRuntimeManager;
}

class AppendRecordingSessionStore extends InMemoryAgentSessionStore {
  readonly appendSessionMetadata: Array<Record<string, unknown> | undefined> = [];

  appendSessionEvent = async (params: {
    event: NcpEndpointEvent;
    sessionId: string;
  }): Promise<void> => {
    const { sessionId } = params;
    const updatedAt = new Date().toISOString();
    this.appendSessionMetadata.push(undefined);
    const existing = await this.getSession(sessionId);
    await this.saveSession({
      sessionId,
      ...(existing?.agentId ? { agentId: existing.agentId } : {}),
      messages: existing?.messages ?? [],
      createdAt: existing?.createdAt ?? updatedAt,
      updatedAt,
      metadata: {
        ...(existing?.metadata ? structuredClone(existing.metadata) : {}),
      },
    });
  };
}

class TestNcpSessionManager {
  private writeChain = Promise.resolve();

  constructor(private readonly sessionStore: InMemoryAgentSessionStore) {}

  getSessionRecord = async (sessionId: string): Promise<AgentSessionRecord | null> =>
    await this.sessionStore.getSession(sessionId);

  setSessionMetadata = async (
    sessionId: string,
    metadata: Record<string, unknown>,
  ): Promise<boolean> => {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      return false;
    }
    await this.sessionStore.saveSession({
      ...session,
      metadata: structuredClone(metadata),
    });
    return true;
  };

  updateSessionMetadata = async (
    sessionId: string,
    metadata: Record<string, unknown>,
  ): Promise<boolean> => {
    const next = this.writeChain.then(async () => this.updateSessionMetadataNow(sessionId, metadata));
    this.writeChain = next.then(() => undefined, () => undefined);
    return await next;
  };

  private updateSessionMetadataNow = async (
    sessionId: string,
    metadata: Record<string, unknown>,
  ): Promise<boolean> => {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      return false;
    }
    await this.sessionStore.saveSession({
      ...session,
      metadata: {
        ...(session.metadata ? structuredClone(session.metadata) : {}),
        ...structuredClone(metadata),
      },
    });
    return true;
  };

  appendSessionEvent = async (params: {
    event: NcpEndpointEvent;
    sessionId: string;
  }): Promise<void> => {
    const { sessionId } = params;
    const updatedAt = new Date().toISOString();
    const existing = await this.sessionStore.getSession(sessionId);
    const appendable = this.sessionStore as InMemoryAgentSessionStore & {
      appendSessionEvent?: (input: typeof params) => Promise<void>;
    };
    if (appendable.appendSessionEvent) {
      await appendable.appendSessionEvent(params);
      return;
    }
    const latest = await this.sessionStore.getSession(sessionId);
    await this.sessionStore.saveSession({
      sessionId,
      ...(latest?.agentId ?? existing?.agentId ? { agentId: latest?.agentId ?? existing?.agentId } : {}),
      messages: latest?.messages ?? existing?.messages ?? [],
      createdAt: latest?.createdAt ?? existing?.createdAt ?? updatedAt,
      updatedAt,
      metadata: {
        ...(latest?.metadata
          ? structuredClone(latest.metadata)
          : existing?.metadata
            ? structuredClone(existing.metadata)
            : {}),
      },
    });
  };
}

describe("SessionRunManager", () => {
  it("updates stored metadata through the session metadata owner", async () => {
    const sessionStore = new InMemoryAgentSessionStore();
    await sessionStore.saveSession({
      sessionId: "session-1",
      messages: [],
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T00:00:00.000Z",
      metadata: {},
    });
    const manager = new SessionRunManager({
      agentRuntimeManager: createRuntimeManagerStub(),
      eventBus: new EventBus(),
      ncpSessionManager: new TestNcpSessionManager(sessionStore) as never,
    });
    await manager.getOrCreateLiveSession("session-1");

    const readAtPatch = manager.updateSessionMetadata("session-1", {
      ui_last_read_at: "2026-05-22T00:00:01.000Z",
    });
    const previewPatch = manager.updateSessionMetadata("session-1", {
      last_activity_preview: {
        state: "running",
        timestamp: "2026-05-22T00:00:02.000Z",
        statusText: "正在调用工具：exec",
      },
    });
    await Promise.all([readAtPatch, previewPatch]);

    const stored = await sessionStore.getSession("session-1");
    expect(stored?.metadata).toMatchObject({
      ui_last_read_at: "2026-05-22T00:00:01.000Z",
      last_activity_preview: {
        state: "running",
        statusText: "正在调用工具：exec",
      },
    });
    await manager.dispose();
  });

  it("does not send metadata snapshots through event appends for existing sessions", async () => {
    const sessionStore = new AppendRecordingSessionStore();
    await sessionStore.saveSession({
      sessionId: "session-1",
      messages: [],
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T00:00:00.000Z",
      metadata: { label: "Live session" },
    });
    const manager = new SessionRunManager({
      agentRuntimeManager: createRuntimeManagerStub(),
      eventBus: new EventBus(),
      ncpSessionManager: new TestNcpSessionManager(sessionStore) as never,
    });
    await manager.getOrCreateLiveSession("session-1");
    await manager.updateSessionMetadata("session-1", {
      last_activity_preview: { state: "completed", timestamp: "2026-05-22T00:00:01.000Z" },
    });

    await manager.appendSessionEvent("session-1", {
      type: NcpEventType.RunFinished,
      payload: { sessionId: "session-1", runId: "run-1" },
    }, { dispatchToStateManager: false });

    const stored = await sessionStore.getSession("session-1");
    expect(sessionStore.appendSessionMetadata).toEqual([undefined]);
    expect(stored?.metadata).toMatchObject({
      label: "Live session",
      last_activity_preview: { state: "completed" },
    });
    await manager.dispose();
  });

  it("resolves runtime metadata without dropping activity preview metadata", async () => {
    const sessionStore = new InMemoryAgentSessionStore();
    await sessionStore.saveSession({
      sessionId: "session-1",
      messages: [],
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T00:00:00.000Z",
      metadata: {
        last_activity_preview: {
          state: "running",
          timestamp: "2026-05-22T00:00:01.000Z",
        },
      },
    });
    let runtimeParams: RuntimeFactoryParams | null = null;
    const manager = new SessionRunManager({
      agentRuntimeManager: createRuntimeManagerCapture((params) => {
        runtimeParams = params;
      }),
      eventBus: new EventBus(),
      ncpSessionManager: new TestNcpSessionManager(sessionStore) as never,
    });
    await manager.getOrCreateLiveSession("session-1");
    await manager.appendSessionEvent("session-1", {
      type: NcpEventType.RunFinished,
      payload: { sessionId: "session-1", runId: "run-1" },
    }, { dispatchToStateManager: false });

    await vi.waitFor(async () => {
      const stored = await sessionStore.getSession("session-1");
      expect(stored?.metadata).toMatchObject({
        runtime: "native",
        runtime_type: "native",
        last_activity_preview: { state: "running" },
      });
    });
    expect(runtimeParams?.sessionMetadata).toMatchObject({
      runtime: "native",
      runtime_type: "native",
      last_activity_preview: { state: "running" },
    });
    await manager.dispose();
  });

});

describe("SessionRunManager stored metadata and event streams", () => {
  it("updates stored metadata through the same owner API when the session is not live", async () => {
    const sessionStore = new InMemoryAgentSessionStore();
    await sessionStore.saveSession({
      sessionId: "session-1",
      messages: [],
      createdAt: "2026-05-22T00:00:00.000Z",
      updatedAt: "2026-05-22T00:00:00.000Z",
      metadata: { label: "Stored session" },
    });
    const manager = new SessionRunManager({
      agentRuntimeManager: createRuntimeManagerStub(),
      eventBus: new EventBus(),
      ncpSessionManager: new TestNcpSessionManager(sessionStore) as never,
    });

    const updated = await manager.updateSessionMetadata("session-1", {
      last_activity_preview: {
        state: "completed",
        timestamp: "2026-05-22T00:00:01.000Z",
        replyText: "final preview",
      },
    });

    const stored = await sessionStore.getSession("session-1");
    expect(updated).toBe(true);
    expect(stored?.metadata).toMatchObject({
      label: "Stored session",
      last_activity_preview: {
        state: "completed",
        replyText: "final preview",
      },
    });
    await manager.dispose();
  });

  it("exposes live streaming messages for context-window projection", async () => {
    const sessionStore = new InMemoryAgentSessionStore();
    const manager = new SessionRunManager({
      agentRuntimeManager: createRuntimeManagerStub(),
      eventBus: new EventBus(),
      ncpSessionManager: new TestNcpSessionManager(sessionStore) as never,
    });
    await manager.getOrCreateLiveSession("session-1");

    await manager.appendSessionEvent("session-1", {
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        toolCallId: "tool-1",
        toolName: "exec",
      },
    });

    expect(manager.getLiveSessionRecord("session-1")?.messages).toEqual([
      expect.objectContaining({
        id: "assistant-1",
        parts: [
          expect.objectContaining({
            toolCallId: "tool-1",
            toolName: "exec",
          }),
        ],
      }),
    ]);
    await manager.dispose();
  });

  it("streams ncp events from the shared event bus by session id", async () => {
    const sessionStore = new InMemoryAgentSessionStore();
    const eventBus = new EventBus();
    const manager = new SessionRunManager({
      agentRuntimeManager: createRuntimeManagerStub(),
      eventBus,
      ncpSessionManager: new TestNcpSessionManager(sessionStore) as never,
    });
    const controller = new AbortController();
    const iterator = manager
      .streamSessionEvents({ sessionId: "session-1" }, { signal: controller.signal })
      [Symbol.asyncIterator]();
    const nextEvent = iterator.next();

    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.ContextWindowUpdated,
      payload: {
        sessionId: "other-session",
        contextWindow: { usedContextTokens: 1, totalContextTokens: 10 },
      },
    });
    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.ContextWindowUpdated,
      payload: {
        sessionId: "session-1",
        contextWindow: { usedContextTokens: 2, totalContextTokens: 10 },
      },
    });

    await expect(nextEvent).resolves.toMatchObject({
      done: false,
      value: {
        type: NcpEventType.ContextWindowUpdated,
        payload: {
          sessionId: "session-1",
          contextWindow: { usedContextTokens: 2, totalContextTokens: 10 },
        },
      },
    });
    controller.abort();
    await iterator.return?.();
    await manager.dispose();
  });
});
