import { describe, expect, it, vi } from "vitest";
import { type NcpAgentConversationStateManager, NcpEventType, type NcpRequestEnvelope } from "@nextclaw/ncp";
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
});
