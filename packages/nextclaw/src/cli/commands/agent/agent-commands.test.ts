import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EffectiveAgentProfile } from "@nextclaw/core";

const mocks = vi.hoisted(() => ({
  loadConfigMock: vi.fn(),
  resolveEffectiveAgentProfilesMock: vi.fn(),
  createAgentProfileMock: vi.fn(),
  updateAgentProfileMock: vi.fn(),
  removeAgentProfileMock: vi.fn()
}));

vi.mock("@nextclaw/core", () => ({
  BUILTIN_MAIN_AGENT_ID: "main",
  loadConfig: mocks.loadConfigMock,
  resolveEffectiveAgentProfiles: mocks.resolveEffectiveAgentProfilesMock,
  createAgentProfile: mocks.createAgentProfileMock,
  updateAgentProfile: mocks.updateAgentProfileMock,
  removeAgentProfile: mocks.removeAgentProfileMock
}));

import { AgentCommands } from "../agents.js";

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
      workspace: "~/.nextclaw/workspace-researcher"
    };
    mocks.updateAgentProfileMock.mockReturnValue(updated);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = new AgentCommands({
      requestRestart: vi.fn(async () => undefined),
      initializeAgentHomeDirectory: vi.fn(),
      appName: "nextclaw"
    });

    await commands.agentsUpdate("researcher", {
      name: "Researcher",
      description: "负责调研",
      avatar: "https://example.com/avatar.png",
      json: true
    });

    expect(mocks.updateAgentProfileMock).toHaveBeenCalledWith({
      id: "researcher",
      displayName: "Researcher",
      description: "负责调研",
      avatar: "https://example.com/avatar.png"
    });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({
      agent: updated,
      restartRequired: true
    }, null, 2));
  });

  it("requests restart after updating an agent in normal mode", async () => {
    mocks.updateAgentProfileMock.mockReturnValue({
      id: "main",
      default: true,
      displayName: "Main",
      description: "负责统筹",
      workspace: "~/.nextclaw/workspace"
    } satisfies EffectiveAgentProfile);
    const requestRestart = vi.fn(async () => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const commands = new AgentCommands({
      requestRestart,
      initializeAgentHomeDirectory: vi.fn(),
      appName: "nextclaw"
    });

    await commands.agentsUpdate("main", {
      description: "负责统筹"
    });

    expect(requestRestart).toHaveBeenCalledWith({
      reason: "agents-updated",
      manualMessage: "Updated agent 'main'. Restart nextclaw to apply agent runtime changes."
    });
    expect(logSpy).toHaveBeenCalledWith("✓ Updated agent main");
  });
});
