import { describe, expect, it } from "vitest";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpLLMApi,
  type NcpTool,
  type OpenAIChatChunk,
} from "@nextclaw/ncp";
import { DefaultNcpAgentRuntime } from "./agent-runtime.service.js";
import type {
  AgentModelInputBuilder,
  DefaultNcpAgentRunSpec,
} from "./types/agent-model-input.types.js";

const spec: DefaultNcpAgentRunSpec = {
  agentId: "main",
  model: "model",
  requestedModel: null,
  runId: "run-timing",
  runtimeId: "native",
};

function toolRoundChunk(): OpenAIChatChunk {
  return {
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            {
              index: 0,
              id: "call-timing",
              function: { name: "exec", arguments: '{"command":"pwd"}' },
            },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
  };
}

describe("DefaultNcpAgentRuntime tool execution timing", () => {
  it("publishes the real boundary, progress, and terminal timing in order", async () => {
    let round = 0;
    const llmApi: NcpLLMApi = {
      generate: async function* () {
        round += 1;
        yield round === 1
          ? toolRoundChunk()
          : { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] };
      },
    };
    const modelInputBuilder: AgentModelInputBuilder = {
      build: async () => ({ messages: [], model: "model" }),
    };
    const tool: NcpTool = {
      name: "exec",
      execute: async (_args, context) => {
        context?.reportExecutionStarted?.();
        await context?.updateToolCallResult?.({ status: "in_progress" });
        return { ok: true, stdout: "/workspace" };
      },
    };
    const sessionRun = {
      applyEvents: async () => {},
      getSnapshot: () => ({ messages: [] }),
      inbox: { drain: () => [] },
      sessionId: "session-timing",
    };
    const runtime = new DefaultNcpAgentRuntime({ llmApi, modelInputBuilder });
    const events: NcpEndpointEvent[] = [];
    for await (const event of runtime.run(spec, {
      contextBlocks: [],
      sessionRun,
      tools: [tool],
    })) {
      events.push(event);
    }

    const startedIndex = events.findIndex(
      (event) => event.type === NcpEventType.MessageToolExecutionStarted,
    );
    const progressIndex = events.findIndex(
      (event) =>
        event.type === NcpEventType.MessageToolCallResult &&
        event.payload.final === false,
    );
    const finalIndex = events.findIndex(
      (event) =>
        event.type === NcpEventType.MessageToolCallResult &&
        event.payload.final === true,
    );
    expect(startedIndex).toBeGreaterThan(-1);
    expect(startedIndex).toBeLessThan(progressIndex);
    expect(progressIndex).toBeLessThan(finalIndex);
    expect(events[finalIndex]).toMatchObject({
      occurredAt: expect.any(String),
      payload: {
        execution: {
          startedAt: expect.any(String),
          endedAt: expect.any(String),
          durationMs: expect.any(Number),
        },
      },
    });
  });
});
