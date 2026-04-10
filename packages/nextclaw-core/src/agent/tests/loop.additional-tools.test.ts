import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema } from "../../config/schema.js";
import { SessionManager } from "../../session/manager.js";
import { Tool } from "../tools/base.js";
import { AgentLoop } from "../loop.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-loop-additional-tools-test-"));
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

class TestAssetExportTool extends Tool {
  get name(): string {
    return "asset_export";
  }

  get description(): string {
    return "Export managed assets to a normal file path";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {},
    };
  }

  async execute(): Promise<unknown> {
    return { ok: true };
  }
}

describe("AgentLoop additional tools", () => {
  it("injects additional runtime tools into the system prompt tool list", async () => {
    const workspace = createWorkspace();
    const sessionManager = new SessionManager(workspace);
    const providerManager = {
      get: () => ({
        getDefaultModel: () => "openai/gpt-5",
      }),
      setConfig: vi.fn(),
      chat: vi.fn(async (params: { messages: Array<Record<string, unknown>> }) => ({
        content: (params.messages[0]?.content as string) ?? "",
        toolCalls: [],
      })),
      chatStream: vi.fn(),
    };
    const bus = {
      consumeInbound: vi.fn(async () => {
        throw new Error("not implemented in unit test");
      }),
      publishOutbound: vi.fn(async () => undefined),
    };

    const loop = new AgentLoop({
      bus: bus as never,
      providerManager: providerManager as never,
      workspace,
      model: "openai/gpt-5",
      sessionManager,
      config: ConfigSchema.parse({}),
      additionalTools: [new TestAssetExportTool()],
    });

    await loop.handleInbound({
      message: {
        channel: "ui",
        senderId: "user",
        chatId: "web-ui",
        content: "工具都有哪些？",
        timestamp: new Date("2026-04-10T10:00:00.000Z"),
        attachments: [],
        metadata: {},
      },
      sessionKey: "agent:main:ui:direct:web-ui",
      publishResponse: false,
    });

    const firstCall = providerManager.chat.mock.calls[0]?.[0] as
      | { messages?: Array<Record<string, unknown>> }
      | undefined;
    expect(String(firstCall?.messages?.[0]?.content)).toContain(
      "- asset_export: Export managed assets to a normal file path",
    );
  });
});
