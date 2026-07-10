import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => {
  vi.useRealTimers();
});

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

function textChunk(text: string): OpenAIChatChunk {
  return {
    choices: [
      {
        delta: { content: text },
        finish_reason: null,
        index: 0,
      },
    ],
    id: `chunk-text-${text}`,
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
  it("emits event and run lifecycle timestamps without persisting duration", async () => {
    const runtime = new DefaultNcpAgentRuntime({
      llmApi: createLlmApi(thinkTagChunks),
      modelInputBuilder,
    });

    const events = await collectRuntimeEvents(runtime);
    const runStarted = events.find((event) => event.type === NcpEventType.RunStarted);
    const runFinished = events.find((event) => event.type === NcpEventType.RunFinished);

    expect(events.every((event) => Number.isFinite(Date.parse(event.occurredAt ?? "")))).toBe(true);
    expect(runStarted).toMatchObject({
      occurredAt: expect.any(String),
      payload: {
        startedAt: expect.any(String),
      },
      type: NcpEventType.RunStarted,
    });
    expect(runFinished).toMatchObject({
      occurredAt: expect.any(String),
      payload: {
        startedAt: expect.any(String),
        endedAt: expect.any(String),
      },
      type: NcpEventType.RunFinished,
    });
    expect(runFinished?.payload).not.toHaveProperty("durationMs");
  });

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

describe("DefaultNcpAgentRuntime stream recovery", () => {
  it("publishes retry metadata and retries transient stream failures", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const firstAttemptFailed = deferred();
    let attempts = 0;
    const llmApi: NcpLLMApi = {
      generate: async function* () {
        attempts += 1;
        if (attempts === 1) {
          yield textChunk("partial");
          firstAttemptFailed.resolve();
          throw new Error("Network stream closed before response.completed");
        }
        yield textChunk("recovered");
        yield finishChunk("stop");
      },
    };
    const runtime = new DefaultNcpAgentRuntime({ llmApi, modelInputBuilder });

    const { sessionRun } = createSessionRun();
    const events: NcpEndpointEvent[] = [];
    const retryMetadataSeen = deferred();
    const collectEvents = (async () => {
      for await (const event of runtime.run(spec, {
        contextBlocks: [],
        sessionRun,
        tools: [],
      })) {
        events.push(event);
        if (
          event.type === NcpEventType.RunMetadata &&
          event.payload.metadata &&
          typeof event.payload.metadata === "object" &&
          "type" in event.payload.metadata &&
          event.payload.metadata.type === "retry"
        ) {
          retryMetadataSeen.resolve();
        }
      }
    })();
    await firstAttemptFailed.promise;
    await retryMetadataSeen.promise;
    await vi.advanceTimersByTimeAsync(2_000);
    await collectEvents;

    expect(attempts).toBe(2);
    expect(events.map((event) => event.type)).toContain(NcpEventType.RunFinished);
    expect(events.map((event) => event.type)).toContain(NcpEventType.RunMetadata);
    expect(events.map((event) => event.type)).not.toContain(NcpEventType.MessageRecalled);
    expect(events.map((event) => event.type)).not.toContain(NcpEventType.RunError);
    expect(events).toContainEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          metadata: expect.objectContaining({
            attempt: 1,
            next: 2_000,
            type: "retry",
          }),
        }),
        type: NcpEventType.RunMetadata,
      }),
    );
    expect(
      events.filter((event) => event.type === NcpEventType.MessageTextDelta).map((event) => event.payload.delta),
    ).toEqual(["partial", "recovered"]);
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

describe("DefaultNcpAgentRuntime aborting tool calls", () => {
  it("emits abort promptly while a tool call is still running", async () => {
    const toolStarted = deferred<string | undefined>();
    const controller = new AbortController();
    let toolAbortSignal: AbortSignal | undefined;
    let generateRound = 0;
    const llmApi: NcpLLMApi = {
      generate: async function* () {
        generateRound += 1;
        if (generateRound === 1) {
          yield toolCallChunk(0, "call-slow", "slow_command", "{}");
          yield finishChunk("tool_calls");
          return;
        }

        yield finishChunk("stop");
      },
    };
    const tool: NcpTool = {
      execute: async (_args, context) => {
        toolAbortSignal = context?.abortSignal;
        toolStarted.resolve(context?.toolCallId);
        return new Promise<never>(() => {});
      },
      name: "slow_command",
    };
    const runtime = new DefaultNcpAgentRuntime({ llmApi, modelInputBuilder });
    const { sessionRun } = createSessionRun();
    const collectEvents = (async () => {
      const events: NcpEndpointEvent[] = [];
      for await (const event of runtime.run(spec, {
        contextBlocks: [],
        sessionRun,
        signal: controller.signal,
        tools: [tool],
      })) {
        events.push(event);
      }
      return events;
    })();

    await Promise.race([
      toolStarted.promise,
      rejectAfter(1_000, "timed out waiting for slow tool call to start"),
    ]);

    controller.abort();
    const events = await Promise.race([
      collectEvents,
      rejectAfter<NcpEndpointEvent[]>(500, "timed out waiting for runtime abort"),
    ]);

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          payload: expect.objectContaining({
            reason: expect.objectContaining({
              code: "abort-error",
              message: "The run was cancelled before a complete response was produced.",
            }),
            runId: spec.runId,
            sessionId: "session-1",
          }),
          type: NcpEventType.MessageAbort,
        }),
      ]),
    );
    expect(events.some((event) => event.type === NcpEventType.RunFinished)).toBe(false);
    expect(toolAbortSignal).toBe(controller.signal);
  });
});
