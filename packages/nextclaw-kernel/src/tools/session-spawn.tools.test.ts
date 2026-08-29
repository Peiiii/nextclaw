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
    trigger: {
      actor: "agent",
      source: "sessions_spawn",
      triggeredAt: "2026-06-19T00:00:00.000Z",
      sourceSessionId: "parent-session",
      sourceMessageId: "source-message",
      sourceRunId: "source-run",
      sourceModel: "openai/gpt-5.6",
    },
  });
  return { sessionManager, sessionRequestManager, tool };
}

describe("SessionSpawnTool", () => {
  it("advertises independent start, wait, and notify controls", () => {
    const { tool } = createTool();

    expect((tool.parameters.properties as Record<string, unknown>).notify).toMatchObject({
      enum: ["none", "final_reply"],
    });
    expect((tool.parameters.properties as Record<string, unknown>).wait).toMatchObject({
      enum: ["none", "final_reply"],
    });
    expect((tool.parameters.properties as Record<string, unknown>).start).toMatchObject({
      type: "boolean",
    });
    expect((tool.parameters.properties as Record<string, unknown>).inheritContext).toMatchObject({
      type: "boolean",
    });
    expect((tool.parameters.properties as Record<string, unknown>).request).toBeUndefined();
  });

  it("starts child sessions by default without waiting for completion", async () => {
    const { sessionManager, sessionRequestManager, tool } = createTool();
    const context: ToolExecutionContext = {
      toolCallId: "call-1",
    };

    await tool.execute({
      inheritContext: true,
      scope: "child",
      task: "测试一下子代理",
    }, context);

    expect(sessionRequestManager.spawnSessionAndRequest).toHaveBeenCalledWith(expect.objectContaining({
      contextInheritance: { anchorToolCallId: "call-1" },
      parentSessionId: "parent-session",
      notify: "final_reply",
      wait: "none",
      sourceToolCallId: "call-1",
      task: "测试一下子代理",
      trigger: expect.objectContaining({
        actor: "agent",
        sourceToolCallId: "call-1",
        sourceModel: "openai/gpt-5.6",
      }),
    }));
    expect(sessionManager.createSession).not.toHaveBeenCalled();
  });

  it("rejects context inheritance for standalone sessions", async () => {
    const { tool } = createTool();

    await expect(tool.execute({
      inheritContext: true,
      task: "standalone",
    })).rejects.toThrow('inheritContext=true requires scope="child".');
  });

  it("creates an idle child session only when start is explicitly false", async () => {
    const { sessionManager, sessionRequestManager, tool } = createTool();

    await tool.execute({
      inheritContext: true,
      scope: "child",
      start: false,
      task: "branch",
    }, { toolCallId: "call-2" });

    expect(sessionManager.createSession).toHaveBeenCalledWith(expect.objectContaining({
      contextInheritance: { anchorToolCallId: "call-2" },
      metadataOverrides: {
        session_creation_trigger: expect.objectContaining({
          actor: "agent",
          sourceToolCallId: "call-2",
        }),
      },
      parentSessionId: "parent-session",
      task: "branch",
    }));
    expect(sessionRequestManager.spawnSessionAndRequest).not.toHaveBeenCalled();
  });

  it("accepts neutral generated policies for create-only and rejects active delivery policies", async () => {
    const { sessionManager, tool } = createTool();

    await tool.execute({
      start: false,
      task: "idle",
      notify: "none",
      wait: "none",
    });

    expect(sessionManager.createSession).toHaveBeenCalled();

    await expect(tool.execute({
      start: false,
      task: "idle",
      notify: "final_reply",
    })).rejects.toThrow("start=false cannot request waiting or completion notification");
  });

  it("declares the canonical schema without legacy request", () => {
    const { tool } = createTool();

    expect(tool.parameters).toMatchObject({ additionalProperties: false });
    expect((tool.parameters.properties as Record<string, unknown>).request).toBeUndefined();
  });
});
