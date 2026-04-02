import { describe, expect, it, vi } from "vitest";
import { SubagentManager } from "./subagent.js";

describe("SubagentManager announce routing", () => {
  it("publishes completion message with origin session metadata", async () => {
    const publishInbound = vi.fn(async (_message: unknown) => undefined);
    const manager = new SubagentManager({
      providerManager: {
        get: () => ({
          getDefaultModel: () => "openai/gpt-5"
        }),
        chat: vi.fn(async () => ({
          content: "done",
          toolCalls: []
        }))
      } as never,
      workspace: process.cwd(),
      bus: {
        publishInbound
      } as never,
      model: "openai/gpt-5"
    });

    await manager.spawn({
      task: "collect release notes",
      originChannel: "ui",
      originChatId: "web-ui",
      originSessionKey: "agent:main:ui:direct:web-ui",
      originAgentId: "main"
    });

    await vi.waitFor(() => {
      expect(publishInbound).toHaveBeenCalledTimes(1);
    });

    const payload = publishInbound.mock.calls[0]?.[0] as
      | {
          channel: string;
          chatId: string;
          metadata?: Record<string, unknown>;
        }
      | undefined;
    expect(payload?.channel).toBe("system");
    expect(payload?.chatId).toBe("ui:web-ui");
    expect(payload?.metadata).toMatchObject({
      session_key_override: "agent:main:ui:direct:web-ui",
      target_agent_id: "main"
    });
  });
});
