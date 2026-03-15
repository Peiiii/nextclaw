import { describe, expect, it } from "vitest";
import {
  type NcpAgentConversationStateManager,
  type NcpLLMApi,
  type NcpLLMApiInput,
  type NcpLLMApiOptions,
  type NcpRequestEnvelope,
  type OpenAIChatChunk,
  NcpEventType,
} from "@nextclaw/ncp";
import {
  DefaultNcpAgentRuntime,
  DefaultNcpContextBuilder,
  DefaultNcpToolRegistry,
  EchoNcpLLMApi,
} from "@nextclaw/ncp-agent-runtime";
import { DefaultNcpInMemoryAgentBackend } from "./in-memory-agent-backend.js";

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

function createBackend(llmApi: NcpLLMApi) {
  return new DefaultNcpInMemoryAgentBackend({
    createRuntime: ({ stateManager }: { stateManager: NcpAgentConversationStateManager }) => {
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

describe("DefaultNcpInMemoryAgentBackend", () => {
  it("stores completed assistant message and replays run events", async () => {
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
    expect(events).toContain(NcpEventType.MessageCompleted);
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

    const runStarted = await findRunId(backend, createEnvelope("hello"));
    const replayed: string[] = [];
    const signal = new AbortController().signal;
    for await (const event of backend.stream({
      payload: { sessionId: "session-1", runId: runStarted },
      signal,
    })) {
      replayed.push(event.type);
    }

    expect(replayed).toContain(NcpEventType.MessageSent);
    expect(replayed).toContain(NcpEventType.MessageCompleted);
    expect(replayed.at(-1)).toBe(NcpEventType.RunFinished);
  });

  it("aborts a slow run and clears session status", async () => {
    const backend = createBackend(new SlowEchoNcpLLMApi());
    const runIds: string[] = [];
    backend.subscribe((event) => {
      if (event.type === NcpEventType.RunStarted && event.payload.runId) {
        runIds.push(event.payload.runId);
      }
    });

    const requestPromise = backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("slow"),
    });

    await waitFor(() => runIds.length > 0);
    await backend.emit({
      type: NcpEventType.MessageAbort,
      payload: { runId: runIds[0] },
    });
    await requestPromise;

    const session = await backend.getSession("session-1");
    expect(session?.status).toBe("idle");
    const replayed: string[] = [];
    for await (const event of backend.stream({
      payload: { sessionId: "session-1", runId: runIds[0] },
      signal: new AbortController().signal,
    })) {
      replayed.push(event.type);
    }
    expect(replayed).toContain(NcpEventType.MessageAbort);
  });
});

async function findRunId(
  backend: DefaultNcpInMemoryAgentBackend,
  envelope: NcpRequestEnvelope,
): Promise<string> {
  const runIds: string[] = [];
  const unsubscribe = backend.subscribe((event) => {
    if (event.type === NcpEventType.RunStarted && event.payload.runId) {
      runIds.push(event.payload.runId);
    }
  });
  try {
    await backend.emit({ type: NcpEventType.MessageRequest, payload: envelope });
  } finally {
    unsubscribe();
  }
  if (!runIds[0]) {
    throw new Error("Missing run.started event.");
  }
  return runIds[0];
}

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

function getLastUserText(input: NcpLLMApiInput): string {
  for (let index = input.messages.length - 1; index >= 0; index -= 1) {
    const message = input.messages[index];
    if (message?.role === "user" && typeof message.content === "string") {
      return message.content;
    }
  }
  return "";
}

async function waitFor(assertion: () => boolean): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (assertion()) {
      return;
    }
    await sleep(10);
  }
  throw new Error("Condition not reached in time.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
