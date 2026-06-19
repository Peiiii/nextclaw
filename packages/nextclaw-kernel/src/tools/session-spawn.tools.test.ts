import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@nextclaw/core";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { SessionRequestManager } from "@kernel/features/session-request/index.js";
import { SessionSpawnTool } from "./session-spawn.tools.js";

function createTool() {
  const sessionManager = {
    createSession: vi.fn(async () => ({
      sessionId: "child-session",
      lifecycle: "persistent",
      sessionType: "native",
      runtimeFamily: "native",
      metadata: {},
      createdAt: "2026-06-19T00:00:00.000Z",
      updatedAt: "2026-06-19T00:00:00.000Z",
    })),
  };
  const sessionRequestManager = {
    spawnSessionAndRequest: vi.fn(async () => ({ status: "completed", sessionId: "child-session" })),
  };
  const tool = new SessionSpawnTool(
    sessionManager as unknown as SessionManager,
    sessionRequestManager as unknown as SessionRequestManager,
  );
  tool.setContext({
    sourceSessionId: "parent-session",
    sourceSessionMetadata: { project_root: "/tmp/project" },
  });
  return { sessionManager, sessionRequestManager, tool };
}

describe("SessionSpawnTool", () => {
  it("advertises top-level notify instead of nested request", () => {
    const { tool } = createTool();

    expect((tool.parameters.properties as Record<string, unknown>).notify).toMatchObject({
      enum: ["none", "final_reply"],
    });
    expect((tool.parameters.properties as Record<string, unknown>).inheritContext).toMatchObject({
      type: "boolean",
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
      inheritContext: true,
      scope: "child",
      task: "测试一下子代理",
      notify: "final_reply",
    }, context);

    expect(sessionRequestManager.spawnSessionAndRequest).toHaveBeenCalledWith(expect.objectContaining({
      contextInheritance: { anchorToolCallId: "call-1" },
      parentSessionId: "parent-session",
      notify: "final_reply",
      sourceToolCallId: "call-1",
      task: "测试一下子代理",
      updateToolCallResult,
    }));
  });

  it("rejects context inheritance for standalone sessions", async () => {
    const { tool } = createTool();

    await expect(tool.execute({
      inheritContext: true,
      task: "standalone",
    })).rejects.toThrow('inheritContext=true requires scope="child".');
  });

  it("passes context inheritance to child session creation", async () => {
    const { sessionManager, tool } = createTool();

    await tool.execute({
      inheritContext: true,
      scope: "child",
      task: "branch",
    }, { toolCallId: "call-2" });

    expect(sessionManager.createSession).toHaveBeenCalledWith(expect.objectContaining({
      contextInheritance: { anchorToolCallId: "call-2" },
      parentSessionId: "parent-session",
      task: "branch",
    }));
  });

  it("declares the canonical schema without legacy request", () => {
    const { tool } = createTool();

    expect(tool.parameters).toMatchObject({ additionalProperties: false });
    expect((tool.parameters.properties as Record<string, unknown>).request).toBeUndefined();
  });
});
