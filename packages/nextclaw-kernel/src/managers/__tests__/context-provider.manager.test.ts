import { describe, expect, it } from "vitest";
import { ReplyFormatContextProvider } from "@kernel/contributions/context-provider/index.js";
import { ContextProviderManager } from "@kernel/managers/context-provider.manager.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";

const request = {
  message: {
    id: "message-1",
    sessionId: "session-1",
    role: "user",
    parts: [{ type: "text", text: "hello" }],
  },
} as AgentRunRequest;

describe("ContextProviderManager", () => {
  it("aggregates reply formatting context on the native provider chain", async () => {
    const manager = new ContextProviderManager();
    manager.register({ provide: () => ["base context"] });
    manager.register(new ReplyFormatContextProvider());

    const blocks = await manager.buildContext(request);

    expect(blocks).toHaveLength(2);
    expect(blocks.join("\n")).toContain("base context");
    expect(blocks.join("\n")).toContain("[AGENTS.md](AGENTS.md)");
  });
});
