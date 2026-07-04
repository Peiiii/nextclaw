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

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function rejectAfter<T>(ms: number, message: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toolCallChunk(
  index: number,
  toolCallId: string,
  toolName: string,
  args: string,
): OpenAIChatChunk {
  return {
    choices: [
      {
        delta: {
          tool_calls: [
            {
              function: {
                arguments: args,
                name: toolName,
              },
              id: toolCallId,
              index,
            },
          ],
        },
        finish_reason: null,
        index: 0,
      },
    ],
    id: `chunk-${toolCallId}`,
  };
}

function finishChunk(finishReason: "stop" | "tool_calls"): OpenAIChatChunk {
  return {
    choices: [
      {
        delta: {},
        finish_reason: finishReason,
        index: 0,
      },
    ],
    id: `chunk-finish-${finishReason}`,
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

describe("DefaultNcpAgentRuntime tool call scheduling", () => {
  it("emits partial tool call args before the model round finishes", async () => {
    const partialArgsSeen = deferred();
    const releaseModelFinish = deferred();
    let generateRound = 0;
    const llmApi: NcpLLMApi = {
      generate: async function* () {
        generateRound += 1;
        if (generateRound === 1) {
          yield toolCallChunk(
            0,
            "call-1",
            "write_file",
            "{\"path\":\"a.txt\",\"content\":\"hello",
          );
          await releaseModelFinish.promise;
          yield toolCallChunk(0, "call-1", "write_file", " world\"}");
          yield finishChunk("tool_calls");
          return;
        }

        yield finishChunk("stop");
      },
    };
    const tool: NcpTool = {
      execute: async (_args, context) => ({ ok: true, toolCallId: context?.toolCallId }),
      name: "write_file",
    };
    const runtime = new DefaultNcpAgentRuntime({ llmApi, modelInputBuilder });
    const { sessionRun } = createSessionRun();
    const events: NcpEndpointEvent[] = [];
    const collectEvents = (async () => {
      for await (const event of runtime.run(spec, {
        contextBlocks: [],
        sessionRun,
        tools: [tool],
      })) {
        events.push(event);
        if (
          event.type === NcpEventType.MessageToolCallArgsDelta &&
          event.payload.toolCallId === "call-1" &&
          event.payload.delta.includes("hello")
        ) {
          partialArgsSeen.resolve();
        }
      }
      return events;
    })();

    await Promise.race([
      partialArgsSeen.promise,
      rejectAfter(1_000, "timed out waiting for partial tool args delta"),
    ]);
    expect(
      events.some(
        (event) =>
          event.type === NcpEventType.MessageToolCallResult &&
          event.payload.toolCallId === "call-1",
      ),
    ).toBe(false);

    releaseModelFinish.resolve();
    await Promise.race([
      collectEvents,
      rejectAfter(1_000, "timed out waiting for runtime completion"),
    ]);
  });

  it("executes ready tool calls serially in stream order", async () => {
    const call1Started = deferred();
    const releaseCall1 = deferred();
    const markers: string[] = [];
    let generateRound = 0;
    const llmApi: NcpLLMApi = {
      generate: async function* () {
        generateRound += 1;
        if (generateRound === 1) {
          yield toolCallChunk(0, "call-1", "lookup", "{\"value\":1}");
          yield toolCallChunk(1, "call-2", "lookup", "{\"value\":2}");
          yield finishChunk("tool_calls");
          return;
        }

        yield finishChunk("stop");
      },
    };
    const tool: NcpTool = {
      execute: async (_args, context) => {
        const toolCallId = context?.toolCallId ?? "missing-tool-call-id";
        markers.push(`start:${toolCallId}`);
        if (toolCallId === "call-1") {
          call1Started.resolve();
          await releaseCall1.promise;
        }
        markers.push(`finish:${toolCallId}`);
        return { ok: true, toolCallId };
      },
      name: "lookup",
    };
    const runtime = new DefaultNcpAgentRuntime({ llmApi, modelInputBuilder });
    const { sessionRun } = createSessionRun();
    const events: NcpEndpointEvent[] = [];
    const collectEvents = (async () => {
      for await (const event of runtime.run(spec, {
        contextBlocks: [],
        sessionRun,
        tools: [tool],
      })) {
        events.push(event);
      }
      return events;
    })();

    await Promise.race([
      call1Started.promise,
      rejectAfter(1_000, "timed out waiting for the first tool call to start"),
    ]);
    await waitFor(20);
    expect(markers).toEqual(["start:call-1"]);

    releaseCall1.resolve();
    await Promise.race([
      collectEvents,
      rejectAfter(1_000, "timed out waiting for runtime completion"),
    ]);

    expect(markers).toEqual(["start:call-1", "finish:call-1", "start:call-2", "finish:call-2"]);

    const call1ResultIndex = events.findIndex(
      (event) =>
        event.type === NcpEventType.MessageToolCallResult &&
        event.payload.toolCallId === "call-1",
    );
    const call2ResultIndex = events.findIndex(
      (event) =>
        event.type === NcpEventType.MessageToolCallResult &&
        event.payload.toolCallId === "call-2",
    );
    expect(call1ResultIndex).toBeGreaterThan(-1);
    expect(call2ResultIndex).toBeGreaterThan(-1);
    expect(call1ResultIndex).toBeLessThan(call2ResultIndex);
  });

  it("emits the first ready tool result before a later streamed tool call closes", async () => {
    const firstResultSeen = deferred();
    const markers: string[] = [];
    let generateRound = 0;
    const llmApi: NcpLLMApi = {
      generate: async function* () {
        generateRound += 1;
        if (generateRound === 1) {
          yield toolCallChunk(0, "call-1", "lookup", "{\"value\":1}");
          yield toolCallChunk(1, "call-2", "lookup", "{\"value\":2}");
          await firstResultSeen.promise;
          markers.push("model-finish-released");
          yield finishChunk("tool_calls");
          return;
        }

        yield finishChunk("stop");
      },
    };
    const tool: NcpTool = {
      execute: async (_args, context) => {
        const toolCallId = context?.toolCallId ?? "missing-tool-call-id";
        markers.push(`execute:${toolCallId}`);
        return { ok: true, toolCallId };
      },
      name: "lookup",
    };
    const runtime = new DefaultNcpAgentRuntime({ llmApi, modelInputBuilder });
    const { sessionRun } = createSessionRun();
    const events: NcpEndpointEvent[] = [];
    const collectEvents = (async () => {
      for await (const event of runtime.run(spec, {
        contextBlocks: [],
        sessionRun,
        tools: [tool],
      })) {
        events.push(event);
        if (
          event.type === NcpEventType.MessageToolCallResult &&
          event.payload.toolCallId === "call-1"
        ) {
          firstResultSeen.resolve();
        }
      }
      return events;
    })();

    await Promise.race([
      collectEvents,
      rejectAfter(1_000, "timed out waiting for first tool result before model finish"),
    ]);

    const call1ResultIndex = events.findIndex(
      (event) =>
        event.type === NcpEventType.MessageToolCallResult &&
        event.payload.toolCallId === "call-1",
    );
    const call2EndIndex = events.findIndex(
      (event) =>
        event.type === NcpEventType.MessageToolCallEnd &&
        event.payload.toolCallId === "call-2",
    );
    expect(call1ResultIndex).toBeGreaterThan(-1);
    expect(call2EndIndex).toBeGreaterThan(-1);
    expect(call1ResultIndex).toBeLessThan(call2EndIndex);
    expect(markers.indexOf("execute:call-1")).toBeLessThan(
      markers.indexOf("model-finish-released"),
    );
  });
});
