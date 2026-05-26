import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@nextclaw/core";
import type { NcpSessionManager } from "@kernel/managers/ncp-session.manager.js";
import type { SessionRequestManager } from "@kernel/features/session-request/index.js";
import { SessionSpawnTool } from "./session-spawn.tools.js";

function createTool() {
  const sessionRequestManager = {
    spawnSessionAndRequest: vi.fn(async () => ({ status: "completed", sessionId: "child-session" })),
  };
  const tool = new SessionSpawnTool(
    { createSession: vi.fn() } as unknown as NcpSessionManager,
    sessionRequestManager as unknown as SessionRequestManager,
  );
  tool.setContext({
    sourceSessionId: "parent-session",
    sourceSessionMetadata: { project_root: "/tmp/project" },
  });
  return { sessionRequestManager, tool };
}

describe("SessionSpawnTool", () => {
  it("advertises top-level notify instead of nested request", () => {
    const { tool } = createTool();

    expect((tool.parameters.properties as Record<string, unknown>).notify).toMatchObject({
      enum: ["none", "final_reply"],
    });
    expect((tool.parameters.properties as Record<string, unknown>).request).toBeUndefined();
  });

  it("starts child sessions from top-level notify", async () => {
    const { sessionRequestManager, tool } = createTool();
    const updateToolCallResult = vi.fn(async () => undefined);
    const context: ToolExecutionContext = {
      toolCallId: "call-1",
      updateToolCallResult,
    };

    await tool.execute({
      scope: "child",
      task: "测试一下子代理",
      notify: "final_reply",
    }, context);

    expect(sessionRequestManager.spawnSessionAndRequest).toHaveBeenCalledWith(expect.objectContaining({
      parentSessionId: "parent-session",
      notify: "final_reply",
      sourceToolCallId: "call-1",
      task: "测试一下子代理",
      updateToolCallResult,
    }));
  });

  it("declares the canonical schema without legacy request", () => {
    const { tool } = createTool();

    expect(tool.parameters).toMatchObject({ additionalProperties: false });
    expect((tool.parameters.properties as Record<string, unknown>).request).toBeUndefined();
  });
});
