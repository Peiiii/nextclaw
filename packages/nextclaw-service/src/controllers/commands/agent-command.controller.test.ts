import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, type Config, type EffectiveAgentProfile } from "@nextclaw/core";
import type { AgentManager } from "@nextclaw/kernel";

const mocks = vi.hoisted(() => ({
  listAvailableAgentRuntimesMock: vi.fn()
}));

vi.mock("@nextclaw-service/utils/agent-runtime.utils.js", () => ({
  listAvailableAgentRuntimes: mocks.listAvailableAgentRuntimesMock
}));

import { AgentCommands } from "@nextclaw-service/services/agent/agent-commands.service.js";

function createAgentManager(overrides: Partial<AgentManager> = {}): AgentManager {
  return {
    listAgents: vi.fn(() => []),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    removeAgent: vi.fn(),
    ...overrides,
  } as unknown as AgentManager;
}

function createAgentCommands(
  agentManager = createAgentManager(),
  params: {
    config?: Config;
    set?: (
      pathExpr: string,
      value: string,
    ) => Promise<void>;
  } = {},
): AgentCommands {
  return new AgentCommands(agentManager, {
    load: () => params.config ?? ConfigSchema.parse({}),
    set: params.set ?? (async () => undefined),
  });
}

describe("AgentCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates an agent through the dedicated core command and returns json output", async () => {
    const updated: EffectiveAgentProfile = {
      id: "researcher",
      default: false,
      displayName: "Researcher",
      description: "负责调研",
      avatar: "https://example.com/avatar.png",
      workspace: "~/.nextclaw/workspace-researcher",
      runtime: "codex",
      engine: "codex"
    };
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const agentManager = createAgentManager({
      updateAgent: vi.fn().mockResolvedValue(updated),
    });
    const commands = createAgentCommands(agentManager);

    await commands.update("researcher", {
      name: "Researcher",
      description: "负责调研",
      avatar: "https://example.com/avatar.png",
      runtime: "codex",
      json: true
    });

    expect(agentManager.updateAgent).toHaveBeenCalledWith({
      id: "researcher",
      displayName: "Researcher",
      description: "负责调研",
      avatar: "https://example.com/avatar.png",
      runtime: "codex"
    });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ agent: updated }, null, 2));
  });

  it("updates an agent in normal mode without requesting restart", async () => {
    const updated = {
      id: "main",
      default: true,
      displayName: "Main",
      description: "负责统筹",
      workspace: "~/.nextclaw/workspace",
      runtime: "native",
      engine: "native"
    } satisfies EffectiveAgentProfile;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const agentManager = createAgentManager({
      updateAgent: vi.fn().mockResolvedValue(updated),
    });
    const commands = createAgentCommands(agentManager);

    await commands.update("main", {
      description: "负责统筹"
    });

    expect(logSpy).toHaveBeenCalledWith("✓ Updated agent main");
  });

  it("creates an agent with the runtime option", async () => {
    const created = {
      id: "engineer",
      default: false,
      displayName: "Engineer",
      description: "负责实现",
      workspace: "~/.nextclaw/workspace-engineer",
      runtime: "codex",
      engine: "codex"
    } satisfies EffectiveAgentProfile;
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const agentManager = createAgentManager({
      createAgent: vi.fn().mockResolvedValue(created),
    });
    const commands = createAgentCommands(agentManager);

    await commands.create("engineer", {
      runtime: "codex",
      json: true
    });

    expect(agentManager.createAgent).toHaveBeenCalledWith({
      id: "engineer",
      displayName: undefined,
      description: undefined,
      avatar: undefined,
      home: undefined,
      runtime: "codex"
    });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({
      agent: {
        id: "engineer",
        default: false,
        displayName: "Engineer",
        description: "负责实现",
        workspace: "~/.nextclaw/workspace-engineer",
        runtime: "codex",
        engine: "codex"
      }
    }, null, 2));
  });

  it("lists available runtimes in json mode", async () => {
    mocks.listAvailableAgentRuntimesMock.mockResolvedValue({
      defaultRuntime: "native",
      runtimes: [
        {
          value: "native",
          label: "Native",
          default: true,
          source: "builtin",
          ready: true,
          reason: null,
          reasonMessage: null,
          recommendedModel: null,
        },
        {
          value: "codex",
          label: "Codex",
          default: false,
          source: "builtin",
          ready: true,
          reason: null,
          reasonMessage: null,
          recommendedModel: "gpt-5.4",
          supportedModels: ["gpt-5.4", "gpt-5.3"],
        },
      ],
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = createAgentCommands();

    await commands.runtimes({
      json: true,
      probe: true,
    });

    expect(mocks.listAvailableAgentRuntimesMock).toHaveBeenCalledWith({
      describeMode: "probe",
    });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({
      defaultRuntime: "native",
      describeMode: "probe",
      runtimes: [
        {
          value: "native",
          label: "Native",
          default: true,
          source: "builtin",
          ready: true,
          reason: null,
          reasonMessage: null,
          recommendedModel: null,
        },
        {
          value: "codex",
          label: "Codex",
          default: false,
          source: "builtin",
          ready: true,
          reason: null,
          reasonMessage: null,
          recommendedModel: "gpt-5.4",
          supportedModels: ["gpt-5.4", "gpt-5.3"],
        },
      ],
    }, null, 2));
  });
});

describe("AgentCommands runtime configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows default-on NextClaw context injection for a configured runtime", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = createAgentCommands(createAgentManager(), {
      config: ConfigSchema.parse({
        agents: {
          runtimes: {
            entries: {
              codex: {
                type: "narp-stdio",
                config: {
                  command: "nextclaw-codex-narp",
                },
              },
            },
          },
        },
      }),
    });

    await commands.runtimeConfig("CODEX", { json: true });

    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({
      runtimeId: "codex",
      type: "narp-stdio",
      injectNextclawContext: true,
    }, null, 2));
  });

  it("updates one runtime context injection switch through the config owner", async () => {
    const set = vi.fn(async () => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = createAgentCommands(createAgentManager(), {
      config: ConfigSchema.parse({
        agents: {
          runtimes: {
            entries: {
              "claude-code": {
                type: "narp-stdio",
                config: {
                  command: "nextclaw-claude-code-narp",
                },
              },
            },
          },
        },
      }),
      set,
    });

    await commands.runtimeConfig("claude-code", {
      injectNextclawContext: false,
      json: true,
    });

    expect(set).toHaveBeenCalledWith(
      "agents.runtimes.entries.claude-code.config.injectNextclawContext",
      "false",
      {
        silentRestartNotice: true,
      },
    );
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({
      runtimeId: "claude-code",
      type: "narp-stdio",
      injectNextclawContext: false,
    }, null, 2));
  });

  it("uses the native runtime config path for the built-in runtime", async () => {
    const set = vi.fn(async () => undefined);
    const commands = createAgentCommands(createAgentManager(), { set });

    await commands.runtimeConfig("native", {
      injectNextclawContext: false,
    });

    expect(set).toHaveBeenCalledWith(
      "ui.ncp.runtimes.native.injectNextclawContext",
      "false",
      {
        silentRestartNotice: false,
      },
    );
  });

  it("rejects unknown runtime ids before writing config", async () => {
    const set = vi.fn(async () => undefined);
    const commands = createAgentCommands(createAgentManager(), { set });

    await expect(
      commands.runtimeConfig("missing-runtime", {
        injectNextclawContext: false,
      }),
    ).rejects.toThrow("agent runtime 'missing-runtime' not found");
    expect(set).not.toHaveBeenCalled();
  });
});

describe("AgentCommands listing and removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists agents from AgentManager", () => {
    const agents = [
      {
        id: "main",
        default: true,
        displayName: "Main",
        description: "负责统筹",
        workspace: "~/.nextclaw/workspace",
        runtime: "native",
        engine: "native",
        builtIn: true,
      },
    ] satisfies EffectiveAgentProfile[];
    const agentManager = createAgentManager({
      listAgents: vi.fn(() => agents),
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = createAgentCommands(agentManager);

    commands.list({ json: true });

    expect(agentManager.listAgents).toHaveBeenCalledWith();
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify([
      {
        id: "main",
        displayName: "Main",
        description: "负责统筹",
        avatar: null,
        workspace: "~/.nextclaw/workspace",
        runtime: "native",
        builtIn: true,
      },
    ], null, 2));
  });

  it("removes agents through AgentManager", async () => {
    const agentManager = createAgentManager({
      removeAgent: vi.fn().mockResolvedValue(true),
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = createAgentCommands(agentManager);

    await commands.remove("researcher", { json: true });

    expect(agentManager.removeAgent).toHaveBeenCalledWith("researcher");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({
      removed: true,
      agentId: "researcher",
    }, null, 2));
  });
});
