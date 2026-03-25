import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, SessionManager } from "@nextclaw/core";
import { NextclawNcpContextBuilder } from "./nextclaw-ncp-context-builder.js";

const tempWorkspaces: string[] = [];
const originalNextclawHome = process.env.NEXTCLAW_HOME;

function createWorkspace(): { workspace: string; home: string } {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-ncp-context-builder-test-"));
  tempWorkspaces.push(workspace);
  const home = join(workspace, "home");
  mkdirSync(home, { recursive: true });
  process.env.NEXTCLAW_HOME = home;
  return { workspace, home };
}

afterEach(() => {
  if (originalNextclawHome) {
    process.env.NEXTCLAW_HOME = originalNextclawHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
  while (tempWorkspaces.length > 0) {
    const workspace = tempWorkspaces.pop();
    if (!workspace) {
      continue;
    }
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("NextclawNcpContextBuilder tool catalog", () => {
  it("injects runtime tool definitions into the system prompt", () => {
    const { workspace } = createWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "dashscope/qwen3.5-plus",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
      providers: {
        openai: {
          enabled: true,
          apiKey: "test-openai-key",
          models: ["gpt-5.4"],
        },
      },
    });
    const prepareForRun = vi.fn();
    const builder = new NextclawNcpContextBuilder({
      sessionManager: new SessionManager(workspace),
      toolRegistry: {
        prepareForRun,
        getToolDefinitions: () => [
          {
            name: "read_file",
            description: "Read file contents",
            parameters: { type: "object", properties: {}, additionalProperties: false },
          },
          {
            name: "feishu_doc",
            description: "Feishu document operations",
            parameters: { type: "object", properties: {}, additionalProperties: false },
          },
        ],
      } as never,
      getConfig: () => config,
    });

    const prepared = builder.prepare({
      sessionId: `session-${randomUUID()}`,
      messages: [
        {
          role: "user",
          timestamp: new Date("2026-03-25T10:00:00.000Z").toISOString(),
          parts: [{ type: "text", text: "hello" }],
        },
      ],
      metadata: {},
    } as never);

    const systemMessage = prepared.messages[0];
    expect(systemMessage?.role).toBe("system");
    expect(String(systemMessage?.content)).toContain("- feishu_doc: Feishu document operations");
    expect(prepareForRun).toHaveBeenCalledTimes(1);
  });

  it("keeps current-turn text and image parts in composer order", () => {
    const { workspace } = createWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "dashscope/qwen3.5-plus",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
      providers: {
        openai: {
          enabled: true,
          apiKey: "test-openai-key",
          models: ["gpt-5.4"],
        },
      },
    });
    const builder = new NextclawNcpContextBuilder({
      sessionManager: new SessionManager(workspace),
      toolRegistry: {
        prepareForRun: vi.fn(),
        getToolDefinitions: () => [],
      } as never,
      getConfig: () => config,
    });

    const sessionId = `session-${randomUUID()}`;
    const prepared = builder.prepare({
      sessionId,
      messages: [
        {
          id: "user-1",
          sessionId,
          role: "user",
          status: "final",
          timestamp: new Date("2026-03-25T10:00:00.000Z").toISOString(),
          parts: [
            { type: "text", text: "before " },
            {
              type: "file",
              name: "sample.png",
              mimeType: "image/png",
              contentBase64: "ZmFrZS1pbWFnZQ==",
              sizeBytes: 10,
            },
            { type: "text", text: " after" },
          ],
        },
      ],
      metadata: {},
    } as never);

    expect(prepared.messages.at(-1)).toEqual({
      role: "user",
      content: [
        {
          type: "text",
          text: "before ",
        },
        {
          type: "image_url",
          image_url: {
            url: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
          },
        },
        {
          type: "text",
          text: " after",
        },
      ],
    });
    expect(prepared.model).toBe("dashscope/qwen3.5-plus");
  });

  it("keeps historical image context without changing the selected model", () => {
    const { workspace } = createWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "dashscope/qwen3.5-plus",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
      providers: {
        openai: {
          enabled: true,
          apiKey: "test-openai-key",
          models: ["gpt-5.4"],
        },
      },
    });
    const builder = new NextclawNcpContextBuilder({
      sessionManager: new SessionManager(workspace),
      toolRegistry: {
        prepareForRun: vi.fn(),
        getToolDefinitions: () => [],
      } as never,
      getConfig: () => config,
    });

    const sessionId = `session-${randomUUID()}`;
    const prepared = builder.prepare(
      {
        sessionId,
        messages: [
          {
            id: "user-2",
            sessionId,
            role: "user",
            status: "final",
            timestamp: new Date("2026-03-25T10:05:00.000Z").toISOString(),
            parts: [{ type: "text", text: "what is in that image?" }],
          },
        ],
        metadata: {},
      } as never,
      {
        sessionMessages: [
          {
            id: "history-user-image-1",
            sessionId,
            role: "user",
            status: "final",
            timestamp: new Date("2026-03-25T10:00:00.000Z").toISOString(),
            parts: [
              { type: "text", text: "remember this image" },
              {
                type: "file",
                name: "sample.png",
                mimeType: "image/png",
                contentBase64: "ZmFrZS1pbWFnZQ==",
                sizeBytes: 10,
              },
            ],
          },
        ],
      } as never,
    );

    expect(prepared.model).toBe("dashscope/qwen3.5-plus");
    expect(prepared.messages).toContainEqual(
      expect.objectContaining({
        role: "user",
        content: [
          {
            type: "text",
            text: "remember this image",
          },
          {
            type: "image_url",
            image_url: {
              url: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
            },
          },
        ],
      }),
    );
    expect(prepared.messages.at(-1)).toEqual({
      role: "user",
      content: "what is in that image?",
    });
  });
});
