import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { ConfigSchema, SessionManager } from "@nextclaw/core";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
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

function createAssetStore(home: string): LocalAssetStore {
  return new LocalAssetStore({
    rootDir: join(home, "assets"),
  });
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

it("prefers session project_root over the default workspace for tool context", () => {
    const { workspace } = createWorkspace();
    const projectRoot = join(workspace, "project-alpha");
    mkdirSync(projectRoot, { recursive: true });
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
    const sessionManager = new SessionManager(workspace);
    const sessionId = `session-${randomUUID()}`;
    sessionManager.getOrCreate(sessionId).metadata.project_root = projectRoot;
    const prepareForRun = vi.fn();
    const builder = new NextclawNcpContextBuilder({
      sessionManager,
      toolRegistry: {
        prepareForRun,
        getToolDefinitions: () => [],
      } as never,
      getConfig: () => config,
    });

    builder.prepare({
      sessionId,
      messages: [
        {
          role: "user",
          timestamp: new Date("2026-03-25T10:00:00.000Z").toISOString(),
          parts: [{ type: "text", text: "inspect the project" }],
        },
      ],
      metadata: {},
    } as never);

    expect(prepareForRun).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: projectRoot,
      }),
    );
});

it("keeps current-turn text and asset reference parts in composer order", () => {
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
          type: "text",
          text: [
            "[Asset: sample.png]",
            "[MIME: image/png]",
            "[Size Bytes: 10]",
            "[Instruction: This file is not embedded in the prompt. If you need to inspect or transform it, use asset_export to copy it to a normal file path first.]",
          ].join("\n"),
        },
        {
          type: "text",
          text: " after",
        },
      ],
    });
    expect(prepared.model).toBe("dashscope/qwen3.5-plus");
});

it("keeps historical asset references without changing the selected model", () => {
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
            type: "text",
            text: [
              "[Asset: sample.png]",
              "[MIME: image/png]",
              "[Size Bytes: 10]",
              "[Instruction: This file is not embedded in the prompt. If you need to inspect or transform it, use asset_export to copy it to a normal file path first.]",
            ].join("\n"),
          },
        ],
      }),
    );
    expect(prepared.messages.at(-1)).toEqual({
      role: "user",
      content: "what is in that image?",
    });
});

it("references uploaded assets in current-turn content", async () => {
    const { workspace, home } = createWorkspace();
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
    const assetStore = createAssetStore(home);
    const record = await assetStore.putBytes({
      fileName: "config.json",
      mimeType: "application/json",
      bytes: Buffer.from('{"route":"native"}', "utf8"),
    });
    const builder = new NextclawNcpContextBuilder({
      sessionManager: new SessionManager(workspace),
      toolRegistry: {
        prepareForRun: vi.fn(),
        getToolDefinitions: () => [],
      } as never,
      getConfig: () => config,
      assetStore,
    });

    const sessionId = `session-${randomUUID()}`;
    const prepared = builder.prepare({
      sessionId,
      messages: [
        {
          id: "user-attachment-1",
          sessionId,
          role: "user",
          status: "final",
          timestamp: new Date("2026-03-25T10:00:00.000Z").toISOString(),
          parts: [
            { type: "text", text: "read this json" },
            {
              type: "file",
              name: "config.json",
              mimeType: "application/json",
              assetUri: record.uri,
              sizeBytes: record.sizeBytes,
            },
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
          text: "read this json",
        },
        {
          type: "text",
          text: [
            "[Asset: config.json]",
            "[MIME: application/json]",
            `[Asset URI: ${record.uri}]`,
            `[Size Bytes: ${record.sizeBytes}]`,
            "[Instruction: This file is not embedded in the prompt. If you need to inspect or transform it, use asset_export to copy it to a normal file path first.]",
          ].join("\n"),
        },
      ],
    });
});

it("normalizes service history messages to system before sending them upstream", () => {
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
            id: "follow-up-system-1",
            sessionId,
            role: "system",
            status: "final",
            timestamp: new Date("2026-03-31T10:01:00.000Z").toISOString(),
            parts: [{ type: "text", text: "continue from the service update" }],
          },
        ],
        metadata: {},
      } as never,
      {
        sessionMessages: [
          {
            id: "service-1",
            sessionId,
            role: "service",
            status: "final",
            timestamp: new Date("2026-03-31T10:00:00.000Z").toISOString(),
            parts: [{ type: "text", text: "Subagent Verifier completed." }],
          },
        ],
      } as never,
    );

    expect(prepared.messages).toContainEqual(
      expect.objectContaining({
        role: "system",
        content: "Subagent Verifier completed.",
      }),
    );
  });
