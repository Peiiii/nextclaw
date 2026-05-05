import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import {
  ConfigSchema,
  type LLMResponse,
  type LLMStreamEvent,
  MessageBus,
  type ProviderManager,
  SessionManager,
} from "@nextclaw/core";
import type { NcpEndpointEvent, NcpRequestEnvelope } from "@nextclaw/ncp";
import { createUiNcpAgent } from "./create-ui-ncp-agent.service.js";

const tempDirs: string[] = [];

type RecordedCall = {
  kind: "chat" | "stream";
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  model?: string;
  thinkingLevel?: string | null;
};

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-native-context-compaction-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

class DirectAnswerProviderManager {
  readonly calls: RecordedCall[] = [];

  get = () => {
    return {
      getDefaultModel: () => "default-model",
    };
  };

  chat = async (params: Omit<RecordedCall, "kind">): Promise<LLMResponse> => {
    const { messages, model, thinkingLevel, tools } = params;
    this.calls.push({
      kind: "chat",
      messages: structuredClone(messages),
      tools: structuredClone(tools),
      model,
      thinkingLevel: thinkingLevel ?? null,
    });
    return {
      content: "# Compressed Earlier Context\n\nLLM-generated checkpoint summary with decisions and next steps.",
      toolCalls: [],
      finishReason: "stop",
      usage: {},
    };
  };

  chatStream = async function* (
    this: DirectAnswerProviderManager,
    params: Omit<RecordedCall, "kind">,
  ): AsyncGenerator<LLMStreamEvent> {
    const { messages, model, thinkingLevel, tools } = params;
    this.calls.push({
      kind: "stream",
      messages: structuredClone(messages),
      tools: structuredClone(tools),
      model,
      thinkingLevel: thinkingLevel ?? null,
    });
    yield {
      type: "done",
      response: {
        content: "compacted final answer",
        toolCalls: [],
        finishReason: "stop",
        usage: {},
      },
    };
  };
}

function createEnvelope(params: {
  sessionId: string;
  text: string;
}): NcpRequestEnvelope {
  const { sessionId, text } = params;
  return {
    sessionId,
    message: {
      id: `${sessionId}:user:${Date.now()}`,
      sessionId,
      role: "user",
      status: "final",
      timestamp: new Date().toISOString(),
      parts: [{ type: "text", text }],
    },
  };
}

async function sendAndCollectEvents(
  endpoint: {
    send(envelope: NcpRequestEnvelope): Promise<void>;
    subscribe(listener: (event: NcpEndpointEvent) => void): () => void;
  },
  envelope: NcpRequestEnvelope,
): Promise<NcpEndpointEvent[]> {
  const events: NcpEndpointEvent[] = [];
  const unsubscribe = endpoint.subscribe((event) => {
    if (!("payload" in event)) {
      return;
    }
    const payload = event.payload;
    if (payload && "sessionId" in payload && payload.sessionId !== envelope.sessionId) {
      return;
    }
    events.push(event);
  });
  try {
    await endpoint.send(envelope);
    return events;
  } finally {
    unsubscribe();
  }
}

it("runs context compaction preflight before native model input is built", async () => {
  const workspace = createTempWorkspace();
  const config = ConfigSchema.parse({
    agents: {
      defaults: {
        workspace,
        model: "default-model",
        contextTokens: 50_000,
        maxToolIterations: 8,
      },
    },
  });
  const providerManager = new DirectAnswerProviderManager();
  const sessionManager = new SessionManager(workspace);
  const session = sessionManager.getOrCreate("session-context-preflight");
  for (let index = 0; index < 24; index += 1) {
    sessionManager.addMessage(
      session,
      index % 2 === 0 ? "user" : "assistant",
      `historical message ${index} ${"details ".repeat(1000)}`,
    );
  }
  sessionManager.save(session);
  const ncpAgent = await createUiNcpAgent({
    bus: new MessageBus(),
    providerManager: providerManager as unknown as ProviderManager,
    sessionManager,
    getConfig: () => config,
  });

  await sendAndCollectEvents(
    ncpAgent.agentClientEndpoint,
    createEnvelope({
      sessionId: "session-context-preflight",
      text: "continue after compaction",
    }),
  );

  const persistedSession = sessionManager.getOrCreate("session-context-preflight");
  const serviceIndex = persistedSession.messages.findIndex((message) => message.role === "service");
  const currentIndex = persistedSession.messages.findIndex(
    (message) => message.content === "continue after compaction",
  );
  expect(persistedSession.metadata.last_context_compaction).toMatchObject({
    status: "compressed",
    summary: expect.stringContaining("Compressed Earlier Context"),
  });
  expect(serviceIndex).toBeGreaterThanOrEqual(0);
  expect(currentIndex).toBeGreaterThan(serviceIndex);
  expect(providerManager.calls.map((call) => call.kind)).toEqual(["chat", "stream"]);
  expect(String(providerManager.calls[0]?.messages[1]?.content)).toContain("historical message 0");
  const combinedModelInput = providerManager.calls[1]?.messages
    .map((message) => String(message.content ?? ""))
    .join("\n");
  expect(combinedModelInput).toContain("Compressed Earlier Context");
  expect(combinedModelInput).not.toContain("historical message 0");
  expect(combinedModelInput).toContain("continue after compaction");
});
