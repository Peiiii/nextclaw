import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EffectiveAgentProfile } from "@nextclaw/core";
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
    const commands = new AgentCommands(agentManager);

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
    const commands = new AgentCommands(agentManager);

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
    const commands = new AgentCommands(agentManager);

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
    const commands = new AgentCommands(createAgentManager());

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
    const commands = new AgentCommands(agentManager);

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
    const commands = new AgentCommands(agentManager);

    await commands.remove("researcher", { json: true });

    expect(agentManager.removeAgent).toHaveBeenCalledWith("researcher");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({
      removed: true,
      agentId: "researcher",
    }, null, 2));
  });
});
