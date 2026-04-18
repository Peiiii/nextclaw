import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { ConfigSchema, SessionManager } from "@nextclaw/core";
import { LocalAssetStore } from "@nextclaw/ncp-agent-runtime";
import { NextclawNcpContextBuilder } from "../nextclaw-ncp-context-builder.js";
import {
  createNcpTestConfig,
  writeSkillFixture,
} from "./nextclaw-ncp-context-builder.test-support.js";

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

function writeGitConfig(workspace: string, config: string): void {
  mkdirSync(join(workspace, ".git"), { recursive: true });
  writeFileSync(join(workspace, ".git", "config"), config);
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
    writeGitConfig(
      workspace,
      [
        '[remote "origin"]',
        "  url = https://github.com/Peiiii/nextclaw.git",
      ].join("\n"),
    );
    const config = createNcpTestConfig(workspace);
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
    expect(String(systemMessage?.content)).toContain("Canonical repository: https://github.com/Peiiii/nextclaw");
    expect(String(systemMessage?.content)).toContain("Repository identity rule:");
    expect(String(systemMessage?.content)).toContain("- feishu_doc: Feishu document operations");
    expect(String(systemMessage?.content)).toContain("## Tool Use Enforcement");
    expect(String(systemMessage?.content)).toContain("## OpenAI/Codex Execution Discipline");
    expect(prepareForRun).toHaveBeenCalledTimes(1);
});

it("injects session orchestration guidance into the NCP system prompt", () => {
    const { workspace } = createWorkspace();
    const config = createNcpTestConfig(workspace, {
      model: "dashscope/qwen3.5-plus",
    });
    const builder = new NextclawNcpContextBuilder({
      sessionManager: new SessionManager(workspace),
      toolRegistry: {
        prepareForRun: vi.fn(),
        getToolDefinitions: () => [
          {
            name: "sessions_spawn",
            description: "Create a session",
            parameters: { type: "object", properties: {}, additionalProperties: false },
          },
          {
            name: "sessions_request",
            description: "Request work from another session",
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
          parts: [{ type: "text", text: "open a new session and let it investigate" }],
        },
      ],
      metadata: {},
    } as never);

    const systemPrompt = String(prepared.messages[0]?.content ?? "");
    expect(systemPrompt).toContain("## Session Orchestration");
    expect(systemPrompt).toContain("`nextclaw agents runtimes --json`");
    expect(systemPrompt).toContain("`sessions_spawn` is the unified session-creation tool");
    expect(systemPrompt).toContain("use `scope=\"child\"` when the new session should be a child session");
    expect(systemPrompt).toContain("Add `request: { notify: \"none\" | \"final_reply\" }`");
    expect(systemPrompt).toContain("`sessions_spawn.scope=\"child\"` and `sessions_spawn.request.notify=\"final_reply\"`");
    expect(systemPrompt).toContain("`sessions_request.target` must be an object shaped like");
  });

it("preserves requested skill refs and learning guidance in the NCP prompt", () => {
    const { workspace } = createWorkspace();
    const projectRoot = join(workspace, "project-alpha");
    mkdirSync(projectRoot, { recursive: true });
    const hostSkillDir = writeSkillFixture({
      rootDir: join(workspace, "skills"),
      skillName: "shared-skill",
      description: "Host shared skill",
      body: "Host skill body.",
    });
    const projectSkillDir = writeSkillFixture({
      rootDir: join(projectRoot, ".agents", "skills"),
      skillName: "shared-skill",
      description: "Project shared skill",
      body: "Project skill body.",
    });

    const config = createNcpTestConfig(workspace);
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

    const projectSkillRef = `project:${projectSkillDir}`;
    const hostSkillRef = `workspace:${hostSkillDir}`;
    const prepared = builder.prepare({
      sessionId,
      messages: [
        {
          role: "user",
          timestamp: new Date("2026-03-25T10:00:00.000Z").toISOString(),
          parts: [{ type: "text", text: "hello" }],
          metadata: {
            requested_skill_refs: [projectSkillRef, hostSkillRef],
          },
        },
      ],
      metadata: {},
    } as never);

    const systemPrompt = String(prepared.messages[0]?.content ?? "");
    const userPrompt = String(prepared.messages[prepared.messages.length - 1]?.content ?? "");

    expect(systemPrompt).toContain(projectSkillRef);
    expect(systemPrompt).toContain(hostSkillRef);
    expect(systemPrompt).toContain("# Skill Learning Loop");
    expect(userPrompt).toContain(`[Requested skills for this turn: ${projectSkillRef}, ${hostSkillRef}]`);
  });

it("prefers session project_root over the default workspace for tool context", () => {
    const { workspace } = createWorkspace();
    const projectRoot = join(workspace, "project-alpha");
    mkdirSync(projectRoot, { recursive: true });
    const config = createNcpTestConfig(workspace, {
      model: "dashscope/qwen3.5-plus",
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

it("selects the stored session agent profile before request metadata", () => {
    const { workspace } = createWorkspace();
    const engineerWorkspace = join(workspace, "engineer-home");
    mkdirSync(engineerWorkspace, { recursive: true });
    const config = createNcpTestConfig(workspace, {
      model: "default-model",
    }, {
      agents: {
        list: [
          {
            id: "engineer",
            workspace: engineerWorkspace,
            model: "engineer-model",
          },
        ],
      },
    });
    const sessionManager = new SessionManager(workspace);
    const sessionId = `session-${randomUUID()}`;
    sessionManager.getOrCreate(sessionId).agentId = "engineer";
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
          parts: [{ type: "text", text: "inspect the engineer workspace" }],
          metadata: {
            agent_id: "main",
          },
        },
      ],
      metadata: {},
    } as never);

    expect(prepareForRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "engineer",
        model: "engineer-model",
        workspace: engineerWorkspace,
      }),
    );
  });

it("uses request metadata agent_id when the session has no stored agent owner yet", () => {
    const { workspace } = createWorkspace();
    const reviewerWorkspace = join(workspace, "reviewer-home");
    mkdirSync(reviewerWorkspace, { recursive: true });
    const config = createNcpTestConfig(workspace, {
      model: "default-model",
    }, {
      agents: {
        list: [
          {
            id: "reviewer",
            workspace: reviewerWorkspace,
            model: "reviewer-model",
          },
        ],
      },
    });
    const prepareForRun = vi.fn();
    const builder = new NextclawNcpContextBuilder({
      sessionManager: new SessionManager(workspace),
      toolRegistry: {
        prepareForRun,
        getToolDefinitions: () => [],
      } as never,
      getConfig: () => config,
    });

    builder.prepare({
      sessionId: `session-${randomUUID()}`,
      messages: [
        {
          role: "user",
          timestamp: new Date("2026-03-25T10:00:00.000Z").toISOString(),
          parts: [{ type: "text", text: "review the patch" }],
        },
      ],
      metadata: {
        agent_id: "reviewer",
      },
    } as never);

    expect(prepareForRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "reviewer",
        model: "reviewer-model",
        workspace: reviewerWorkspace,
      }),
    );
  });

it("keeps host workspace context and skills when a session is bound to a project root", () => {
    const { workspace } = createWorkspace();
    const projectRoot = join(workspace, "project-alpha");
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(join(workspace, "AGENTS.md"), "Host workspace guidance.\n");
    writeFileSync(join(projectRoot, "AGENTS.md"), "Project workspace guidance.\n");
    writeSkillFixture({
      rootDir: join(workspace, "skills"),
      skillName: "host-helper",
      description: "Host workspace helper",
      body: "Use the host workspace helper instructions.",
    });

    const config = createNcpTestConfig(workspace, {
      model: "dashscope/qwen3.5-plus",
    }, {
      agents: {
        context: {
          bootstrap: {
            files: ["AGENTS.md"],
            minimalFiles: ["AGENTS.md"],
            heartbeatFiles: [],
            perFileChars: 1000,
            totalChars: 3000,
          },
        },
      },
    });

    const sessionManager = new SessionManager(workspace);
    const sessionId = `session-${randomUUID()}`;
    sessionManager.getOrCreate(sessionId).metadata.project_root = projectRoot;
    const builder = new NextclawNcpContextBuilder({
      sessionManager,
      toolRegistry: {
        prepareForRun: vi.fn(),
        getToolDefinitions: () => [],
      } as never,
      getConfig: () => config,
    });

    const prepared = builder.prepare({
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

    const systemPrompt = String(prepared.messages[0]?.content ?? "");
    expect(systemPrompt).toContain(`Active project directory: ${projectRoot}`);
    expect(systemPrompt).toContain(`NextClaw host workspace directory: ${workspace}`);
    expect(systemPrompt).toContain("Project workspace guidance.");
    expect(systemPrompt).toContain("Host workspace guidance.");
    expect(systemPrompt).toContain("<name>host-helper</name>");
  });

it("keeps current-turn text, image input, and asset hint parts in composer order", () => {
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
            detail: "auto",
          },
        },
        {
          type: "text",
          text: [
            "[Attached Image: sample.png]",
            "[MIME: image/png]",
            "[Size Bytes: 10]",
            "[Instruction: This image is embedded in the prompt.]",
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

it("keeps historical image inputs available without changing the selected model", () => {
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
              detail: "auto",
            },
          },
          {
            type: "text",
            text: [
              "[Attached Image: sample.png]",
              "[MIME: image/png]",
              "[Size Bytes: 10]",
              "[Instruction: This image is embedded in the prompt.]",
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

it("converts uploaded image assets into multimodal current-turn content", async () => {
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
      fileName: "screen.png",
      mimeType: "image/png",
      bytes: Buffer.from("ZmFrZS1pbWFnZQ==", "base64"),
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
          id: "user-image-asset-1",
          sessionId,
          role: "user",
          status: "final",
          timestamp: new Date("2026-03-25T10:00:00.000Z").toISOString(),
          parts: [
            { type: "text", text: "inspect this screenshot" },
            {
              type: "file",
              name: "screen.png",
              mimeType: "image/png",
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
          text: "inspect this screenshot",
        },
        {
          type: "image_url",
          image_url: {
            url: "data:image/png;base64,ZmFrZS1pbWFnZQ==",
            detail: "auto",
          },
        },
        {
          type: "text",
          text: [
            "[Attached Image: screen.png]",
            "[MIME: image/png]",
            `[Asset URI: ${record.uri}]`,
            `[Size Bytes: ${record.sizeBytes}]`,
            "[Instruction: This image is embedded in the prompt. If you need to transform or process the original file with tools, use the asset URI.]",
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
