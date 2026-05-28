import { describe, expect, it } from "vitest";
import {
  EventBus,
  eventKeys,
  Ingress,
  ingressKeys,
  type AgentRunSendIngressPayload,
} from "@nextclaw/shared";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpRunHandle,
  type NcpTool,
} from "@nextclaw/ncp";
import { AgentRunRequestManager } from "@kernel/managers/agent-run-request.manager.js";
import { SessionRun } from "@kernel/managers/session-run.manager.js";

async function waitForEvent(
  events: readonly NcpEndpointEvent[],
  eventType: NcpEventType,
): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (events.some((event) => event.type === eventType)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("AgentRunRequestManager branch session creation", () => {
  it("uses the first user message as the new session task", async () => {
    const ingress = new Ingress();
    const getOrCreateAgentRunSessionCalls: Array<{
      agentRuntimeId?: string;
      metadata?: Record<string, unknown>;
      sessionId?: string;
      task?: string;
    }> = [];
    const manager = new AgentRunRequestManager(
      {
        getOrCreate: () => ({
          run: async function* (): AsyncGenerator<NcpEndpointEvent> {},
        }),
      } as never,
      {
        getDefaultModel: () => "test-model",
        getModelMaxTokens: () => 12000,
        loadConfig: () => ({}),
      } as never,
      { buildContext: async () => [] } as never,
      new EventBus(),
      ingress,
      {
        getOrCreateAgentRunSession: async (params: {
          agentRuntimeId?: string;
          metadata?: Record<string, unknown>;
          sessionId?: string;
          task?: string;
        }) => {
          getOrCreateAgentRunSessionCalls.push(params);
          return {
            sessionId: "session-1",
            agentId: "main",
            agentRuntimeId: "native",
            metadata: {},
            model: "test-model",
            thinkingEffort: null,
          };
        },
      } as never,
      {
        getSessionRun: () => null,
        createSessionRun: async () => ({
          inbox: { enqueue: () => undefined },
          beginRun: () => ({ runId: "run-1", signal: new AbortController().signal }),
        }),
      } as never,
      { buildTools: async () => [] } as never,
    );
    manager.start();

    const handle = await ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        content: [{ type: "text", text: "用户的第一句话" }],
        metadata: {
          agentRuntimeId: "codex",
        },
      },
    }, { source: "test" });

    expect(getOrCreateAgentRunSessionCalls[0]?.agentRuntimeId).toBe("codex");
    expect(getOrCreateAgentRunSessionCalls[0]?.metadata).toMatchObject({
      agentRuntimeId: "codex",
    });
    expect(getOrCreateAgentRunSessionCalls[0]?.task).toBe("用户的第一句话");
    expect(handle.sessionId).toBe("session-1");
    manager.dispose();
  });
});

describe("AgentRunRequestManager peer session identity", () => {
  it("passes peerId to the session owner instead of materializing sessionId at ingress", async () => {
    const ingress = new Ingress();
    const getOrCreateAgentRunSessionCalls: Array<{
      peerId?: string;
      sessionId?: string;
    }> = [];
    const manager = new AgentRunRequestManager(
      {
        getOrCreate: () => ({
          run: async function* (): AsyncGenerator<NcpEndpointEvent> {},
        }),
      } as never,
      {
        getDefaultModel: () => "test-model",
        getModelMaxTokens: () => 12000,
        loadConfig: () => ({}),
      } as never,
      { buildContext: async () => [] } as never,
      new EventBus(),
      ingress,
      {
        getOrCreateAgentRunSession: async (params: {
          peerId?: string;
          sessionId?: string;
        }) => {
          getOrCreateAgentRunSessionCalls.push(params);
          return {
            sessionId: "agent-peer-stable",
            agentId: "main",
            agentRuntimeId: "native",
            metadata: {},
            model: "test-model",
            thinkingEffort: null,
          };
        },
      } as never,
      {
        getSessionRun: () => null,
        createSessionRun: async () => ({
          inbox: { enqueue: () => undefined },
          beginRun: () => ({ runId: "run-1", signal: new AbortController().signal }),
        }),
      } as never,
      { buildTools: async () => [] } as never,
    );
    manager.start();

    const handle = await ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        content: [{ type: "text", text: "保持这个会话" }],
        peerId: "mood-summary",
      },
    }, { source: "test" });

    expect(getOrCreateAgentRunSessionCalls[0]).toMatchObject({
      peerId: "mood-summary",
      sessionId: undefined,
    });
    expect(handle.sessionId).toBe("agent-peer-stable");
    manager.dispose();
  });

  it("rejects ambiguous agent-run send identity", async () => {
    const ingress = new Ingress();
    const manager = new AgentRunRequestManager(
      {
        getOrCreate: () => ({
          run: async function* (): AsyncGenerator<NcpEndpointEvent> {},
        }),
      } as never,
      {
        getDefaultModel: () => "test-model",
        getModelMaxTokens: () => 12000,
        loadConfig: () => ({}),
      } as never,
      { buildContext: async () => [] } as never,
      new EventBus(),
      ingress,
      {
        getOrCreateAgentRunSession: async () => {
          throw new Error("should not reach session owner");
        },
      } as never,
      { getSessionRun: () => null } as never,
      { buildTools: async () => [] } as never,
    );
    manager.start();

    await expect(ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        content: [{ type: "text", text: "ambiguous" }],
        peerId: "mood-summary",
        sessionId: "session-1",
      },
    }, { source: "test" })).rejects.toThrow("cannot accept both sessionId and peerId");
    manager.dispose();
  });
});

describe("AgentRunRequestManager event publication", () => {
  it("publishes the final assistant message before run finished for session previews", async () => {
    const ingress = new Ingress();
    const eventBus = new EventBus();
    const sessionRun = new SessionRun({ sessionId: "session-1", messages: [] });
    const publishedEvents: NcpEndpointEvent[] = [];
    eventBus.on(eventKeys.ncpEvent, (event) => {
      publishedEvents.push(event);
    });
    const assistantMessageId = "assistant-message-1";
    const runEvents: NcpEndpointEvent[] = [
      {
        type: NcpEventType.RunStarted,
        payload: { sessionId: "session-1", messageId: assistantMessageId, runId: "run-1" },
      },
      {
        type: NcpEventType.MessageTextStart,
        payload: { sessionId: "session-1", messageId: assistantMessageId },
      },
      {
        type: NcpEventType.MessageTextDelta,
        payload: { sessionId: "session-1", messageId: assistantMessageId, delta: "最终回复" },
      },
      {
        type: NcpEventType.MessageTextEnd,
        payload: { sessionId: "session-1", messageId: assistantMessageId },
      },
      {
        type: NcpEventType.RunFinished,
        payload: { sessionId: "session-1", messageId: assistantMessageId, runId: "run-1" },
      },
    ];
    const manager = new AgentRunRequestManager(
      {
        getOrCreate: () => ({
          run: async function* (_spec: unknown, options: { sessionRun: SessionRun }): AsyncGenerator<NcpEndpointEvent> {
            for (const event of runEvents) {
              await options.sessionRun.applyEvents([event]);
              yield event;
            }
          },
        }),
      } as never,
      {
        getDefaultModel: () => "test-model",
        getModelMaxTokens: () => 12000,
        loadConfig: () => ({}),
      } as never,
      { buildContext: async () => [] } as never,
      eventBus,
      ingress,
      {
        getOrCreateAgentRunSession: async () => ({
          sessionId: "session-1",
          agentId: "main",
          agentRuntimeId: "native",
          metadata: {},
          model: "test-model",
          thinkingEffort: null,
        }),
      } as never,
      {
        getSessionRun: () => null,
        createSessionRun: async () => sessionRun,
      } as never,
      { buildTools: async () => [] } as never,
    );
    manager.start();

    await ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        content: [{ type: "text", text: "开始" }],
      },
    }, { source: "test" });
    await waitForEvent(publishedEvents, NcpEventType.RunFinished);

    const completedIndex = publishedEvents.findIndex((event) => event.type === NcpEventType.MessageCompleted);
    const finishedIndex = publishedEvents.findIndex((event) => event.type === NcpEventType.RunFinished);
    const completedEvent = publishedEvents[completedIndex];
    expect(completedIndex).toBeGreaterThanOrEqual(0);
    expect(completedIndex).toBeLessThan(finishedIndex);
    expect(completedEvent?.type).toBe(NcpEventType.MessageCompleted);
    expect(completedEvent?.payload.message).toMatchObject({
      id: assistantMessageId,
      role: "assistant",
      status: "final",
      parts: [{ type: "text", text: "最终回复" }],
    });
    manager.dispose();
  });
});

describe("AgentRunRequestManager tool context", () => {
  it("lets the runtime publish asynchronous tool result updates from the tool call context", async () => {
    const ingress = new Ingress();
    const eventBus = new EventBus();
    const sessionRun = new SessionRun({ sessionId: "session-1", messages: [] }, eventBus);
    const publishedEvents: NcpEndpointEvent[] = [];
    eventBus.on(eventKeys.ncpEvent, (event) => {
      publishedEvents.push(event);
    });
    const tool: NcpTool = {
      name: "async_tool",
      parameters: { type: "object" },
      execute: async (_args, context) => {
        await context?.updateToolCallResult?.({ done: true });
        return { started: true };
      },
    };
    const manager = new AgentRunRequestManager(
      {
        getOrCreate: () => ({
          run: async function* (_spec: unknown, options: {
            sessionRun: SessionRun;
            tools: readonly NcpTool[];
            updateToolCallResult?: unknown;
          }): AsyncGenerator<NcpEndpointEvent> {
            expect("updateToolCallResult" in options).toBe(false);
            await options.tools[0]?.execute({}, {
              toolCallId: "tool-call-1",
              updateToolCallResult: async (content) => {
                await options.sessionRun.applyAndPublishEvents([{
                  type: NcpEventType.MessageToolCallResult,
                  payload: {
                    sessionId: "session-1",
                    toolCallId: "tool-call-1",
                    content,
                  },
                }], { source: "test-runtime" });
              },
            });
            yield {
              type: NcpEventType.RunStarted,
              payload: { sessionId: "session-1", messageId: "assistant-message-1", runId: "run-1" },
            };
          },
        }),
      } as never,
      {
        getDefaultModel: () => "test-model",
        getModelMaxTokens: () => 12000,
        loadConfig: () => ({}),
      } as never,
      { buildContext: async () => [] } as never,
      eventBus,
      ingress,
      {
        getOrCreateAgentRunSession: async () => ({
          sessionId: "session-1",
          agentId: "main",
          agentRuntimeId: "native",
          metadata: {},
          model: "test-model",
          thinkingEffort: null,
        }),
      } as never,
      {
        getSessionRun: () => null,
        createSessionRun: async () => sessionRun,
      } as never,
      { buildTools: async () => [tool] } as never,
    );
    manager.start();

    await ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        content: [{ type: "text", text: "开始" }],
      },
    }, { source: "test" });
    await waitForEvent(publishedEvents, NcpEventType.MessageToolCallResult);

    expect(publishedEvents).toContainEqual({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-call-1",
        content: { done: true },
      },
    });
    manager.dispose();
  });
});
