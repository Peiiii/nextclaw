import { describe, expect, it, vi } from "vitest";
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
import { AgentRunRequestManager } from "./agent-run-request.manager.js";
import type { AgentRuntimeManager } from "./agent-runtime.manager.js";
import { SessionRunManager } from "./session-run.manager.js";

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
  } as Pick<AgentRuntimeManager, "createRuntime" | "listSessionTypes">;
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
  } as Pick<AgentRuntimeManager, "createRuntime" | "listSessionTypes">;
  return runtimeManager as AgentRuntimeManager;
}

class TestNcpSessionManager {
  private liveMetadataPatcher: ((sessionId: string, metadata: Record<string, unknown>) => void) | null = null;

  constructor(private readonly sessionStore: InMemoryAgentSessionStore) {}

  installLiveMetadataPatcher = (patcher: (sessionId: string, metadata: Record<string, unknown>) => void) => {
    this.liveMetadataPatcher = patcher;
  };

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
    } as Pick<AgentRuntimeManager, "createRuntime" | "listSessionTypes">;
    const ncpSessionManager = new TestNcpSessionManager(sessionStore);
    const sessionRunManager = new SessionRunManager({
      agentRuntimeManager: runtimeManager as AgentRuntimeManager,
      eventBus: new EventBus(),
      ncpSessionManager: ncpSessionManager as never,
    });
    const manager = new AgentRunRequestManager({
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
});
