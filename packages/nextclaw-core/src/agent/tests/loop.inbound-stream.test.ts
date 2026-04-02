import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InboundMessage } from "../bus/events.js";
import { SessionManager } from "../session/manager.js";
import { AgentLoop } from "./loop.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-loop-inbound-stream-test-"));
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

describe("AgentLoop inbound streaming", () => {
  it("forwards assistant deltas during handleInbound", async () => {
    const workspace = createWorkspace();
    const sessionManager = new SessionManager(workspace);
    const providerManager = {
      get: () => ({
        getDefaultModel: () => "openai/gpt-5"
      }),
      chat: vi.fn(async () => ({
        content: "unused",
        toolCalls: []
      })),
      chatStream: vi.fn(async function* () {
        yield { type: "delta", delta: "Hello" } as const;
        yield { type: "delta", delta: " world" } as const;
        yield {
          type: "done",
          response: {
            content: "Hello world",
            toolCalls: [],
            finishReason: "stop",
            usage: {}
          }
        } as const;
      })
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
      channel: "telegram",
      senderId: "user-1",
      chatId: "chat-1",
      content: "你好",
      timestamp: new Date("2026-03-08T10:00:00.000Z"),
      attachments: [],
      metadata: {}
    };
    const deltas: string[] = [];
    const response = await loop.handleInbound({
      message,
      publishResponse: false,
      onAssistantDelta: (delta) => {
        deltas.push(delta);
      }
    });

    expect(deltas).toEqual(["Hello", " world"]);
    expect(response?.content).toBe("Hello world");
    expect(providerManager.chatStream).toHaveBeenCalledTimes(1);
    expect(providerManager.chat).not.toHaveBeenCalled();
    expect(bus.publishOutbound).not.toHaveBeenCalled();
  });
});
