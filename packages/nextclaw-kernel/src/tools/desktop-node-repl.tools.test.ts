import { describe, expect, it, vi } from "vitest";
import { createDesktopNodeReplTool } from "./desktop-node-repl.tools.js";

describe("createDesktopNodeReplTool", () => {
  it("passes only trusted context and code to the REPL service", async () => {
    const execute = vi.fn(async () => ({ outputs: [] }));
    const tool = createDesktopNodeReplTool({ execute } as never, {
      agentId: "agent-a",
      sessionId: "session-a",
      agentRunId: "run-a",
    });
    await tool.execute({ code: "repl.write('ok')" });
    expect(execute).toHaveBeenCalledWith({
      agentId: "agent-a",
      sessionId: "session-a",
      agentRunId: "run-a",
      code: "repl.write('ok')",
    });
  });
});
