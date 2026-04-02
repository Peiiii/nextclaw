import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InboundMessage } from "../bus/events.js";
import { SessionManager } from "../session/manager.js";
import { AgentLoop } from "./loop.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-loop-system-message-test-"));
  tempWorkspaces.push(workspace);
  return workspace;
}

afterEach(() => {
  while (tempWorkspaces.length > 0) {
    const workspace = tempWorkspaces.pop();
    if (!workspace) {
      continue;
    }
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("AgentLoop system message handling", () => {
  it("records subagent handoff as internal event and keeps chat history assistant-only", async () => {
    const workspace = createWorkspace();
    const sessionManager = new SessionManager(workspace);
    const providerManager = {
      get: () => ({
        getDefaultModel: () => "openai/gpt-5"
      }),
      chat: vi.fn(async () => ({
        content: "已完成处理，结果如下。",
        toolCalls: []
      })),
      chatStream: vi.fn()
    };
    const bus = {
      consumeInbound: vi.fn(async () => {
        throw new Error("not implemented in unit test");
      }),
      publishOutbound: vi.fn(async () => undefined)
    };

    const loop = new AgentLoop({
      bus: bus as never,
      providerManager: providerManager as never,
      workspace,
      model: "openai/gpt-5",
      sessionManager
    });

    const message: InboundMessage = {
      channel: "system",
      senderId: "subagent",
      chatId: "ui:web-ui",
      content: "Task completed with final summary.",
      timestamp: new Date("2026-03-08T10:00:00.000Z"),
      attachments: [],
      metadata: {
        session_key_override: "agent:main:ui:direct:web-ui",
        target_agent_id: "main",
        system_event_kind: "subagent_completion",
        subagent_label: "research-task"
      }
    };

    const response = await loop.handleInbound({
      message,
      sessionKey: "agent:main:ui:direct:web-ui",
      publishResponse: false
    });

    expect(response?.channel).toBe("ui");
    expect(response?.chatId).toBe("web-ui");
    expect(response?.content).toBe("已完成处理，结果如下。");
    expect(providerManager.chat).toHaveBeenCalledTimes(1);
    expect(bus.publishOutbound).not.toHaveBeenCalled();

    const session = sessionManager.getIfExists("agent:main:ui:direct:web-ui");
    expect(session).not.toBeNull();
    expect(session?.messages.map((item) => item.role)).toEqual(["assistant"]);
    expect(session?.events.some((event) => event.type === "message.user")).toBe(false);

    const handoffEvent = session?.events.find((event) => event.type === "system.subagent_completion");
    expect(handoffEvent).toBeTruthy();
    expect(handoffEvent?.data).toMatchObject({
      senderId: "subagent",
      content: "Task completed with final summary.",
      sourceChannel: "system",
      sourceChatId: "ui:web-ui",
      originChannel: "ui",
      originChatId: "web-ui",
      sessionKey: "agent:main:ui:direct:web-ui"
    });
  });
});
