import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConfigSchema,
  MessageBus,
  SessionManager,
  type ProviderManager,
} from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent, type NcpRequestEnvelope } from "@nextclaw/ncp";
import { loadPluginRegistry, toExtensionRegistry } from "../plugins.js";
import { createUiNcpAgent } from "./create-ui-ncp-agent.js";

const tempDirs: string[] = [];

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-claude-"));
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

describe("createUiNcpAgent Claude session types", () => {
  it("lists claude as an available session type when the runtime plugin is enabled", async () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "anthropic/claude-sonnet-4-5",
          contextTokens: 200000,
          maxToolIterations: 8,
        },
      },
      plugins: {
        load: {
          paths: ["../extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk"],
        },
        entries: {
          "nextclaw-ncp-runtime-plugin-claude-code-sdk": {
            enabled: true,
            config: {
              apiKey: "test-claude-api-key",
              capabilityProbe: false,
            },
          },
        },
      },
    });
    const extensionRegistry = toExtensionRegistry(loadPluginRegistry(config, workspace));

    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new NoopProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
      getExtensionRegistry: () => extensionRegistry,
    });

    const sessionTypes = await ncpAgent.listSessionTypes?.();
    expect(sessionTypes?.defaultType).toBe("native");
    expect(sessionTypes?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "native", label: "Native", ready: true }),
        expect.objectContaining({
          value: "claude",
          label: "Claude",
          ready: true,
          recommendedModel: "anthropic/claude-sonnet-4-5",
        }),
      ]),
    );
  });

  it("falls back to a configured Claude-compatible provider when the default model is not Claude-compatible", async () => {
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
          apiKey: "dashscope-key",
          models: ["qwen3-coder-next"],
        },
        minimax: {
          apiKey: "minimax-key",
        },
      },
      plugins: {
        load: {
          paths: ["../extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk"],
        },
        entries: {
          "nextclaw-ncp-runtime-plugin-claude-code-sdk": {
            enabled: true,
            config: {
              capabilityProbe: false,
            },
          },
        },
      },
    });
    const extensionRegistry = toExtensionRegistry(loadPluginRegistry(config, workspace));

    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new NoopProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
      getExtensionRegistry: () => extensionRegistry,
    });

    const sessionTypes = await ncpAgent.listSessionTypes?.();
    expect(sessionTypes?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "claude",
          label: "Claude",
          ready: true,
          recommendedModel: "minimax/MiniMax-M2.7",
          supportedModels: expect.arrayContaining(["minimax/MiniMax-M2.7"]),
        }),
      ]),
    );
    expect(
      sessionTypes?.options.find((option) => option.value === "claude")?.supportedModels?.includes(
        "dashscope/qwen3-coder-next",
      ),
    ).toBe(false);
  });

  it("marks claude as setup required when no Claude-compatible provider is configured", async () => {
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
          apiKey: "dashscope-key",
          models: ["qwen3-coder-next"],
        },
      },
      plugins: {
        load: {
          paths: ["../extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk"],
        },
        entries: {
          "nextclaw-ncp-runtime-plugin-claude-code-sdk": {
            enabled: true,
            config: {
              capabilityProbe: false,
            },
          },
        },
      },
    });
    const extensionRegistry = toExtensionRegistry(loadPluginRegistry(config, workspace));

    const ncpAgent = await createUiNcpAgent({
      bus: new MessageBus(),
      providerManager: new NoopProviderManager() as unknown as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
      getExtensionRegistry: () => extensionRegistry,
    });

    const sessionTypes = await ncpAgent.listSessionTypes?.();
    expect(sessionTypes?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "claude",
          label: "Claude",
          ready: false,
          reason: "provider_unsupported",
        }),
      ]),
    );
  });
});

describe("createUiNcpAgent Claude runtime", () => {
  it("runs claude session messages through the configured Claude CLI entrypoint", async () => {
    const workspace = createTempWorkspace();
    const mockClaudePath = createMockClaudeScript(workspace);
    const { ncpAgent, sessionManager } = await createClaudeRuntimeFixture({
      workspace,
      pluginConfig: {
        pathToClaudeCodeExecutable: mockClaudePath,
      },
    });

    const runEvents = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "session-claude-runtime",
        text: "say hello from claude",
        metadata: {
          session_type: "claude",
        },
      }),
    );

    expect(runEvents.map((event) => event.type)).toContain(NcpEventType.MessageTextStart);
    expect(runEvents.map((event) => event.type)).toContain(NcpEventType.MessageTextDelta);
    expect(runEvents.map((event) => event.type)).toContain(NcpEventType.MessageTextEnd);
    expect(runEvents.at(-1)?.type).toBe(NcpEventType.RunFinished);
    expect(
      runEvents.some(
        (event) =>
          event.type === NcpEventType.MessageTextDelta &&
          "payload" in event &&
          String((event.payload as { delta?: unknown }).delta ?? "").includes("hello from fake claude"),
      ),
    ).toBe(true);

    const persistedSession = sessionManager.getIfExists("session-claude-runtime");
    expect(persistedSession?.metadata.session_type).toBe("claude");
    expect(persistedSession?.metadata.claude_session_id).toBe("claude-session-test");
    expect(
      persistedSession?.messages.some(
        (message) => message.role === "assistant" && String(message.content ?? "").includes("hello from fake claude"),
      ),
    ).toBe(true);
  });

  it("runs claude session messages even when PATH does not include a node executable", async () => {
    const workspace = createTempWorkspace();
    const mockClaudePath = createMockClaudeScript(workspace);
    const { ncpAgent, sessionManager } = await createClaudeRuntimeFixture({
      workspace,
      pluginConfig: {
        pathToClaudeCodeExecutable: mockClaudePath,
        env: {
          PATH: "",
        },
      },
    });

    const runEvents = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "session-claude-empty-path",
        text: "say hello from claude",
        metadata: {
          session_type: "claude",
        },
      }),
    );

    expect(runEvents.at(-1)?.type).toBe(NcpEventType.RunFinished);
    expect(
      runEvents.some(
        (event) =>
          event.type === NcpEventType.MessageTextDelta &&
          "payload" in event &&
          String((event.payload as { delta?: unknown }).delta ?? "").includes("hello from fake claude"),
      ),
    ).toBe(true);

    const persistedSession = sessionManager.getIfExists("session-claude-empty-path");
    expect(persistedSession?.metadata.claude_session_id).toBe("claude-session-test");
  });

  it("routes claude runtime through a configured MiniMax provider and Anthropic-compatible base URL", async () => {
    const workspace = createTempWorkspace();
    const mockClaudePath = createEnvEchoClaudeScript(workspace);
    const { ncpAgent } = await createClaudeRuntimeFixture({
      workspace,
      defaultModel: "dashscope/qwen3-coder-next",
      providers: {
        dashscope: {
          apiKey: "dashscope-key",
          models: ["qwen3-coder-next"],
        },
        minimax: {
          apiKey: "minimax-key",
        },
      },
      pluginConfig: {
        pathToClaudeCodeExecutable: mockClaudePath,
      },
    });

    const runEvents = await sendAndCollectEvents(
      ncpAgent.agentClientEndpoint,
      createEnvelope({
        sessionId: "session-claude-minimax-route",
        text: "say hello from claude",
        metadata: {
          session_type: "claude",
          preferred_model: "minimax/MiniMax-M2.7",
          model: "minimax/MiniMax-M2.7",
        },
      }),
    );

    const textPayload = runEvents
      .filter((event) => event.type === NcpEventType.MessageTextDelta)
      .map((event) => ("payload" in event ? String((event.payload as { delta?: unknown }).delta ?? "") : ""))
      .join("");
    expect(textPayload).toContain("model=MiniMax-M2.7");
    expect(textPayload).toContain("base=https://api.minimaxi.com/anthropic");
    expect(textPayload).toContain("auth=token");
  });

  it("isolates Claude runtime from the user's global Claude config directory", async () => {
    const workspace = createTempWorkspace();
    const nextclawHome = join(workspace, "nextclaw-home");
    const previousNextclawHome = process.env.NEXTCLAW_HOME;
    process.env.NEXTCLAW_HOME = nextclawHome;
    try {
      const mockClaudePath = createEnvEchoClaudeScript(workspace);
      const { ncpAgent } = await createClaudeRuntimeFixture({
        workspace,
        pluginConfig: {
          pathToClaudeCodeExecutable: mockClaudePath,
        },
      });

      const runEvents = await sendAndCollectEvents(
        ncpAgent.agentClientEndpoint,
        createEnvelope({
          sessionId: "session-claude-config-dir",
          text: "say hello from claude",
          metadata: {
            session_type: "claude",
          },
        }),
      );

      const textPayload = runEvents
        .filter((event) => event.type === NcpEventType.MessageTextDelta)
        .map((event) => ("payload" in event ? String((event.payload as { delta?: unknown }).delta ?? "") : ""))
        .join("");
      expect(textPayload).toContain(`configDir=${join(nextclawHome, "runtime", "claude-code")}`);
    } finally {
      if (previousNextclawHome === undefined) {
        delete process.env.NEXTCLAW_HOME;
      } else {
        process.env.NEXTCLAW_HOME = previousNextclawHome;
      }
    }
  });
});

class NoopProviderManager {
  get() {
    return {
      getDefaultModel: () => "default-model",
    };
  }
}

function createMockClaudeScript(workspace: string): string {
  const mockClaudePath = join(workspace, "mock-claude-code.mjs");
  writeFileSync(
    mockClaudePath,
    [
      "const sessionId = 'claude-session-test';",
      "const text = 'hello from fake claude';",
      "console.log(JSON.stringify({",
      "  type: 'assistant',",
      "  session_id: sessionId,",
      "  message: {",
      "    content: [{ type: 'text', text }],",
      "  },",
      "}));",
      "console.log(JSON.stringify({",
      "  type: 'result',",
      "  subtype: 'success',",
      "  session_id: sessionId,",
      "  result: text,",
      "}));",
    ].join("\n"),
  );
  return mockClaudePath;
}

function createEnvEchoClaudeScript(workspace: string): string {
  const mockClaudePath = join(workspace, "mock-claude-route.mjs");
  writeFileSync(
    mockClaudePath,
    [
      "const sessionId = 'claude-session-route';",
      "const model = process.env.ANTHROPIC_MODEL || 'missing-model';",
      "const base = process.env.ANTHROPIC_BASE_URL || 'missing-base';",
      "const auth = process.env.ANTHROPIC_AUTH_TOKEN ? 'token' : process.env.ANTHROPIC_API_KEY ? 'api-key' : 'missing';",
      "const configDir = process.env.CLAUDE_CONFIG_DIR || 'missing-config-dir';",
      "const text = `model=${model};base=${base};auth=${auth};configDir=${configDir}`;",
      "console.log(JSON.stringify({",
      "  type: 'assistant',",
      "  session_id: sessionId,",
      "  message: {",
      "    content: [{ type: 'text', text }],",
      "  },",
      "}));",
      "console.log(JSON.stringify({",
      "  type: 'result',",
      "  subtype: 'success',",
      "  session_id: sessionId,",
      "  result: text,",
      "}));",
    ].join("\n"),
  );
  return mockClaudePath;
}

async function createClaudeRuntimeFixture(params: {
  workspace: string;
  defaultModel?: string;
  providers?: Record<string, unknown>;
  pluginConfig?: Record<string, unknown>;
}): Promise<{
  ncpAgent: Awaited<ReturnType<typeof createUiNcpAgent>>;
  sessionManager: SessionManager;
}> {
  const config = ConfigSchema.parse({
    agents: {
      defaults: {
        workspace: params.workspace,
        model: params.defaultModel ?? "anthropic/claude-sonnet-4-5",
        contextTokens: 200000,
        maxToolIterations: 8,
      },
    },
    ...(params.providers ? { providers: params.providers } : {}),
    plugins: {
      load: {
        paths: ["../extensions/nextclaw-ncp-runtime-plugin-claude-code-sdk"],
      },
      entries: {
        "nextclaw-ncp-runtime-plugin-claude-code-sdk": {
          enabled: true,
          config: {
            apiKey: "test-claude-api-key",
            ...(params.pluginConfig ?? {}),
          },
        },
      },
    },
  });
  const extensionRegistry = toExtensionRegistry(loadPluginRegistry(config, params.workspace));
  const sessionManager = new SessionManager(params.workspace);
  const ncpAgent = await createUiNcpAgent({
    bus: new MessageBus(),
    providerManager: new NoopProviderManager() as unknown as ProviderManager,
    sessionManager,
    getConfig: () => config,
    getExtensionRegistry: () => extensionRegistry,
  });

  return {
    ncpAgent,
    sessionManager,
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
