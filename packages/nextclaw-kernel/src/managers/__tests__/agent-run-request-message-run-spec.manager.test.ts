import { describe, expect, it } from "vitest";
import {
  EventBus,
  Ingress,
  eventKeys,
  ingressKeys,
  type AgentRunSendIngressPayload,
} from "@nextclaw/shared";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import { AgentRunRequestManager } from "@kernel/managers/agent-run-request.manager.js";
import { SessionRun } from "@kernel/managers/session-run.manager.js";
import type { AgentRunSpec } from "@kernel/types/agent-run.types.js";
import { AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY } from "@kernel/utils/agent-run-metadata.utils.js";
import { extractMessageMetadata } from "@kernel/utils/ncp-message-bridge.utils.js";

async function waitForCondition(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("AgentRunRequestManager message run spec metadata", () => {
  it("records the resolved run spec on the queued user message", async () => {
    const ingress = new Ingress();
    const queuedMessages: NcpMessage[] = [];
    const completedMessages: NcpMessage[] = [];
    const runtimeSpecs: AgentRunSpec[] = [];
    const surfaceAgentIds: Array<string | undefined> = [];
    const sessionRun = new SessionRun({ sessionId: "session-1", messages: [] });
    const eventBus = new EventBus();
    eventBus.on(eventKeys.ncpEvent, (event) => {
      if (event.type === NcpEventType.MessageCompleted) {
        completedMessages.push(structuredClone(event.payload.message));
      }
    });
    const manager = new AgentRunRequestManager(
      {
        getOrCreate: () => ({
          run: async function* (spec: AgentRunSpec, options): AsyncGenerator<NcpEndpointEvent> {
            queuedMessages.push(...options.initialMessages.map((message: NcpMessage) => structuredClone(message)));
            runtimeSpecs.push(structuredClone(spec));
            const runStarted = {
              type: NcpEventType.RunStarted,
              payload: {
                sessionId: "session-1",
                messageId: "assistant-message-1",
                runId: spec.runId,
              },
            } as const;
            await options.sessionRun.applyEvents([runStarted]);
            yield runStarted;
            const assistantMessage: NcpMessage = {
              id: "assistant-message-1",
              sessionId: "session-1",
              role: "assistant",
              status: "final",
              timestamp: "2026-08-25T00:01:00.000Z",
              parts: [{ type: "text", text: "done" }],
            };
            const completedEvent = {
              type: NcpEventType.MessageCompleted,
              payload: {
                sessionId: "session-1",
                message: assistantMessage,
              },
            } as const;
            await options.sessionRun.applyEvents([completedEvent]);
            yield completedEvent;
          },
        }),
      } as never,
      {
        getDefaultAgentId: () => "main",
        resolveAgentProfileForRun: () => ({ maxToolIterations: 37 }),
      } as never,
      {
        getDefaultModel: () => "custom-3/mimo-v2.5-pro",
        getModelMaxTokens: () => 8192,
        loadConfig: () => ({}),
      } as never,
      {
        resolveRunSurface: async (request: { agentId?: string }) => {
          surfaceAgentIds.push(request.agentId);
          return { contextBlocks: [], tools: [] };
        },
      } as never,
      eventBus,
      ingress,
      {
        getOrCreateAgentRunSession: async () => ({
          sessionId: "session-1",
          agentId: "researcher",
          agentRuntimeId: "native",
          metadata: {},
          model: undefined,
          projectRoot: "/session/project",
          workingDir: "/session/workdir",
          thinkingEffort: null,
        }),
      } as never,
      {
        getSessionRun: () => null,
        getOrCreateSessionRun: async () => sessionRun,
      } as never,
    );
    manager.start();

    const handle = await ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        content: [{ type: "text", text: "翻译这一段" }],
        correlationId: "corr-1",
        metadata: {
          agentId: "main",
          agent_id: "main",
          kind: "novel-reader-translation",
        },
      },
    }, { source: "test" });
    await waitForCondition(() => runtimeSpecs.length > 0);
    await waitForCondition(() => completedMessages.length > 0);

    const queuedMessage = queuedMessages[0];
    const runSpec = queuedMessage?.metadata?.[
      AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY
    ];
    expect(handle).toMatchObject({
      sessionId: "session-1",
      userMessageId: queuedMessage?.id,
      runId: runtimeSpecs[0]?.runId,
      correlationId: "corr-1",
    });
    expect(Date.parse((runSpec as { startedAt?: string }).startedAt ?? "")).not.toBeNaN();
    expect(runSpec).toMatchObject({
      version: 1,
      runId: runtimeSpecs[0]?.runId,
      sessionId: "session-1",
      agentRuntimeId: "native",
      agentId: "researcher",
      model: "custom-3/mimo-v2.5-pro",
      modelSource: "default",
      requestedModel: null,
      maxToolIterations: 37,
      maxTokens: 8192,
      thinkingEffort: null,
      projectRoot: "/session/project",
      workingDir: "/session/workdir",
      correlationId: "corr-1",
      execution: {
        contractVersion: 1,
        modelProtocol: "ncp-agent-run",
        terminalContracts: [
          "chat.finish_reason",
          "responses.response.completed",
          "ncp.run.finished-or-error-or-abort",
        ],
        retryPolicy: {
          requestMaxAttempts: 3,
          streamMaxAttemptsBeforeVisibleOutput: 3,
          scope: "transport-or-missing-terminal-before-visible-output",
          runtimeStreamRetry: {
            attemptLimit: null,
            backoffFactor: 2,
            initialDelayMs: 2000,
            maxDelayMsWithoutHeaders: 30000,
            partialAttemptDisposition: "retain-visible-parts",
            scope: "retryable-model-stream-failure",
            statusFields: ["attempt", "message", "action", "next"],
            statusMetadataType: "retry",
          },
        },
      },
    });
    expect(queuedMessage?.metadata?.run_trigger).toMatchObject({
      version: 1,
      actor: "human",
      source: "test",
      sourceMessageId: queuedMessage?.id,
      targetRunId: runtimeSpecs[0]?.runId,
    });
    expect(completedMessages[0]?.metadata?.run_trigger).toEqual(
      queuedMessage?.metadata?.run_trigger,
    );
    expect(runtimeSpecs[0]).toMatchObject({
      runId: runtimeSpecs[0]?.runId,
      runtimeId: "native",
      agentId: "researcher",
      model: "custom-3/mimo-v2.5-pro",
      requestedModel: null,
      maxTokens: 8192,
      thinkingEffort: null,
      correlationId: "corr-1",
    });
    expect(surfaceAgentIds).toEqual(["researcher"]);
    manager.dispose();
  });

  it("keeps run spec metadata out of recovered session metadata", () => {
    const message: NcpMessage = {
      id: "user-1",
      sessionId: "session-1",
      role: "user",
      status: "final",
      timestamp: "2026-07-05T00:00:00.000Z",
      parts: [{ type: "text", text: "开始" }],
      metadata: {
        preferred_model: "openai/gpt-5",
        [AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY]: {
          version: 1,
          runId: "run-1",
          model: "openai/gpt-5",
        },
      },
    };

    expect(extractMessageMetadata([message])).toEqual({
      preferred_model: "openai/gpt-5",
    });
    expect(extractMessageMetadata([{
      ...message,
      metadata: {
        [AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY]: {
          version: 1,
          runId: "run-2",
          model: "openai/gpt-5",
        },
      },
    }])).toBeUndefined();
  });
});
