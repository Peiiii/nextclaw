import { describe, expect, it, vi } from "vitest";
import { DesktopToolProvider } from "./desktop-tool.provider.js";

function createProvider() {
  const invokeAgent = vi.fn(async (input: unknown) => input);
  const provider = new DesktopToolProvider(
    {
      resolve: async () => ({
        requestMetadata: { agent_run_id: "run-1" },
        toolRunContext: { agentId: "agent-a", sessionId: "session-a" },
      }),
    } as never,
    { invokeAgent } as never,
  );
  return { invokeAgent, provider };
}

describe("DesktopToolProvider", () => {
  it("exposes only the Codex-style node_repl entry", async () => {
    const fixture = createProvider();
    const tools = await fixture.provider.provide({ message: {} } as never);
    expect(tools.map((tool) => tool.name)).toEqual(["node_repl"]);
    expect(tools[0]?.parameters).toMatchObject({ required: ["code"] });
  });

  it("injects trusted Agent, Session, and Run identity into desktop SDK calls", async () => {
    const fixture = createProvider();
    const [tool] = await fixture.provider.provide({ message: {} } as never);
    await tool?.execute?.({ code: "await desktop.getAppState({ target: { applicationId: 'wechat' } });" });
    expect(fixture.invokeAgent).toHaveBeenCalledWith({
      agentId: "agent-a",
      sessionId: "session-a",
      agentRunId: "run-1",
      method: "host.ui.snapshot",
      payload: { target: { applicationId: "wechat" } },
    });
  });
});
