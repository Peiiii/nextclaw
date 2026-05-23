import { describe, expect, it, vi } from "vitest";
import { CONTEXT_COMPACTION_METADATA_KEY } from "@nextclaw/core";
import {
  NcpEventType,
  type NcpAgentSendEnvelope,
  type NcpAgentRunInput,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import {
  DefaultNcpAgentConversationStateManager,
  InMemoryAgentSessionStore,
  type AgentSessionEventRecord,
  type AgentSessionRecord,
  type RuntimeFactoryParams,
} from "@nextclaw/ncp-toolkit";
import {
  EventBus,
  Ingress,
  ingressKeys,
  type AgentRunSendIngressPayload,
} from "@nextclaw/shared";
import { AgentRunRequestManager } from "@kernel/managers/agent-run-request.manager.js";
import type { AgentRuntimeManager } from "@kernel/managers/agent-runtime.manager.js";
import { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import { ContextCompactionManager } from "@kernel/features/context-compaction/index.js";

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

function createContextCompactionManager(sessionRunManager: SessionRunManager): ContextCompactionManager {
  return new ContextCompactionManager({
    configManager: { loadConfig: createConfig } as never,
    sessionRunManager,
  });
}

function createRuntimeManagerStub() {
  const runtimeInputs: NcpAgentRunInput[] = [];
  const runtimeFactoryParams: RuntimeFactoryParams[] = [];
  const runtimeManager = {
    createRuntime: vi.fn((params: RuntimeFactoryParams): NcpAgentRuntime => {
      runtimeFactoryParams.push(params);
      return {
        run: async function* (input: NcpAgentRunInput): AsyncGenerator<NcpEndpointEvent> {
          runtimeInputs.push(input);
          const runId = (input as NcpAgentRunInput & { runId?: string }).runId ?? "missing-run-id";
          yield {
            type: NcpEventType.RunStarted,
            payload: {
              sessionId: input.sessionId,
              messageId: "assistant-message-1",
              runId,
            },
          };
        },
      };
    }),
    listSessionTypes: vi.fn(() => ({ defaultType: "native", options: [] })),
    resolveSessionMetadata: vi.fn((metadata: Record<string, unknown>) => ({
      ...metadata,
      runtime: "native",
      session_type: "native",
      runtime_type: "native",
    })),
  } as Pick<AgentRuntimeManager, "createRuntime" | "listSessionTypes" | "resolveSessionMetadata">;
  return {
    runtimeFactoryParams,
    runtimeInputs,
    runtimeManager: runtimeManager as AgentRuntimeManager,
  };
}

function createDispatchingRuntimeManagerStub() {
  const runtimeManager = {
    createRuntime: vi.fn((params: RuntimeFactoryParams): NcpAgentRuntime => ({
      run: async function* (input: NcpAgentRunInput): AsyncGenerator<NcpEndpointEvent> {
        const runId = (input as NcpAgentRunInput & { runId?: string }).runId ?? "missing-run-id";
        const events: NcpEndpointEvent[] = [
          {
            type: NcpEventType.RunStarted,
            payload: { sessionId: input.sessionId, messageId: "assistant-message-1", runId },
          },
          {
            type: NcpEventType.MessageTextStart,
            payload: { sessionId: input.sessionId, messageId: "assistant-message-1" },
          },
          {
            type: NcpEventType.MessageTextDelta,
            payload: { sessionId: input.sessionId, messageId: "assistant-message-1", delta: "hello " },
          },
          {
            type: NcpEventType.MessageTextDelta,
            payload: { sessionId: input.sessionId, messageId: "assistant-message-1", delta: "world" },
          },
          {
            type: NcpEventType.MessageTextEnd,
            payload: { sessionId: input.sessionId, messageId: "assistant-message-1" },
          },
          {
            type: NcpEventType.RunFinished,
            payload: { sessionId: input.sessionId, messageId: "assistant-message-1", runId },
          },
        ];
        for (const event of events) {
          await params.stateManager.dispatch(event);
          yield event;
        }
      },
    })),
    listSessionTypes: vi.fn(() => ({ defaultType: "native", options: [] })),
    resolveSessionMetadata: vi.fn((metadata: Record<string, unknown>) => ({
      ...metadata,
      runtime: "native",
      session_type: "native",
      runtime_type: "native",
    })),
  } as Pick<AgentRuntimeManager, "createRuntime" | "listSessionTypes" | "resolveSessionMetadata">;
  return runtimeManager as AgentRuntimeManager;
}

class TestNcpSessionManager {
  constructor(private readonly sessionStore: InMemoryAgentSessionStore) {}

  createSession = async (params: {
    task: string;
    title?: string;
    sourceSessionMetadata: Record<string, unknown>;
    metadataOverrides?: Record<string, unknown>;
    agentId?: string;
    sessionType?: string;
  }) => {
    const { agentId, metadataOverrides, sessionType, task, title } = params;
    const sessionId = `ncp-${Math.random().toString(16).slice(2)}`;
    const now = new Date().toISOString();
    const metadata = {
      session_type: sessionType ?? "native",
      runtime: sessionType ?? "native",
      label: title ?? task,
      ...(metadataOverrides ? structuredClone(metadataOverrides) : {}),
    };
    await this.sessionStore.saveSession({
      sessionId,
      ...(agentId ? { agentId } : {}),
      messages: [],
      createdAt: now,
      updatedAt: now,
      metadata,
    });
    return {
      sessionId,
      ...(agentId ? { agentId } : {}),
      sessionType: sessionType ?? "native",
      runtimeFamily: "native" as const,
      lifecycle: "persistent" as const,
      title: title ?? task,
      metadata,
      createdAt: now,
      updatedAt: now,
    };
  };

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
    await this.sessionStore.setSessionMetadata({
      sessionId,
      metadata,
      updatedAt: new Date().toISOString(),
    });
    return true;
  };

  updateSessionMetadata = async (
    sessionId: string,
    metadata: Record<string, unknown>,
  ): Promise<boolean> => {
    const session = await this.sessionStore.getSession(sessionId);
    if (!session) {
      return false;
    }
    await this.sessionStore.updateSessionMetadata({
      sessionId,
      metadata,
      updatedAt: new Date().toISOString(),
    });
    return true;
  };

  appendSessionEvent = async (params: {
    session: AgentSessionEventRecord;
    event: NcpEndpointEvent;
    updatedAt: string;
  }): Promise<void> => {
    const { event, session, updatedAt } = params;
    const existing = await this.sessionStore.getSession(session.sessionId);
    const stateManager = new DefaultNcpAgentConversationStateManager();
    stateManager.hydrate({
      sessionId: session.sessionId,
      messages: existing?.messages ?? [],
    });
    await stateManager.dispatch(event);
    const snapshot = stateManager.getSnapshot();
    const latest = await this.sessionStore.getSession(session.sessionId);
    await this.sessionStore.saveSession({
      sessionId: session.sessionId,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      messages: [
        ...snapshot.messages.map((message) => structuredClone(message)),
        ...(snapshot.streamingMessage ? [structuredClone(snapshot.streamingMessage)] : []),
      ],
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

describe("AgentRunRequestManager", () => {
  it("materializes raw send envelopes before runtime execution", async () => {
    const ingress = new Ingress();
    const {
      runtimeFactoryParams,
      runtimeInputs,
      runtimeManager,
    } = createRuntimeManagerStub();
    const sessionStore = new InMemoryAgentSessionStore();
    const ncpSessionManager = new TestNcpSessionManager(sessionStore);
    const sessionRunManager = new SessionRunManager({
      agentRuntimeManager: runtimeManager,
      eventBus: new EventBus(),
      ncpSessionManager: ncpSessionManager as never,
    });
    const manager = new AgentRunRequestManager({
      contextCompactionManager: createContextCompactionManager(sessionRunManager),
      ingress,
      ncpSessionManager: ncpSessionManager as never,
      sessionRunManager,
    });
    manager.start();

    const handle = await ingress.handle<NcpAgentSendEnvelope, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        metadata: {
          label: "Draft run",
          preferred_model: "openai/gpt-5",
          session_type: "native",
        },
        message: {
          id: "user-message-1",
          role: "user",
          status: "final",
          timestamp: "2026-05-20T00:00:00.000Z",
          parts: [{ type: "text", text: "hello" }],
        },
      },
    }, { source: "test" });

    expect(runtimeFactoryParams).toHaveLength(1);
    expect(runtimeInputs).toHaveLength(1);
    const runtimeRunId = (runtimeInputs[0] as (NcpAgentRunInput & { runId?: string }) | undefined)?.runId;
    expect(runtimeInputs[0]?.sessionId).toMatch(/^ncp-/);
    expect(runtimeRunId).toMatch(/^ncp-run-/);
    expect(runtimeInputs[0]?.messages[0]?.sessionId).toBe(runtimeInputs[0]?.sessionId);
    expect(runtimeInputs[0]?.metadata).toMatchObject({
      label: "Draft run",
      preferred_model: "openai/gpt-5",
      session_type: "native",
    });
    expect(runtimeFactoryParams[0]?.sessionId).toBe(runtimeInputs[0]?.sessionId);
    await expect(sessionStore.getSession(runtimeInputs[0]?.sessionId ?? "")).resolves.toMatchObject({
      sessionId: runtimeInputs[0]?.sessionId,
    });
    expect(handle).toEqual({
      sessionId: runtimeInputs[0]?.sessionId,
      userMessageId: "user-message-1",
      assistantMessageId: "assistant-message-1",
      runId: runtimeRunId,
    });
    await manager.dispose();
    await sessionRunManager.dispose();
  });

  it("materializes content ingress payloads into user messages", async () => {
    const ingress = new Ingress();
    const {
      runtimeFactoryParams,
      runtimeInputs,
      runtimeManager,
    } = createRuntimeManagerStub();
    const sessionStore = new InMemoryAgentSessionStore();
    const ncpSessionManager = new TestNcpSessionManager(sessionStore);
    const sessionRunManager = new SessionRunManager({
      agentRuntimeManager: runtimeManager,
      eventBus: new EventBus(),
      ncpSessionManager: ncpSessionManager as never,
    });
    const manager = new AgentRunRequestManager({
      contextCompactionManager: createContextCompactionManager(sessionRunManager),
      ingress,
      ncpSessionManager: ncpSessionManager as never,
      sessionRunManager,
    });
    manager.start();

    const handle = await ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        metadata: { session_type: "native" },
        content: [
          { type: "text", text: "analyze this" },
          { type: "file", url: "https://example.com/a.pdf", name: "a.pdf" },
        ],
      },
    }, { source: "test" });

    const userMessage = runtimeInputs[0]?.messages[0];
    expect(userMessage).toMatchObject({
      role: "user",
      status: "final",
      parts: [
        { type: "text", text: "analyze this" },
        { type: "file", url: "https://example.com/a.pdf", name: "a.pdf" },
      ],
    });
    expect(userMessage?.id).toMatch(/^user-message-/);
    expect(userMessage?.timestamp).toEqual(expect.any(String));
    expect(userMessage?.sessionId).toBe(runtimeInputs[0]?.sessionId);
    expect(runtimeFactoryParams[0]?.sessionId).toBe(runtimeInputs[0]?.sessionId);
    expect(handle.userMessageId).toBe(userMessage?.id);
    await manager.dispose();
    await sessionRunManager.dispose();
  });
});

describe("AgentRunRequestManager runtime orchestration", () => {
  it("does not apply runtime text deltas twice to the persisted assistant preview source", async () => {
    const ingress = new Ingress();
    const sessionStore = new InMemoryAgentSessionStore();
    const ncpSessionManager = new TestNcpSessionManager(sessionStore);
    const sessionRunManager = new SessionRunManager({
      agentRuntimeManager: createDispatchingRuntimeManagerStub(),
      eventBus: new EventBus(),
      ncpSessionManager: ncpSessionManager as never,
    });
    const manager = new AgentRunRequestManager({
      contextCompactionManager: createContextCompactionManager(sessionRunManager),
      ingress,
      ncpSessionManager: ncpSessionManager as never,
      sessionRunManager,
    });
    manager.start();

    const handle = await ingress.handle<NcpAgentSendEnvelope, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        message: {
          id: "user-message-1",
          role: "user",
          status: "final",
          timestamp: "2026-05-20T00:00:00.000Z",
          parts: [{ type: "text", text: "ping" }],
        },
      },
    }, { source: "test" });

    await vi.waitFor(async () => {
      const session = await sessionStore.getSession(handle.sessionId);
      const assistantMessage = session?.messages.find((message) => message.id === "assistant-message-1");
      expect(assistantMessage?.parts).toEqual([{ type: "text", text: "hello world" }]);
    });
    await manager.dispose();
    await sessionRunManager.dispose();
  });

  it("does not put the current user message into runtime state before runtime builds context", async () => {
    const ingress = new Ingress();
    const preRunMessageCounts: number[] = [];
    const sessionStore = new InMemoryAgentSessionStore();
    const runtimeManager = {
      createRuntime: vi.fn((params: RuntimeFactoryParams): NcpAgentRuntime => ({
        run: async function* (input: NcpAgentRunInput): AsyncGenerator<NcpEndpointEvent> {
          preRunMessageCounts.push(params.stateManager.getSnapshot().messages.length);
          for (const message of input.messages) {
            await params.stateManager.dispatch({
              type: NcpEventType.MessageSent,
              payload: { sessionId: input.sessionId, message },
            });
          }
          yield {
            type: NcpEventType.RunStarted,
            payload: {
              sessionId: input.sessionId,
              messageId: "assistant-message-1",
              runId: (input as NcpAgentRunInput & { runId?: string }).runId ?? "missing-run-id",
            },
          };
        },
      })),
      listSessionTypes: vi.fn(() => ({ defaultType: "native", options: [] })),
      resolveSessionMetadata: vi.fn((metadata: Record<string, unknown>) => ({
        ...metadata,
        runtime: "native",
        session_type: "native",
        runtime_type: "native",
      })),
    } as Pick<AgentRuntimeManager, "createRuntime" | "listSessionTypes" | "resolveSessionMetadata">;
    const ncpSessionManager = new TestNcpSessionManager(sessionStore);
    const sessionRunManager = new SessionRunManager({
      agentRuntimeManager: runtimeManager as AgentRuntimeManager,
      eventBus: new EventBus(),
      ncpSessionManager: ncpSessionManager as never,
    });
    const manager = new AgentRunRequestManager({
      contextCompactionManager: createContextCompactionManager(sessionRunManager),
      ingress,
      ncpSessionManager: ncpSessionManager as never,
      sessionRunManager,
    });
    manager.start();

    const handle = await ingress.handle<NcpAgentSendEnvelope, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        message: {
          id: "user-message-1",
          role: "user",
          status: "final",
          timestamp: "2026-05-20T00:00:00.000Z",
          parts: [{ type: "text", text: "ping" }],
        },
      },
    }, { source: "test" });

    expect(preRunMessageCounts).toEqual([0]);
    const session = await sessionStore.getSession(handle.sessionId);
    expect(session?.messages.filter((message) => message.id === "user-message-1")).toHaveLength(1);
    await manager.dispose();
    await sessionRunManager.dispose();
  });

  it("applies context compaction metadata patches without replacing session metadata", async () => {
    const ingress = new Ingress();
    const {
      runtimeManager,
    } = createRuntimeManagerStub();
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
    const ncpSessionManager = new TestNcpSessionManager(sessionStore);
    const sessionRunManager = new SessionRunManager({
      agentRuntimeManager: runtimeManager,
      eventBus: new EventBus(),
      ncpSessionManager: ncpSessionManager as never,
    });
    let storedMetadata: Record<string, unknown> | null = null;
    const runLivePreflight = vi.fn(async function* (params: {
      input: NcpAgentRunInput;
      session: Awaited<ReturnType<SessionRunManager["getOrCreateLiveSession"]>>;
    }): AsyncIterable<NcpEndpointEvent> {
      const { input, session } = params;
      storedMetadata = structuredClone(session.metadata);
      await sessionRunManager.updateSessionMetadata(session.sessionId, {
        [CONTEXT_COMPACTION_METADATA_KEY]: { id: "checkpoint-1", status: "compressing" },
      });
      const contextWindowEvent = {
        type: NcpEventType.ContextWindowUpdated,
        payload: {
          sessionId: input.sessionId,
          contextWindow: { usedContextTokens: 1, totalContextTokens: 10 },
        },
      } as const;
      await sessionRunManager.appendSessionEvent(session.sessionId, contextWindowEvent);
      yield contextWindowEvent;
    });
    const manager = new AgentRunRequestManager({
      contextCompactionManager: {
        runLivePreflight,
      } as unknown as ContextCompactionManager,
      ingress,
      ncpSessionManager: ncpSessionManager as never,
      sessionRunManager,
    });

    const events = [];
    for await (const event of manager.run({
      sessionId: "session-1",
      message: {
        id: "user-message-1",
        role: "user",
        status: "final",
        timestamp: "2026-05-22T00:00:00.000Z",
        parts: [{ type: "text", text: "ping" }],
      },
      metadata: {},
    })) {
      events.push(event);
    }

    const stored = await sessionStore.getSession("session-1");
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: NcpEventType.ContextWindowUpdated }),
    ]));
    expect(runLivePreflight).toHaveBeenCalledTimes(1);
    expect(storedMetadata).toMatchObject({
      last_activity_preview: expect.objectContaining({ state: "running" }),
    });
    expect(stored?.metadata).toMatchObject({
      [CONTEXT_COMPACTION_METADATA_KEY]: { status: "compressing" },
      last_activity_preview: { state: "running" },
      runtime: "native",
    });
    await manager.dispose();
    await sessionRunManager.dispose();
  });
});
