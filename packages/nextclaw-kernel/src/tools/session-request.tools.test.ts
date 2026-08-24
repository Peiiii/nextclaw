import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@nextclaw/core";
import type { SessionRequestManager } from "@kernel/features/session-request/index.js";
import { SessionRequestTool } from "./session-request.tools.js";

describe("SessionRequestTool", () => {
  it("passes NCP tool execution context into session requests", async () => {
    const updateToolCallResult = vi.fn(async () => undefined);
    const manager = {
      requestSession: vi.fn(async () => ({ status: "running" })),
    };
    const tool = new SessionRequestTool(manager as unknown as SessionRequestManager);
    const context: ToolExecutionContext = {
      toolCallId: "call-1",
      updateToolCallResult,
    };
    tool.setContext({
      sourceSessionId: "source-session",
      trigger: {
        actor: "agent",
        source: "sessions_request",
        triggeredAt: "2026-06-19T00:00:00.000Z",
        sourceSessionId: "source-session",
        sourceMessageId: "source-message",
        sourceRunId: "source-run",
        sourceModel: "openai/gpt-5.6",
      },
    });

    await tool.execute({
      target: {
        session_id: "target-session",
      },
      task: "继续处理",
      notify: "none",
    }, context);

    expect(manager.requestSession).toHaveBeenCalledWith(expect.objectContaining({
      sourceSessionId: "source-session",
      sourceToolCallId: "call-1",
      targetSessionId: "target-session",
      updateToolCallResult,
      trigger: expect.objectContaining({
        actor: "agent",
        sourceToolCallId: "call-1",
        sourceModel: "openai/gpt-5.6",
      }),
    }));
  });
});
