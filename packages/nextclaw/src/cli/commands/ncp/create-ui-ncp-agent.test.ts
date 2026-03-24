import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConfigSchema,
  type Config,
  MessageBus,
  SessionManager,
  type LLMStreamEvent,
  type ProviderManager,
} from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent, type NcpRequestEnvelope } from "@nextclaw/ncp";
import { loadPluginRegistry, toExtensionRegistry, type NextclawExtensionRegistry } from "../plugins.js";
import codexRuntimePlugin from "../../../../../extensions/nextclaw-ncp-runtime-plugin-codex-sdk/src/index.js";
import { createUiNcpAgent } from "./create-ui-ncp-agent.js";

const tempDirs: string[] = [];
const mcpFixturePath = resolve(
  import.meta.dirname,
  "../../../../../nextclaw-mcp/tests/fixtures/mock-mcp-server.mjs",
);

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-native-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("createUiNcpAgent default runtime", () => {
  it("uses DefaultNcpAgentRuntime with nextclaw context, skills, tools, and session metadata", async () => {
    const { workspace, providerManager, sessionManager, ncpAgent } = await createDemoSkillAgentFixture();

    const firstRunEvents = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "session-1",
        text: "please inspect the workspace",
        metadata: {
          requested_skills: ["demo-skill"],
          model: "override-model",
          thinking: "high",
        },
      }),
    );

    expectFirstRunBehavior(firstRunEvents, providerManager, workspace);
    expectPersistedSkillSession(sessionManager);

    providerManager.calls.length = 0;
    const secondRunEvents = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "session-1",
        text: "run again with saved settings",
      }),
    );
    expectSecondRunBehavior(secondRunEvents, providerManager);
  });

});

describe("createUiNcpAgent session types availability", () => {
  it("lists codex as an available session type when the runtime is enabled", async () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "openai/gpt-5.3-codex",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
      plugins: {
        load: {
          paths: ["../extensions/nextclaw-ncp-runtime-plugin-codex-sdk"],
        },
        entries: {
          "nextclaw-ncp-runtime-plugin-codex-sdk": {
            enabled: true,
            config: {
              apiKey: "test-codex-api-key",
            },
          },
        },
      },
    });
    const extensionRegistry = createCodexExtensionRegistryFromSource(config);

    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new RecordingProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
      getExtensionRegistry: () => extensionRegistry,
    });

    const sessionTypes = await ncpAgent.listSessionTypes?.();
    expect(sessionTypes?.defaultType).toBe("native");
    expect(sessionTypes?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "native", label: "Native", ready: true }),
        expect.objectContaining({ value: "codex", label: "Codex", ready: true }),
      ]),
    );
  });
});

describe("createUiNcpAgent session types supported models", () => {
  it("exposes codex supported models from configured providers", async () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "dashscope/qwen3-coder-next",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
      providers: {
        dashscope: {
          enabled: true,
          apiKey: "test-dashscope-key",
          apiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          models: ["qwen3-coder-next"],
        },
      },
      plugins: {
        load: {
          paths: ["../extensions/nextclaw-ncp-runtime-plugin-codex-sdk"],
        },
        entries: {
          "nextclaw-ncp-runtime-plugin-codex-sdk": {
            enabled: true,
            config: {},
          },
        },
      },
    });
    const extensionRegistry = createCodexExtensionRegistryFromSource(config);

    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new RecordingProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
      getExtensionRegistry: () => extensionRegistry,
    });

    const sessionTypes = await ncpAgent.listSessionTypes?.();
    expect(sessionTypes?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "codex",
          label: "Codex",
          ready: true,
          recommendedModel: "dashscope/qwen3-coder-next",
          supportedModels: expect.arrayContaining(["dashscope/qwen3-coder-next"]),
        }),
      ]),
    );
  });
});

describe("createUiNcpAgent session types refresh", () => {
  it("refreshes available session types when the extension registry changes after startup", async () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "openai/gpt-5.3-codex",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
      plugins: {
        entries: {},
      },
    });
    let extensionRegistry: NextclawExtensionRegistry = {
      tools: [],
      channels: [],
      engines: [],
      ncpAgentRuntimes: [],
      diagnostics: [],
    };

    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new RecordingProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
      getExtensionRegistry: () => extensionRegistry,
    });

    expect(await ncpAgent.listSessionTypes?.()).toEqual({
      defaultType: "native",
      options: [{ value: "native", label: "Native", ready: true, reason: null, reasonMessage: null, recommendedModel: null, cta: null }],
    });

    const enabledConfig = ConfigSchema.parse({
      ...config,
      plugins: {
        load: {
          paths: ["../extensions/nextclaw-ncp-runtime-plugin-codex-sdk"],
        },
        entries: {
          "nextclaw-ncp-runtime-plugin-codex-sdk": {
            enabled: true,
            config: {
              apiKey: "test-codex-api-key",
            },
          },
        },
      },
    });
    extensionRegistry = toExtensionRegistry(loadPluginRegistry(enabledConfig, workspace));

    const enabledSessionTypes = await ncpAgent.listSessionTypes?.();
    expect(enabledSessionTypes?.defaultType).toBe("native");
    expect(enabledSessionTypes?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "native", label: "Native", ready: true }),
        expect.objectContaining({ value: "codex", label: "Codex", ready: true }),
      ]),
    );

    ncpAgent.applyExtensionRegistry?.({
      tools: [],
      channels: [],
      engines: [],
      ncpAgentRuntimes: [],
      diagnostics: [],
    });

    expect(await ncpAgent.listSessionTypes?.()).toEqual({
      defaultType: "native",
      options: [{ value: "native", label: "Native", ready: true, reason: null, reasonMessage: null, recommendedModel: null, cta: null }],
    });
  });
});

describe("createUiNcpAgent codex native routing", () => {
  it("keeps codex sessions on the codex runtime for non-GPT OpenAI-compatible models", async () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "dashscope/qwen3-coder-next",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
      providers: {
        dashscope: {
          enabled: true,
          apiKey: "test-dashscope-key",
          apiBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          models: ["qwen3-coder-next"],
        },
      },
      plugins: {
        entries: {
          "fake-codex-runtime": {
            enabled: true,
            config: {},
          },
        },
      },
    });
    const extensionRegistry: NextclawExtensionRegistry = {
      tools: [],
      channels: [],
      engines: [],
      diagnostics: [],
      ncpAgentRuntimes: [
        {
          pluginId: "fake-codex-runtime",
          kind: "codex",
          label: "Codex",
          source: "test:fake-codex-runtime",
          createRuntime: () => ({
            async *run(input) {
              yield {
                type: NcpEventType.RunStarted,
                payload: {
                  sessionId: input.sessionId,
                  messageId: "codex-run-message",
                  runId: "codex-run-id",
                },
              };
              yield {
                type: NcpEventType.RunMetadata,
                payload: {
                  sessionId: input.sessionId,
                  messageId: "codex-run-message",
                  runId: "codex-run-id",
                  metadata: {
                    kind: "final",
                  },
                },
              };
              yield {
                type: NcpEventType.RunFinished,
                payload: {
                  sessionId: input.sessionId,
                  messageId: "codex-run-message",
                  runId: "codex-run-id",
                },
              };
            },
          }),
        },
      ],
    };
    const providerManager = new RecordingProviderManager();
    const sessionManager = new SessionManager(workspace);

    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: providerManager as unknown as ProviderManager,
      sessionManager,
      getConfig: () => config,
      getExtensionRegistry: () => extensionRegistry,
    });

    const runEvents = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "codex-native-fallback",
        text: "say hi",
        metadata: {
          session_type: "codex",
          preferred_model: "dashscope/qwen3-coder-next",
        },
      }),
    );

    expect(runEvents.at(-1)?.type).toBe(NcpEventType.RunFinished);
    expect(providerManager.calls).toHaveLength(0);

    const persistedSession = sessionManager.getIfExists("codex-native-fallback");
    expect(persistedSession?.metadata.session_type).toBe("codex");
    expect(persistedSession?.metadata.codex_runtime_backend).toBe("codex-sdk");
  });
});

describe("createUiNcpAgent MCP hot reload", () => {
  it("hot reloads MCP tools into the native runtime without restart", async () => {
    const workspace = createTempWorkspace();
    let config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "default-model",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
      mcp: {
        servers: {},
      },
    });
    const providerManager = new McpAwareProviderManager();
    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: providerManager as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
    });

    const nextConfig = ConfigSchema.parse({
      ...config,
      mcp: {
        servers: {
          demo: {
            enabled: true,
            transport: {
              type: "stdio",
              command: process.execPath,
              args: [mcpFixturePath, "stdio"],
              stderr: "pipe",
            },
          },
        },
      },
    });

    config = nextConfig;
    await ncpAgent.applyMcpConfig?.(nextConfig);

    const runEvents = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "session-mcp-hot-reload",
        text: "use the hot reloaded MCP tool",
      }),
    );

    expect(runEvents.map((event) => event.type)).toContain(NcpEventType.MessageToolCallStart);
    expect(runEvents.map((event) => event.type)).toContain(NcpEventType.MessageToolCallResult);
    expect(runEvents.at(-1)?.type).toBe(NcpEventType.RunFinished);
    expect(providerManager.calls[0]?.toolNames).toContain("mcp_demo__echo");
    expect(
      providerManager.calls[1]?.messages.some(
        (message) =>
          message.role === "tool" && String(message.content ?? "").includes("echo:ok"),
      ),
    ).toBe(true);
  });
});

async function createDemoSkillAgentFixture(): Promise<{
  workspace: string;
  providerManager: RecordingProviderManager;
  sessionManager: SessionManager;
  ncpAgent: Awaited<ReturnType<typeof createUiNcpAgent>>;
}> {
  const workspace = createTempWorkspace();
  writeFileSync(join(workspace, "AGENTS.md"), "Always answer carefully.\n");
  mkdirSync(join(workspace, "skills", "demo-skill"), { recursive: true });
  writeFileSync(
    join(workspace, "skills", "demo-skill", "SKILL.md"),
    [
      "---",
      "name: demo-skill",
      "description: Demo skill",
      "---",
      "",
      "Use the demo skill instructions.",
    ].join("\n"),
  );

  const config = ConfigSchema.parse({
    agents: {
      defaults: {
        workspace,
        model: "default-model",
        contextTokens: 200000,
        maxToolIterations: 8,
      },
    },
  });
  const providerManager = new RecordingProviderManager();
  const sessionManager = new SessionManager(workspace);
  const ncpAgent = await createUiNcpAgent({
    bus: new MessageBus(),
    providerManager: providerManager as unknown as ProviderManager,
    sessionManager,
    getConfig: () => config,
  });

  return {
    workspace,
    providerManager,
    sessionManager,
    ncpAgent,
  };
}

function expectFirstRunBehavior(
  firstRunEvents: NcpEndpointEvent[],
  providerManager: RecordingProviderManager,
  workspace: string,
): void {
  expect(firstRunEvents.map((event) => event.type)).toContain(NcpEventType.MessageToolCallStart);
  expect(firstRunEvents.map((event) => event.type)).toContain(NcpEventType.MessageToolCallResult);
  expect(firstRunEvents.at(-1)?.type).toBe(NcpEventType.RunFinished);

  expect(providerManager.calls).toHaveLength(2);
  const firstModelInput = providerManager.calls[0];
  expect(firstModelInput.model).toBe("override-model");
  expect(firstModelInput.thinkingLevel).toBe("high");
  expect(
    firstModelInput.tools?.some((tool) => {
      const fn = tool.function as { name?: string } | undefined;
      return fn?.name === "list_dir";
    }),
  ).toBe(true);

  const combinedPrompt = firstModelInput.messages.map((message) => String(message.content ?? "")).join("\n\n");
  expect(combinedPrompt).toContain("Only skill names and paths are included here.");
  expect(combinedPrompt).toContain("<name>demo-skill</name>");
  expect(combinedPrompt).toContain(`<location>${join(workspace, "skills", "demo-skill", "SKILL.md")}</location>`);
  expect(combinedPrompt).not.toContain("Use the demo skill instructions.");
}

function expectPersistedSkillSession(sessionManager: SessionManager): void {
  const persistedSession = sessionManager.getIfExists("session-1");
  expect(persistedSession?.messages.some((message) => message.role === "tool")).toBe(true);
  expect(
    persistedSession?.messages.some(
      (message) => message.role === "assistant" && String(message.content ?? "").includes("final answer"),
    ),
  ).toBe(true);
  expect(persistedSession?.metadata.preferred_model).toBe("override-model");
  expect(persistedSession?.metadata.preferred_thinking).toBe("high");
}

function expectSecondRunBehavior(
  secondRunEvents: NcpEndpointEvent[],
  providerManager: RecordingProviderManager,
): void {
  expect(secondRunEvents.at(-1)?.type).toBe(NcpEventType.RunFinished);
  expect(providerManager.calls[0]?.model).toBe("override-model");
  expect(providerManager.calls[0]?.thinkingLevel).toBe("high");
  expect(providerManager.calls).toHaveLength(2);
  expect(
    providerManager.calls[1]?.messages.some((message) => (
      message.role === "assistant" &&
      Array.isArray(message.tool_calls) &&
      message.reasoning_content === "need a tool first"
    )),
  ).toBe(true);
}

type RecordedCall = {
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  model?: string;
  thinkingLevel?: string | null;
};

class RecordingProviderManager {
  readonly calls: RecordedCall[] = [];

  get() {
    return {
      getDefaultModel: () => "default-model",
    };
  }

  async *chatStream(params: RecordedCall): AsyncGenerator<LLMStreamEvent> {
    this.calls.push({
      messages: structuredClone(params.messages),
      tools: structuredClone(params.tools),
      model: params.model,
      thinkingLevel: params.thinkingLevel ?? null,
    });

    const hasToolResult = params.messages.some((message) => message.role === "tool");
    if (!hasToolResult) {
      yield {
        type: "done",
        response: {
          content: "",
          reasoningContent: "need a tool first",
          toolCalls: [
            {
              id: "call-1",
              name: "list_dir",
              arguments: { path: "." },
            },
          ],
          finishReason: "tool_calls",
          usage: {},
        },
      };
      return;
    }

    yield {
      type: "done",
      response: {
        content: "final answer",
        toolCalls: [],
        finishReason: "stop",
        usage: {},
      },
    };
  }
}

class McpAwareProviderManager {
  readonly calls: Array<{ messages: Array<Record<string, unknown>>; toolNames: string[] }> = [];

  get() {
    return {
      getDefaultModel: () => "default-model",
    };
  }

  async *chatStream(params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
  }): AsyncGenerator<LLMStreamEvent> {
    const toolNames = (params.tools ?? [])
      .map((tool) => {
        const fn = tool.function as { name?: string } | undefined;
        return fn?.name ?? "";
      })
      .filter(Boolean);

    this.calls.push({
      messages: structuredClone(params.messages),
      toolNames,
    });

    const hasToolResult = params.messages.some((message) => message.role === "tool");
    if (!hasToolResult) {
      yield {
        type: "done",
        response: {
          content: "",
          toolCalls: [
            {
              id: "call-mcp-1",
              name: "mcp_demo__echo",
              arguments: {},
            },
          ],
          finishReason: "tool_calls",
          usage: {},
        },
      };
      return;
    }

    yield {
      type: "done",
      response: {
        content: "mcp hot reload worked",
        toolCalls: [],
        finishReason: "stop",
        usage: {},
      },
    };
  }
}

function createCodexExtensionRegistryFromSource(config: Config): NextclawExtensionRegistry {
  const ncpAgentRuntimes: NextclawExtensionRegistry["ncpAgentRuntimes"] = [];
  codexRuntimePlugin.register({
    config,
    pluginConfig:
      config.plugins.entries?.["nextclaw-ncp-runtime-plugin-codex-sdk"]?.config ?? {},
    registerNcpAgentRuntime(registration) {
      ncpAgentRuntimes.push({
        pluginId: "nextclaw-ncp-runtime-plugin-codex-sdk",
        kind: registration.kind,
        label: registration.label ?? "Codex",
        createRuntime: registration.createRuntime,
        describeSessionType: registration.describeSessionType,
        source: "test:codex-source",
      });
    },
  });

  return {
    tools: [],
    channels: [],
    engines: [],
    diagnostics: [],
    ncpAgentRuntimes,
  };
}

function createEnvelope(params: {
  sessionId: string;
  text: string;
  metadata?: Record<string, unknown>;
}): NcpRequestEnvelope {
  return {
    sessionId: params.sessionId,
    message: {
      id: `${params.sessionId}:user:${Date.now()}`,
      sessionId: params.sessionId,
      role: "user",
      status: "final",
      timestamp: new Date().toISOString(),
      parts: [{ type: "text", text: params.text }],
      ...(params.metadata ? { metadata: params.metadata } : {}),
    },
    ...(params.metadata ? { metadata: params.metadata } : {}),
  };
}

async function sendAndCollectEvents(
  endpoint: {
    send(envelope: NcpRequestEnvelope): Promise<void>;
    subscribe(listener: (event: NcpEndpointEvent) => void): () => void;
  },
  envelope: NcpRequestEnvelope,
): Promise<NcpEndpointEvent[]> {
  const events: NcpEndpointEvent[] = [];
  const unsubscribe = endpoint.subscribe((event) => {
    if (!("payload" in event)) {
      return;
    }
    const payload = event.payload;
    if (payload && "sessionId" in payload && payload.sessionId !== envelope.sessionId) {
      return;
    }
    events.push(event);
  });
  try {
    await endpoint.send(envelope);
    return events;
  } finally {
    unsubscribe();
  }
}
