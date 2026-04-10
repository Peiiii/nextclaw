import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema } from "../../config/schema.js";
import { SessionManager } from "../../session/manager.js";
import { AgentLoop } from "../loop.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-loop-tool-catalog-test-"));
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


describe("AgentLoop dynamic tool catalog", () => {
  it("injects extension tools into the system prompt tool list", async () => {
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
      extensionRegistry: {
        tools: [
          {
            extensionId: "feishu",
            names: ["feishu_doc"],
            optional: false,
            source: "test:feishu",
            factory: () => ({
              name: "feishu_doc",
              description: "Feishu document operations",
              parameters: { type: "object", properties: {}, additionalProperties: false },
              async execute() {
                return { ok: true };
              },
            }),
          },
        ],
        channels: [],
        engines: [],
        diagnostics: [],
      },
    });

    await loop.handleInbound({
      message: {
        channel: "ui",
        senderId: "user",
        chatId: "web-ui",
        content: "工具都有哪些？",
        timestamp: new Date("2026-03-25T10:00:00.000Z"),
        attachments: [],
        metadata: {},
      },
      sessionKey: "agent:main:ui:direct:web-ui",
      publishResponse: false,
    });

    expect(providerManager.chat).toHaveBeenCalledTimes(1);
    const firstCall = providerManager.chat.mock.calls[0]?.[0] as
      | { messages?: Array<Record<string, unknown>> }
      | undefined;
    expect(String(firstCall?.messages?.[0]?.content)).toContain(
      "- feishu_doc: Feishu document operations",
    );
  });

  it("drops config-disabled extension tools from the system prompt after runtime reload", async () => {
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

    const enabledConfig = ConfigSchema.parse({});
    const disabledConfig = ConfigSchema.parse({});
    (
      enabledConfig as {
        channels: Record<string, unknown>;
      }
    ).channels = {
      ...(enabledConfig.channels as Record<string, unknown>),
      feishu: { enabled: true },
    };
    (
      disabledConfig as {
        channels: Record<string, unknown>;
      }
    ).channels = {
      ...(disabledConfig.channels as Record<string, unknown>),
      feishu: { enabled: false },
    };

    const loop = new AgentLoop({
      bus: bus as never,
      providerManager: providerManager as never,
      workspace,
      model: "openai/gpt-5",
      sessionManager,
      config: enabledConfig,
      extensionRegistry: {
        tools: [
          {
            extensionId: "feishu",
            names: ["feishu_doc"],
            optional: false,
            source: "test:feishu",
            factory: (ctx) => {
              if (
                (ctx.config?.channels as Record<string, unknown> | undefined)?.feishu &&
                (
                  (
                    (ctx.config?.channels as Record<string, unknown>).feishu as {
                      enabled?: boolean;
                    }
                  ).enabled === false
                )
              ) {
                return [];
              }
              return {
                name: "feishu_doc",
                description: "Feishu document operations",
                parameters: { type: "object", properties: {}, additionalProperties: false },
                async execute() {
                  return { ok: true };
                },
              };
            },
          },
        ],
        channels: [],
        engines: [],
        diagnostics: [],
      },
    });

    await loop.handleInbound({
      message: {
        channel: "ui",
        senderId: "user",
        chatId: "web-ui",
        content: "工具都有哪些？",
        timestamp: new Date("2026-03-25T10:00:00.000Z"),
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
      "- feishu_doc: Feishu document operations",
    );

    providerManager.chat.mockClear();
    loop.applyRuntimeConfig(disabledConfig);

    await loop.handleInbound({
      message: {
        channel: "ui",
        senderId: "user",
        chatId: "web-ui",
        content: "现在有哪些工具？",
        timestamp: new Date("2026-03-25T10:01:00.000Z"),
        attachments: [],
        metadata: {},
      },
      sessionKey: "agent:main:ui:direct:web-ui",
      publishResponse: false,
    });

    const secondCall = providerManager.chat.mock.calls[0]?.[0] as
      | { messages?: Array<Record<string, unknown>> }
      | undefined;
    expect(String(secondCall?.messages?.[0]?.content)).not.toContain("feishu_doc");
  });
});
