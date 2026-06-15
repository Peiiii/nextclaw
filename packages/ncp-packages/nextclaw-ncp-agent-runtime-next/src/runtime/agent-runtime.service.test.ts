import { describe, expect, it } from "vitest";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpLLMApi,
  type OpenAIChatChunk,
} from "@nextclaw/ncp";
import { DefaultNcpAgentRuntime } from "./agent-runtime.service.js";
import type {
  AgentModelInputBuilder,
  DefaultNcpAgentRunSpec,
} from "./types/agent-model-input.types.js";

const thinkTagChunks: OpenAIChatChunk[] = [
  {
    choices: [
      {
        delta: { content: "<think>plan first</think>\n\nvisible answer" },
        finish_reason: "stop",
        index: 0,
      },
    ],
    id: "chunk-1",
  },
];

const spec: DefaultNcpAgentRunSpec = {
  agentId: "main",
  model: "model",
  runId: "run-1",
};

const modelInputBuilder: AgentModelInputBuilder = {
  build: async () => ({ messages: [], model: "model" }),
};

function createLlmApi(chunks: OpenAIChatChunk[]): NcpLLMApi {
  return {
    generate: async function* () {
      yield* chunks;
    },
  };
}

function createSessionRun() {
  return {
    sessionRun: {
      applyEvents: async () => {},
      getSnapshot: () => ({ messages: [] }),
      inbox: {
        drain: () => [],
      },
      sessionId: "session-1",
    },
  };
}

async function collectRuntimeEvents(runtime: DefaultNcpAgentRuntime): Promise<NcpEndpointEvent[]> {
  const { sessionRun } = createSessionRun();
  const events: NcpEndpointEvent[] = [];
  for await (const event of runtime.run(spec, {
    contextBlocks: [],
    sessionRun,
    tools: [],
  })) {
    events.push(event);
  }
  return events;
}

describe("DefaultNcpAgentRuntime reasoning normalization", () => {
  it("normalizes think tags into reasoning when no mode is provided", async () => {
    const runtime = new DefaultNcpAgentRuntime({
      llmApi: createLlmApi(thinkTagChunks),
      modelInputBuilder,
    });

    const events = await collectRuntimeEvents(runtime);

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({ delta: "plan first" }),
          type: NcpEventType.MessageReasoningDelta,
        }),
        expect.objectContaining({
          payload: expect.objectContaining({ delta: "visible answer" }),
          type: NcpEventType.MessageTextDelta,
        }),
      ]),
    );
    expect(
      events.some(
        (event) =>
          event.type === NcpEventType.MessageTextDelta &&
          "delta" in event.payload &&
          String(event.payload.delta).includes("<think>"),
      ),
    ).toBe(false);
  });

  it("preserves raw text when the mode is explicitly off", async () => {
    const runtime = new DefaultNcpAgentRuntime({
      llmApi: createLlmApi(thinkTagChunks),
      modelInputBuilder,
      reasoningNormalizationMode: "off",
    });

    const events = await collectRuntimeEvents(runtime);

    expect(events).toContainEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          delta: "<think>plan first</think>\n\nvisible answer",
        }),
        type: NcpEventType.MessageTextDelta,
      }),
    );
    expect(events.some((event) => event.type === NcpEventType.MessageReasoningDelta)).toBe(false);
  });
});
