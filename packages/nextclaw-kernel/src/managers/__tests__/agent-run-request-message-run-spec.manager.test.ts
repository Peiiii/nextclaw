import { describe, expect, it } from "vitest";
import {
  EventBus,
  Ingress,
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
    const runtimeSpecs: AgentRunSpec[] = [];
    const manager = new AgentRunRequestManager(
      {
        getOrCreate: () => ({
          run: async function* (spec: AgentRunSpec): AsyncGenerator<NcpEndpointEvent> {
            runtimeSpecs.push(structuredClone(spec));
            yield {
              type: NcpEventType.RunStarted,
              payload: {
                sessionId: "session-1",
                messageId: "assistant-message-1",
                runId: spec.runId,
              },
            };
          },
        }),
      } as never,
      { getDefaultAgentId: () => "main" } as never,
      {
        getDefaultModel: () => "custom-3/mimo-v2.5-pro",
        getModelMaxTokens: () => 8192,
        loadConfig: () => ({}),
      } as never,
      { buildContext: async () => [] } as never,
      new EventBus(),
      ingress,
      {
        getOrCreateAgentRunSession: async () => ({
          sessionId: "session-1",
          agentId: undefined,
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
        createSessionRun: async () => ({
          sessionId: "session-1",
          inbox: {
            enqueue: (message: NcpMessage) => {
              queuedMessages.push(structuredClone(message));
            },
          },
          beginRun: () => ({ runId: "run-1", signal: new AbortController().signal }),
          onStatusChange: () => () => undefined,
        }),
      } as never,
      { buildTools: async () => [] } as never,
    );
    manager.start();

    const handle = await ingress.handle<AgentRunSendIngressPayload, NcpRunHandle>({
      type: ingressKeys.agentRun.send,
      payload: {
        content: [{ type: "text", text: "翻译这一段" }],
        correlationId: "corr-1",
        metadata: {
          kind: "novel-reader-translation",
        },
      },
    }, { source: "test" });
    await waitForCondition(() => runtimeSpecs.length > 0);

    const queuedMessage = queuedMessages[0];
    const runSpec = queuedMessage?.metadata?.[
      AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY
    ];
    expect(handle).toMatchObject({
      sessionId: "session-1",
      userMessageId: queuedMessage?.id,
      runId: "run-1",
      correlationId: "corr-1",
    });
    expect(Date.parse((runSpec as { startedAt?: string }).startedAt ?? "")).not.toBeNaN();
    expect(runSpec).toMatchObject({
      version: 1,
      runId: "run-1",
      sessionId: "session-1",
      agentRuntimeId: "native",
      agentId: "main",
      model: "custom-3/mimo-v2.5-pro",
      modelSource: "default",
      requestedModel: null,
      maxTokens: 8192,
      thinkingEffort: null,
      projectRoot: "/session/project",
      workingDir: "/session/workdir",
      correlationId: "corr-1",
    });
    expect(runtimeSpecs[0]).toMatchObject({
      runId: "run-1",
      agentId: "main",
      model: "custom-3/mimo-v2.5-pro",
      maxTokens: 8192,
      thinkingEffort: null,
      correlationId: "corr-1",
    });
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
