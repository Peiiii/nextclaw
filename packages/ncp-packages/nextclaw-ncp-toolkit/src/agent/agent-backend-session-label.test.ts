import { describe, expect, it } from "vitest";
import { type NcpAgentConversationStateManager, type NcpRequestEnvelope, NcpEventType } from "@nextclaw/ncp";
import { DefaultNcpContextBuilder, DefaultNcpAgentRuntime, DefaultNcpToolRegistry, EchoNcpLLMApi } from "@nextclaw/ncp-agent-runtime";
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

function createBackend() {
  return new DefaultNcpAgentBackend({
    sessionStore: new InMemoryAgentSessionStore(),
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
}

describe("DefaultNcpAgentBackend auto session label", () => {
  it("uses first user message as auto label and truncates it", async () => {
    const backend = createBackend();
    const longText = "这是一个非常长的首条用户消息，用来验证会话自动命名会进行长度截断并追加省略号。".repeat(3);

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: createEnvelope(longText),
    });

    const session = await backend.getSession("session-1");
    expect(typeof session?.metadata?.label).toBe("string");
    const label = session?.metadata?.label as string;
    expect(label.length).toBeLessThanOrEqual(65);
    expect(label.endsWith("…")).toBe(true);
  });

  it("does not override existing label metadata", async () => {
    const backend = createBackend();

    await backend.emit({
      type: NcpEventType.MessageRequest,
      payload: {
        ...createEnvelope("new title from message"),
        metadata: {
          label: "Pinned Session Label",
        },
      },
    });

    const session = await backend.getSession("session-1");
    expect(session?.metadata?.label).toBe("Pinned Session Label");
  });
});
