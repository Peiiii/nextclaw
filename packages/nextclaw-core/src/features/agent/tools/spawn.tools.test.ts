import { describe, expect, it, vi } from "vitest";
import type { SubagentService } from "@core/features/agent/services/subagent.service.js";
import { createToolExecutionContext } from "./base.tools.js";
import { SpawnTool } from "./spawn.tools.js";

describe("SpawnTool", () => {
  it("forwards explicit model override and session model context", async () => {
    const spawn = vi.fn(async () => "ok");
    const tool = new SpawnTool({ spawn } as unknown as SubagentService);
    tool.setContext("discord", "room-1", "openai/gpt-5");

    await tool.execute({
      task: "draft release notes",
      label: "release-notes",
      model: "anthropic/claude-sonnet-4-5"
    }, createToolExecutionContext());

    expect(spawn).toHaveBeenCalledWith({
      task: "draft release notes",
      label: "release-notes",
      model: "anthropic/claude-sonnet-4-5",
      sessionModel: "openai/gpt-5",
      originChannel: "discord",
      originChatId: "room-1",
      originSessionKey: undefined,
      originAgentId: undefined
    });
  });

  it("ignores blank model and keeps session model fallback", async () => {
    const spawn = vi.fn(async () => "ok");
    const tool = new SpawnTool({ spawn } as unknown as SubagentService);
    tool.setContext("telegram", "chat-2", "openai/gpt-5");

    await tool.execute({
      task: "collect bug reports",
      model: "   "
    }, createToolExecutionContext());

    expect(spawn).toHaveBeenCalledWith({
      task: "collect bug reports",
      label: undefined,
      model: undefined,
      sessionModel: "openai/gpt-5",
      originChannel: "telegram",
      originChatId: "chat-2",
      originSessionKey: undefined,
      originAgentId: undefined
    });
  });

  it("forwards origin session and agent context when available", async () => {
    const spawn = vi.fn(async () => "ok");
    const tool = new SpawnTool({ spawn } as unknown as SubagentService);
    tool.setContext("ui", "web-ui", "openai/gpt-5", "agent:main:ui:direct:web-ui", "main");

    await tool.execute({
      task: "summarize changelog"
    }, createToolExecutionContext());

    expect(spawn).toHaveBeenCalledWith({
      task: "summarize changelog",
      label: undefined,
      model: undefined,
      sessionModel: "openai/gpt-5",
      originChannel: "ui",
      originChatId: "web-ui",
      originSessionKey: "agent:main:ui:direct:web-ui",
      originAgentId: "main"
    });
  });
});
