import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionManager } from "@nextclaw/core";
import {
  NcpEventType,
  type NcpAgentSendEnvelope,
  type NcpAgentRunInput,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import { InMemoryAgentSessionStore, type RuntimeFactoryParams } from "@nextclaw/ncp-toolkit";
import {
  EventBus,
  Ingress,
  ingressKeys,
  type AgentRunSendIngressPayload,
} from "@nextclaw/shared";
import { AgentRunRequestManager } from "./agent-run-request.manager.js";
import type { AgentRuntimeManager } from "./agent-runtime.manager.js";
import { SessionRunManager } from "./session-run.manager.js";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-agent-run-request-manager-"));
  tempDirs.push(dir);
  return dir;
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

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("AgentRunRequestManager", () => {
  it("materializes raw send envelopes before runtime execution", async () => {
    const ingress = new Ingress();
    const sessions = new SessionManager({ sessionsDir: createTempDir() });
    const {
      runtimeFactoryParams,
      runtimeInputs,
      runtimeManager,
    } = createRuntimeManagerStub();
    const onSessionUpdated = vi.fn();
    const sessionRunManager = new SessionRunManager({
      agentRuntimeManager: runtimeManager,
      ncpAgentSessionStore: new InMemoryAgentSessionStore(),
      eventBus: new EventBus(),
      handleNcpEvent: vi.fn(),
      onSessionUpdated,
    });
    const manager = new AgentRunRequestManager({
      sessions,
      ingress,
      sessionRunManager,
      onSessionUpdated,
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
    expect(onSessionUpdated).toHaveBeenCalledWith(runtimeInputs[0]?.sessionId);
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
    const sessions = new SessionManager({ sessionsDir: createTempDir() });
    const {
      runtimeFactoryParams,
      runtimeInputs,
      runtimeManager,
    } = createRuntimeManagerStub();
    const onSessionUpdated = vi.fn();
    const sessionRunManager = new SessionRunManager({
      agentRuntimeManager: runtimeManager,
      ncpAgentSessionStore: new InMemoryAgentSessionStore(),
      eventBus: new EventBus(),
      handleNcpEvent: vi.fn(),
      onSessionUpdated,
    });
    const manager = new AgentRunRequestManager({
      sessions,
      ingress,
      sessionRunManager,
      onSessionUpdated,
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
    const sessions = new SessionManager({ sessionsDir: createTempDir() });
    const sessionStore = new InMemoryAgentSessionStore();
    const sessionRunManager = new SessionRunManager({
      agentRuntimeManager: createDispatchingRuntimeManagerStub(),
      ncpAgentSessionStore: sessionStore,
      eventBus: new EventBus(),
      handleNcpEvent: vi.fn(),
      onSessionUpdated: vi.fn(),
    });
    const manager = new AgentRunRequestManager({
      sessions,
      ingress,
      sessionRunManager,
      onSessionUpdated: vi.fn(),
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
    const sessions = new SessionManager({ sessionsDir: createTempDir() });
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
    const sessionRunManager = new SessionRunManager({
      agentRuntimeManager: runtimeManager as AgentRuntimeManager,
      ncpAgentSessionStore: sessionStore,
      eventBus: new EventBus(),
      handleNcpEvent: vi.fn(),
      onSessionUpdated: vi.fn(),
    });
    const manager = new AgentRunRequestManager({
      sessions,
      ingress,
      sessionRunManager,
      onSessionUpdated: vi.fn(),
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
