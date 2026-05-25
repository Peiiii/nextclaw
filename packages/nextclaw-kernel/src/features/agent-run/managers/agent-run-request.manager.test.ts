import { describe, expect, it } from "vitest";
import {
  EventBus,
  eventKeys,
  Ingress,
  ingressKeys,
  type AgentRunSendIngressPayload,
} from "@nextclaw/shared";
import { NcpEventType, type NcpEndpointEvent, type NcpRunHandle } from "@nextclaw/ncp";
import { AgentRunRequestManager } from "./agent-run-request.manager.js";
import { SessionRun } from "./session-run.manager.js";

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
    const getOrCreateSessionCalls: Array<{
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
        getOrCreateSession: async (params: {
          agentRuntimeId?: string;
          metadata?: Record<string, unknown>;
          sessionId?: string;
          task?: string;
        }) => {
          getOrCreateSessionCalls.push(params);
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

    expect(getOrCreateSessionCalls[0]?.agentRuntimeId).toBe("codex");
    expect(getOrCreateSessionCalls[0]?.metadata).toMatchObject({
      agentRuntimeId: "codex",
    });
    expect(getOrCreateSessionCalls[0]?.task).toBe("用户的第一句话");
    expect(handle.sessionId).toBe("session-1");
    manager.dispose();
  });

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
        getOrCreateSession: async () => ({
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
