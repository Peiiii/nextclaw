import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConfigSchema,
  MessageBus,
  SessionManager,
  type LLMStreamEvent,
  type ProviderManager,
} from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent, type NcpRequestEnvelope } from "@nextclaw/ncp";
import { createUiNcpAgent } from "../create-ui-ncp-agent.service.js";

const tempDirs: string[] = [];

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-reasoning-normalization-"));
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

class ThinkTagProviderManager {
  readonly calls: Array<Record<string, unknown>> = [];

  get() {
    return {
      getDefaultModel: () => "default-model",
    };
  }

  async *chatStream(params: Record<string, unknown>): AsyncGenerator<LLMStreamEvent> {
    this.calls.push(structuredClone(params));
    yield {
      type: "done",
      response: {
        content: "<think>internal reasoning</think><final>visible answer",
        toolCalls: [],
        finishReason: "stop",
        usage: {},
      },
    };
  }
}

function createEnvelope(sessionId: string, text: string): NcpRequestEnvelope {
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

describe("createUiNcpAgent reasoning normalization", () => {
  it("defaults native NCP runtime think-tag normalization to on in nextclaw", async () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "default-model",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
    });

    const providerManager = new ThinkTagProviderManager();
    const sessionManager = new SessionManager(workspace);
    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: providerManager as unknown as ProviderManager,
      sessionManager,
      getConfig: () => config,
    });

    const events = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope("session-1", "hello"),
    );

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageSent,
      NcpEventType.RunStarted,
      NcpEventType.MessageReasoningDelta,
      NcpEventType.MessageTextStart,
      NcpEventType.MessageTextDelta,
      NcpEventType.MessageTextEnd,
      NcpEventType.MessageCompleted,
      NcpEventType.RunFinished,
    ]);

    const persistedSession = sessionManager.getIfExists("session-1");
    const assistantMessage = persistedSession?.messages
      .filter((message) => message.role === "assistant")
      .at(-1);
    expect(assistantMessage?.reasoning_content).toBe("internal reasoning");
    expect(String(assistantMessage?.content ?? "")).toBe("visible answer");
    expect(String(assistantMessage?.content ?? "")).not.toContain("<think>");
  });

  it("allows native NCP runtime think-tag normalization to be explicitly disabled", async () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "default-model",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
      ui: {
        ncp: {
          runtimes: {
            native: {
              reasoningNormalization: {
                mode: "off",
              },
            },
          },
        },
      },
    });

    const providerManager = new ThinkTagProviderManager();
    const sessionManager = new SessionManager(workspace);
    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: providerManager as unknown as ProviderManager,
      sessionManager,
      getConfig: () => config,
    });

    const events = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope("session-off", "hello"),
    );

    expect(events.map((event) => event.type)).toEqual([
      NcpEventType.MessageSent,
      NcpEventType.RunStarted,
      NcpEventType.MessageTextStart,
      NcpEventType.MessageTextDelta,
      NcpEventType.MessageTextEnd,
      NcpEventType.MessageCompleted,
      NcpEventType.RunFinished,
    ]);

    const persistedSession = sessionManager.getIfExists("session-off");
    const assistantMessage = persistedSession?.messages
      .filter((message) => message.role === "assistant")
      .at(-1);
    expect(assistantMessage?.reasoning_content).toBeUndefined();
    expect(String(assistantMessage?.content ?? "")).toContain("<think>");
  });
});
