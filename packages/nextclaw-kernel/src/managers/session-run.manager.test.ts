import { describe, expect, it, vi } from "vitest";
import { NcpEventType, type NcpAgentRuntime, type NcpEndpointEvent } from "@nextclaw/ncp";
import { EventBus, eventKeys } from "@nextclaw/shared";
import {
  InMemoryAgentSessionStore,
  type AgentSessionEventRecord,
  type AgentSessionRecord,
  type RuntimeFactoryParams,
} from "@nextclaw/ncp-toolkit";
import { SessionRunManager } from "./session-run.manager.js";
import type { AgentRuntimeManager } from "./agent-runtime.manager.js";

function createRuntimeManagerStub(): AgentRuntimeManager {
  return {
    createRuntime: vi.fn((_params: RuntimeFactoryParams): NcpAgentRuntime => ({
      run: async function* (): AsyncGenerator<never> {},
    })),
    listSessionTypes: vi.fn(() => ({ defaultType: "native", options: [] })),
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
  } as unknown as AgentRuntimeManager;
}

class AppendRecordingSessionStore extends InMemoryAgentSessionStore {
  readonly appendSessionMetadata: Record<string, unknown>[] = [];

  override appendSessionEvent = async (params: {
    session: AgentSessionEventRecord;
    event: NcpEndpointEvent;
    updatedAt: string;
  }): Promise<void> => {
    const { session, updatedAt } = params;
    this.appendSessionMetadata.push(structuredClone(session.metadata ?? {}));
    const existing = await this.getSession(session.sessionId);
    await this.saveSession({
      sessionId: session.sessionId,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      messages: existing?.messages ?? [],
      createdAt: existing?.createdAt ?? session.createdAt ?? updatedAt,
      updatedAt,
      metadata: {
        ...(existing?.metadata ? structuredClone(existing.metadata) : {}),
        ...(session.metadata ? structuredClone(session.metadata) : {}),
      },
    });
  };
}

class TestNcpSessionManager {
  private liveMetadataPatcher: ((sessionId: string, metadata: Record<string, unknown>) => void) | null = null;

  constructor(private readonly sessionStore: InMemoryAgentSessionStore) {}

  installLiveMetadataPatcher = (patcher: (sessionId: string, metadata: Record<string, unknown>) => void) => {
    this.liveMetadataPatcher = patcher;
  };

  getSessionRecord = async (sessionId: string): Promise<AgentSessionRecord | null> =>
    await this.sessionStore.getSession(sessionId);

  patchSessionMetadata = async (
    sessionId: string,
    patcher: (metadata: Record<string, unknown>) => Record<string, unknown> | null,
  ): Promise<boolean> => {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      return false;
    }
    const nextMetadata = patcher(structuredClone(session.metadata ?? {}));
    if (!nextMetadata) {
      return false;
    }
    await this.sessionStore.updateSessionMetadata({
      sessionId,
      metadata: nextMetadata,
      updatedAt: new Date().toISOString(),
    });
    this.liveMetadataPatcher?.(sessionId, nextMetadata);
    return true;
  };

  appendSessionEvent = async (params: {
    session: AgentSessionEventRecord;
    event: NcpEndpointEvent;
    updatedAt: string;
  }): Promise<void> => {
    const { event, session, updatedAt } = params;
    const existing = await this.sessionStore.getSession(session.sessionId);
    const appendable = this.sessionStore as InMemoryAgentSessionStore & {
      appendSessionEvent?: (input: typeof params) => Promise<void>;
    };
    if (appendable.appendSessionEvent) {
      await appendable.appendSessionEvent({
        event,
        updatedAt,
        session: {
          ...session,
          metadata: existing ? {} : structuredClone(session.metadata ?? {}),
        },
      });
      return;
    }
    const latest = await this.sessionStore.getSession(session.sessionId);
    await this.sessionStore.saveSession({
      sessionId: session.sessionId,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      messages: latest?.messages ?? existing?.messages ?? [],
      createdAt: latest?.createdAt ?? existing?.createdAt ?? session.createdAt ?? updatedAt,
      updatedAt,
      metadata: {
        ...(latest?.metadata
          ? structuredClone(latest.metadata)
          : existing?.metadata
            ? structuredClone(existing.metadata)
            : {}),
        ...(existing ? {} : structuredClone(session.metadata ?? {})),
      },
    });
  };
}

describe("SessionRunManager", () => {
  it("patches live metadata from the in-memory session truth", async () => {
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

    const readAtPatch = manager.patchSessionMetadata("session-1", (metadata) => ({
      ...metadata,
      ui_last_read_at: "2026-05-22T00:00:01.000Z",
    }));
    const previewPatch = manager.patchSessionMetadata("session-1", (metadata) => ({
      ...metadata,
      last_activity_preview: {
        state: "running",
        timestamp: "2026-05-22T00:00:02.000Z",
        statusText: "正在调用工具：exec",
      },
    }));
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

  it("does not send stale live metadata snapshots through event appends for existing sessions", async () => {
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
    await manager.patchSessionMetadata("session-1", (metadata) => ({
      ...metadata,
      last_activity_preview: { state: "completed", timestamp: "2026-05-22T00:00:01.000Z" },
    }));

    await manager.appendSessionEvent("session-1", {
      type: NcpEventType.RunFinished,
      payload: { sessionId: "session-1", runId: "run-1" },
    }, { dispatchToStateManager: false });

    const stored = await sessionStore.getSession("session-1");
    expect(sessionStore.appendSessionMetadata).toEqual([{}]);
    expect(stored?.metadata).toMatchObject({
      label: "Live session",
      last_activity_preview: { state: "completed" },
    });
    await manager.dispose();
  });

  it("merges runtime metadata updates without dropping activity preview metadata", async () => {
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
    runtimeParams?.setSessionMetadata({ runtime: "native" });
    await manager.appendSessionEvent("session-1", {
      type: NcpEventType.RunFinished,
      payload: { sessionId: "session-1", runId: "run-1" },
    }, { dispatchToStateManager: false });

    await vi.waitFor(async () => {
      const stored = await sessionStore.getSession("session-1");
      expect(stored?.metadata).toMatchObject({
        runtime: "native",
        last_activity_preview: { state: "running" },
      });
    });
    await manager.dispose();
  });

  it("patches stored metadata through the same owner API when the session is not live", async () => {
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

    const patched = await manager.patchSessionMetadata("session-1", (metadata) => ({
      ...metadata,
      last_activity_preview: {
        state: "completed",
        timestamp: "2026-05-22T00:00:01.000Z",
        replyText: "final preview",
      },
    }));

    const stored = await sessionStore.getSession("session-1");
    expect(patched).toBe(true);
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
