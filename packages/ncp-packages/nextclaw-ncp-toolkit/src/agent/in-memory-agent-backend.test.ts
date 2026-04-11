import { describe, expect, it } from "vitest";
import {
  type NcpAgentConversationStateManager,
  type NcpAgentRuntime,
  type NcpLLMApi,
  type NcpLLMApiInput,
  type NcpLLMApiOptions,
  type NcpEndpointEvent,
  type NcpRequestEnvelope,
  type NcpTool,
  type NcpToolDefinition,
  type NcpToolRegistry,
  type OpenAIChatChunk,
  NcpEventType,
} from "@nextclaw/ncp";
import {
  DefaultNcpContextBuilder,
  DefaultNcpAgentRuntime,
  DefaultNcpToolRegistry,
  EchoNcpLLMApi,
} from "@nextclaw/ncp-agent-runtime";
import { DefaultNcpAgentBackend, InMemoryAgentSessionStore } from "./index.js";
import type {
  AgentSessionRecord,
  AgentSessionStore,
} from "./agent-backend/agent-backend-types.js";

const now = "2026-03-15T00:00:00.000Z";

const createEnvelope = (text: string): NcpRequestEnvelope => ({
  sessionId: "session-1",
  correlationId: "corr-1",
  message: {
    id: "user-1",
    sessionId: "session-1",
    role: "user",
    status: "final",
    parts: [{ type: "text", text }],
    timestamp: now,
  },
});

function createBackend(
  llmApi: NcpLLMApi,
  options: {
    sessionStore?: AgentSessionStore;
  } = {},
) {
  return new DefaultNcpAgentBackend({
    sessionStore: options.sessionStore ?? new InMemoryAgentSessionStore(),
    createRuntime: ({
      stateManager,
    }: {
      stateManager: NcpAgentConversationStateManager;
    }) => {
      const toolRegistry = new DefaultNcpToolRegistry();
      return new DefaultNcpAgentRuntime({
        contextBuilder: new DefaultNcpContextBuilder(toolRegistry),
        llmApi,
        toolRegistry,
        stateManager,
      });
    },
  });
}

describe("DefaultNcpAgentBackend with in-memory session store", () => {
  it("stores finalized assistant message and exposes session status", async () => {
    const backend = createBackend(new EchoNcpLLMApi());
    const events: string[] = [];
    backend.subscribe((event) => {
      events.push(event.type);
    });

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("hello"),
    });

    expect(events).toContain(NcpEventType.MessageSent);
    expect(events).toContain(NcpEventType.RunFinished);

    const sessions = await backend.listSessions();
    expect(sessions[0]).toMatchObject({
      sessionId: "session-1",
      messageCount: 2,
      status: "idle",
    });

    const messages = await backend.listSessionMessages("session-1");
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      role: "assistant",
      status: "final",
      parts: [{ type: "text", text: "hello" }],
    });
  });

  it("persists runtime-owned session metadata alongside request metadata", async () => {
    const backend = new DefaultNcpAgentBackend({
      sessionStore: new InMemoryAgentSessionStore(),
      createRuntime: ({ sessionId, sessionMetadata, setSessionMetadata }) => {
        setSessionMetadata({
          ...sessionMetadata,
          session_type: "codex",
          codex_thread_id: `thread:${sessionId}`,
        });
        return new EchoNcpLLMApiRuntime();
      },
    });

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: {
        ...createEnvelope("hello"),
        metadata: {
          session_type: "codex",
          preferred_model: "openai/gpt-5.3-codex",
        },
      },
    });

    const session = await backend.getSession("session-1");
    expect(session?.metadata).toMatchObject({
      session_type: "codex",
      preferred_model: "openai/gpt-5.3-codex",
      codex_thread_id: "thread:session-1",
    });
  });

  it("updates persisted session metadata outside the active run path", async () => {
    const sessionStore = new RecordingSessionStore();
    const backend = createBackend(new EchoNcpLLMApi(), { sessionStore });

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("hello"),
    });

    const updated = await backend.updateSession("session-1", {
      metadata: {
        session_type: "native",
        preferred_model: "openai/gpt-5",
        preferred_thinking: "medium",
      },
    });

    expect(updated?.metadata).toMatchObject({
      session_type: "native",
      preferred_model: "openai/gpt-5",
      preferred_thinking: "medium",
    });
    expect(sessionStore.replaceCallCount).toBe(1);
  });

  it("streams live session events for an active session", async () => {
    const backend = createBackend(new SlowEchoNcpLLMApi());
    const requestPromise = backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("slow"),
    });

    await waitFor(
      async () => (await backend.getSession("session-1"))?.status === "running",
    );

    const streamed: string[] = [];
    const controller = new AbortController();
    const streamPromise = (async () => {
      for await (const event of backend.stream({
        payload: { sessionId: "session-1" },
        signal: controller.signal,
      })) {
        streamed.push(event.type);
        if (event.type === NcpEventType.RunFinished) {
          controller.abort();
        }
      }
    })();

    await Promise.all([requestPromise, streamPromise]);

    expect(streamed).toContain(NcpEventType.MessageTextDelta);
    expect(streamed).toContain(NcpEventType.RunFinished);
  });

  it("keeps an idle session stream open for the next run without materializing an empty session", async () => {
    const backend = createBackend(new SlowEchoNcpLLMApi());
    const streamed: string[] = [];
    const controller = new AbortController();
    const streamPromise = (async () => {
      for await (const event of backend.stream({
        payload: { sessionId: "session-1" },
        signal: controller.signal,
      })) {
        streamed.push(event.type);
        if (event.type === NcpEventType.RunFinished) {
          controller.abort();
        }
      }
    })();

    expect(await backend.getSession("session-1")).toBeNull();
    expect(await backend.listSessions()).toEqual([]);

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("hello"),
    });
    await streamPromise;

    expect(streamed).toContain(NcpEventType.MessageSent);
    expect(streamed).toContain(NcpEventType.RunFinished);
  });

  it("publishes message.sent immediately before assistant streaming starts", async () => {
    const backend = createBackend(new SlowEchoNcpLLMApi());
    const events: string[] = [];
    backend.subscribe((event) => {
      events.push(event.type);
    });

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("slow"),
    });

    expect(events).toContain(NcpEventType.MessageSent);
    expect(events.indexOf(NcpEventType.MessageSent)).toBeLessThan(
      events.indexOf(NcpEventType.MessageTextDelta),
    );
  });

  it("aborts a slow run by session id and clears session status", async () => {
    const backend = createBackend(new SlowEchoNcpLLMApi());
    const requestPromise = backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("slow"),
    });

    await waitFor(
      async () => (await backend.getSession("session-1"))?.status === "running",
    );
    await backend.abort({ sessionId: "session-1" });
    await requestPromise;

    const session = await backend.getSession("session-1");
    expect(session?.status).toBe("idle");
  });

  it("does not duplicate live events when attaching a session stream", async () => {
    const llmApi = new GatedEchoNcpLLMApi();
    const backend = createBackend(llmApi);
    const textDeltas: string[] = [];

    backend.subscribe((event) => {
      if (event.type === NcpEventType.MessageTextDelta) {
        textDeltas.push(event.payload.delta);
      }
    });

    const requestPromise = backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("slow"),
    });

    await llmApi.started;
    const controller = new AbortController();
    const streamPromise = (async () => {
      for await (const event of backend.stream({
        payload: { sessionId: "session-1" },
        signal: controller.signal,
      })) {
        if (event.type === NcpEventType.RunFinished) {
          controller.abort();
        }
      }
    })();

    llmApi.release();
    await Promise.all([requestPromise, streamPromise]);

    expect(textDeltas).toEqual(["s", "l", "o", "w"]);
  });

  it("delivers async tool call results through the session stream after the run is already idle", async () => {
    const backend = createBackend(new EchoNcpLLMApi());
    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("hello"),
    });

    const streamed: NcpEndpointEvent[] = [];
    const controller = new AbortController();
    const streamPromise = (async () => {
      for await (const event of backend.stream({
        payload: { sessionId: "session-1" },
        signal: controller.signal,
      })) {
        streamed.push(event);
        if (event.type === NcpEventType.MessageToolCallResult) {
          controller.abort();
        }
      }
    })();

    await backend.updateToolCallResult("session-1", "tool-1", { ok: true });
    await streamPromise;

    expect(streamed).toContainEqual({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: "session-1",
        toolCallId: "tool-1",
        content: { ok: true },
      },
    });
  });
});

describe("DefaultNcpAgentBackend invalid tool arguments", () => {
  it("returns structured invalid args result and preserves raw arguments for the next round", async () => {
    const llmApi = new InvalidArgsThenAnswerNcpLLMApi();
    const toolRegistry = new RecordingSchemaToolRegistry();
    const backend = new DefaultNcpAgentBackend({
      sessionStore: new InMemoryAgentSessionStore(),
      createRuntime: ({
        stateManager,
      }: {
        stateManager: NcpAgentConversationStateManager;
      }) => {
        return new DefaultNcpAgentRuntime({
          contextBuilder: new DefaultNcpContextBuilder(toolRegistry),
          llmApi,
          toolRegistry,
          stateManager,
        });
      },
    });

    const toolResults: unknown[] = [];
    backend.subscribe((event) => {
      if (event.type === NcpEventType.MessageToolCallResult) {
        toolResults.push(event.payload.content);
      }
    });

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("inspect workspace"),
    });

    expect(toolRegistry.executeCalls).toHaveLength(0);
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0]).toEqual({
      ok: false,
      error: {
        code: "invalid_tool_arguments",
        message: "Tool arguments are invalid.",
        toolCallId: "call-invalid",
        toolName: "read_file",
        rawArgumentsText: '{"path":"/tmp/a.txt"}}',
        issues: expect.any(Array),
      },
    });
    const invalidResult = toolResults[0] as {
      error: { issues: string[] };
    };
    expect(invalidResult.error.issues.length).toBeGreaterThan(0);
    expect(llmApi.inputs).toHaveLength(2);
    const secondRoundAssistantMessage = llmApi.inputs[1]?.messages.at(-2) as
      | { tool_calls?: Array<{ function?: { arguments?: string } }> }
      | undefined;
    expect(
      secondRoundAssistantMessage?.tool_calls?.[0]?.function?.arguments,
    ).toBe('{"path":"/tmp/a.txt"}}');
  });

  it("uses tool-provided semantic validation for structured invalid args", async () => {
    const llmApi = new SemanticInvalidArgsThenAnswerNcpLLMApi();
    const toolRegistry = new RecordingSemanticToolRegistry();
    const backend = new DefaultNcpAgentBackend({
      sessionStore: new InMemoryAgentSessionStore(),
      createRuntime: ({
        stateManager,
      }: {
        stateManager: NcpAgentConversationStateManager;
      }) => {
        return new DefaultNcpAgentRuntime({
          contextBuilder: new DefaultNcpContextBuilder(toolRegistry),
          llmApi,
          toolRegistry,
          stateManager,
        });
      },
    });

    const toolResults: unknown[] = [];
    backend.subscribe((event) => {
      if (event.type === NcpEventType.MessageToolCallResult) {
        toolResults.push(event.payload.content);
      }
    });

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("send message"),
    });

    expect(toolRegistry.executeCalls).toHaveLength(0);
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0]).toEqual({
      ok: false,
      error: {
        code: "invalid_tool_arguments",
        message: "Tool arguments are invalid.",
        toolCallId: "call-semantic-invalid",
        toolName: "message",
        rawArgumentsText: '{"channel":"feishu","message":"hello"}',
        issues: [
          "missing required to or chatId when channel differs from current session (ui:web-ui)",
        ],
      },
    });
    expect(llmApi.inputs).toHaveLength(2);
  });
});

describe("DefaultNcpAgentBackend", () => {
  it("accepts an injected session store through the generic core", async () => {
    const sessionStore = new RecordingSessionStore();
    const backend = new DefaultNcpAgentBackend({
      createRuntime: ({
        stateManager,
      }: {
        stateManager: NcpAgentConversationStateManager;
      }) => {
        const toolRegistry = new DefaultNcpToolRegistry();
        return new DefaultNcpAgentRuntime({
          contextBuilder: new DefaultNcpContextBuilder(toolRegistry),
          llmApi: new EchoNcpLLMApi(),
          toolRegistry,
          stateManager,
        });
      },
      sessionStore,
    });

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("generic"),
    });

    expect(sessionStore.saveCallCount).toBeGreaterThan(0);
    const messages = await backend.listSessionMessages("session-1");
    expect(messages.at(-1)).toMatchObject({
      role: "assistant",
      parts: [{ type: "text", text: "generic" }],
    });
  });
});

class SlowEchoNcpLLMApi implements NcpLLMApi {
  async *generate(
    input: NcpLLMApiInput,
    options?: NcpLLMApiOptions,
  ): AsyncGenerator<OpenAIChatChunk> {
    const text = getLastUserText(input);
    for (const char of text) {
      if (options?.signal?.aborted) {
        break;
      }
      await sleep(20);
      yield {
        choices: [{ index: 0, delta: { content: char } }],
      };
    }
    yield {
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    };
  }
}

class EchoNcpLLMApiRuntime implements NcpAgentRuntime {
  async *run(): AsyncGenerator<NcpEndpointEvent> {
    yield {
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId: "session-1",
        message: {
          id: "assistant-1",
          sessionId: "session-1",
          role: "assistant",
          status: "final",
          parts: [{ type: "text", text: "hello" }],
          timestamp: now,
        },
      },
    };
    yield {
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        runId: "run-1",
      },
    };
  }
}

class GatedEchoNcpLLMApi implements NcpLLMApi {
  private readonly startedDeferred = createDeferred<void>();
  private readonly releaseDeferred = createDeferred<void>();

  get started(): Promise<void> {
    return this.startedDeferred.promise;
  }

  release(): void {
    this.releaseDeferred.resolve();
  }

  async *generate(
    input: NcpLLMApiInput,
    options?: NcpLLMApiOptions,
  ): AsyncGenerator<OpenAIChatChunk> {
    const text = getLastUserText(input);
    this.startedDeferred.resolve();
    await this.releaseDeferred.promise;

    for (const char of text) {
      if (options?.signal?.aborted) {
        break;
      }
      yield {
        choices: [{ index: 0, delta: { content: char } }],
      };
    }

    yield {
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    };
  }
}

class InvalidArgsThenAnswerNcpLLMApi implements NcpLLMApi {
  readonly inputs: NcpLLMApiInput[] = [];

  async *generate(input: NcpLLMApiInput): AsyncGenerator<OpenAIChatChunk> {
    this.inputs.push(structuredClone(input));

    const hasToolFeedback = input.messages.some(
      (message) => message.role === "tool",
    );
    if (!hasToolFeedback) {
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call-invalid",
                  type: "function",
                  function: {
                    name: "read_file",
                    arguments: '{"path":"/tmp/a.txt"}}',
                  },
                },
              ],
            },
          },
        ],
      };
      yield {
        choices: [{ delta: {}, finish_reason: "tool_calls" }],
      };
      return;
    }

    yield {
      choices: [{ delta: { content: "handled invalid args" } }],
    };
    yield {
      choices: [{ delta: {}, finish_reason: "stop" }],
    };
  }
}

class SemanticInvalidArgsThenAnswerNcpLLMApi implements NcpLLMApi {
  readonly inputs: NcpLLMApiInput[] = [];

  generate = async function* (
    this: SemanticInvalidArgsThenAnswerNcpLLMApi,
    input: NcpLLMApiInput,
  ): AsyncGenerator<OpenAIChatChunk> {
    this.inputs.push(structuredClone(input));

    const hasToolFeedback = input.messages.some(
      (message) => message.role === "tool",
    );
    if (!hasToolFeedback) {
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call-semantic-invalid",
                  type: "function",
                  function: {
                    name: "message",
                    arguments: '{"channel":"feishu","message":"hello"}',
                  },
                },
              ],
            },
          },
        ],
      };
      yield {
        choices: [{ delta: {}, finish_reason: "tool_calls" }],
      };
      return;
    }

    yield {
      choices: [{ delta: { content: "handled semantic invalid args" } }],
    };
    yield {
      choices: [{ delta: {}, finish_reason: "stop" }],
    };
  };
}

class RecordingSchemaToolRegistry implements NcpToolRegistry {
  readonly executeCalls: Array<{
    toolCallId: string;
    toolName: string;
    args: unknown;
  }> = [];

  private readonly tool: NcpTool = {
    name: "read_file",
    description: "Read a file from disk",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
    execute: async () => "should-not-run",
  };

  listTools = (): readonly NcpTool[] => [this.tool];

  getTool = (name: string): NcpTool | undefined =>
    name === this.tool.name ? this.tool : undefined;

  getToolDefinitions = (): ReadonlyArray<NcpToolDefinition> => {
    return [
      {
        name: this.tool.name,
        description: this.tool.description,
        parameters: this.tool.parameters,
      },
    ];
  };

  execute = async (
    toolCallId: string,
    toolName: string,
    args: unknown,
  ): Promise<unknown> => {
    this.executeCalls.push({ toolCallId, toolName, args });
    return this.tool.execute(args);
  };
}

class RecordingSemanticToolRegistry implements NcpToolRegistry {
  readonly executeCalls: Array<{
    toolCallId: string;
    toolName: string;
    args: unknown;
  }> = [];

  private readonly tool: NcpTool = {
    name: "message",
    description: "Send a message to a chat channel",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string" },
        message: { type: "string" },
        to: { type: "string" },
        chatId: { type: "string" },
      },
      required: [],
    },
    validateArgs: (args) => {
      const explicitChannel =
        typeof args.channel === "string" ? args.channel.trim() : "";
      const explicitTo = typeof args.to === "string" ? args.to.trim() : "";
      const explicitChatId =
        typeof args.chatId === "string" ? args.chatId.trim() : "";
      if (
        explicitChannel.toLowerCase() === "feishu" &&
        !explicitTo &&
        !explicitChatId
      ) {
        return [
          "missing required to or chatId when channel differs from current session (ui:web-ui)",
        ];
      }
      return [];
    },
    execute: async () => "should-not-run",
  };

  listTools = (): readonly NcpTool[] => [this.tool];

  getTool = (name: string): NcpTool | undefined =>
    name === this.tool.name ? this.tool : undefined;

  getToolDefinitions = (): ReadonlyArray<NcpToolDefinition> => {
    return [
      {
        name: this.tool.name,
        description: this.tool.description,
        parameters: this.tool.parameters,
      },
    ];
  };

  execute = async (
    toolCallId: string,
    toolName: string,
    args: unknown,
  ): Promise<unknown> => {
    this.executeCalls.push({ toolCallId, toolName, args });
    return this.tool.execute(args);
  };
}

function getLastUserText(input: NcpLLMApiInput): string {
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (message?.role === "user" && typeof message.content === "string") {
      return message.content;
    }
  }
  return "";
}

async function waitFor(
  assertion: () => boolean | Promise<boolean>,
): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (await assertion()) {
      return;
    }
    await sleep(10);
  }
  throw new Error("Condition not reached in time.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

class RecordingSessionStore implements AgentSessionStore {
  private readonly sessions = new Map<string, AgentSessionRecord>();

  saveCallCount = 0;
  replaceCallCount = 0;

  getSession = async (
    sessionId: string,
  ): Promise<AgentSessionRecord | null> => {
    const session = this.sessions.get(sessionId);
    return session ? structuredClone(session) : null;
  };

  listSessions = async (): Promise<AgentSessionRecord[]> => {
    return [...this.sessions.values()].map((session) =>
      structuredClone(session),
    );
  };

  saveSession = async (session: AgentSessionRecord): Promise<void> => {
    this.saveCallCount += 1;
    this.sessions.set(session.sessionId, structuredClone(session));
  };

  replaceSession = async (session: AgentSessionRecord): Promise<void> => {
    this.replaceCallCount += 1;
    this.sessions.set(session.sessionId, structuredClone(session));
  };

  deleteSession = async (
    sessionId: string,
  ): Promise<AgentSessionRecord | null> => {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    this.sessions.delete(sessionId);
    return structuredClone(session);
  };
}
