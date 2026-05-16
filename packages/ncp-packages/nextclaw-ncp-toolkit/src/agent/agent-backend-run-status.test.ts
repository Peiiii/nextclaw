import { describe, expect, it, vi } from "vitest";
import {
  type NcpAgentConversationStateManager,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  NcpEventType,
  type NcpRequestEnvelope,
} from "@nextclaw/ncp";
import {
  DefaultNcpContextBuilder,
  DefaultNcpAgentRuntime,
  DefaultNcpToolRegistry,
  EchoNcpLLMApi,
} from "@nextclaw/ncp-agent-runtime";
import { DefaultNcpAgentBackend, InMemoryAgentSessionStore } from "./index.js";

const now = "2026-03-15T00:00:00.000Z";

function createEnvelope(text: string): NcpRequestEnvelope {
  return {
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
  };
}

describe("DefaultNcpAgentBackend run-status events", () => {
  it("publishes running then idle when a session execution starts and settles", async () => {
    const onSessionRunStatusChanged = vi.fn();
    const backend = new DefaultNcpAgentBackend({
      sessionStore: new InMemoryAgentSessionStore(),
      onSessionRunStatusChanged,
      createRuntime: ({ stateManager }: { stateManager: NcpAgentConversationStateManager }) => {
        const toolRegistry = new DefaultNcpToolRegistry();
        return new DefaultNcpAgentRuntime({
          contextBuilder: new DefaultNcpContextBuilder(toolRegistry),
          llmApi: new EchoNcpLLMApi(),
          toolRegistry,
          stateManager,
        });
      },
    });

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("hello"),
    });

    expect(onSessionRunStatusChanged).toHaveBeenNthCalledWith(1, {
      sessionKey: "session-1",
      status: "running",
    });
    expect(onSessionRunStatusChanged).toHaveBeenLastCalledWith({
      sessionKey: "session-1",
      status: "idle",
    });
  });

  it("disposes live session runtimes when the backend stops", async () => {
    const runtime = new DisposableEchoRuntime();
    const backend = new DefaultNcpAgentBackend({
      createRuntime: () => runtime,
      sessionStore: new InMemoryAgentSessionStore(),
    });

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope("dispose"),
    });
    await backend.stop();

    expect(runtime.disposeCallCount).toBe(1);
  });
});

class DisposableEchoRuntime implements NcpAgentRuntime {
  disposeCallCount = 0;

  async *run(): AsyncGenerator<NcpEndpointEvent> {
    yield {
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId: "session-1",
        message: {
          id: "assistant-disposable",
          sessionId: "session-1",
          role: "assistant",
          status: "final",
          parts: [{ type: "text", text: "disposed" }],
          timestamp: now,
        },
      },
    };
    yield {
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-disposable",
        runId: "run-disposable",
      },
    };
  }

  dispose = (): void => {
    this.disposeCallCount += 1;
  };
}
