import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigSchema, saveConfig } from "@nextclaw/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NcpMessage, NcpTool } from "@nextclaw/ncp";
import { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import { AgentContextWindowManager } from "@kernel/managers/agent-context-window.manager.js";

const originalNextclawHome = process.env.NEXTCLAW_HOME;

afterEach(() => {
  if (originalNextclawHome === undefined) {
    delete process.env.NEXTCLAW_HOME;
  } else {
    process.env.NEXTCLAW_HOME = originalNextclawHome;
  }
});

function createManager(params: {
  context?: string;
  tools?: readonly NcpTool[];
} = {}): AgentContextWindowManager {
  return new AgentContextWindowManager(
    {
      listAgents: () => [
        { id: "main", contextTokens: undefined },
        { id: "researcher", contextTokens: undefined },
        { id: "coder", contextTokens: 64_000 },
      ],
      resolveAgentProfileForContextWindow: ({ agentId, contextTokens }) => ({
        id: agentId,
        contextTokens,
        model: "fake/model",
        reservedContextTokens: Math.floor(contextTokens * 0.2),
      }),
      resolveAgentProfileForRun: ({ agentId, storedAgentId }) => ({
        id: agentId ?? storedAgentId ?? "main",
        contextTokens: 20_000,
        model: "fake/model",
        reservedContextTokens: 4_000,
      }),
    } as never,
    {
      buildContext: vi.fn(async () => params.context ? [params.context] : []),
    } as never,
    {
      buildTools: vi.fn(async () => params.tools ?? []),
    } as never,
  );
}

function createSwitchedAgentContextWindowFixture(): {
  buildContext: ReturnType<typeof vi.fn>;
  manager: AgentContextWindowManager;
  message: NcpMessage;
} {
  const buildContext = vi.fn(async (request: { agentId?: string }) => [
    `${request.agentId} instructions `.repeat(request.agentId === "main" ? 1_000 : 100),
  ]);
  const manager = new AgentContextWindowManager(
    {
      resolveAgentProfileForRun: ({ agentId, storedAgentId }) =>
        (agentId ?? storedAgentId) === "main"
        ? {
            id: "main",
            contextTokens: 200_000,
            reservedContextTokens: 10_000,
          }
        : {
            id: "researcher",
            contextTokens: 35_000,
            reservedContextTokens: 7_000,
          },
    } as never,
    { buildContext } as never,
    { buildTools: vi.fn(async () => []) } as never,
  );
  return {
    buildContext,
    manager,
    message: {
      id: "message-main",
      sessionId: "session-switched-agent",
      role: "user",
      status: "final",
      parts: [{ type: "text", text: "hello" }],
      timestamp: "2026-08-08T00:00:00.000Z",
      metadata: {
        run_spec: { agentId: "main" },
      },
    },
  };
}

describe("AgentContextWindowManager", () => {
  it("uses the same cached fixed model input for runtime and session previews", async () => {
    const buildContext = vi.fn(async () => ["fixed instructions ".repeat(1_000)]);
    const buildTools = vi.fn(async () => [{
      name: "lookup",
      description: "lookup tool schema ".repeat(200),
      parameters: { type: "object", properties: {} },
    }]);
    const manager = new AgentContextWindowManager(
      {
        resolveAgentProfileForRun: () => ({
          id: "researcher",
          contextTokens: 20_000,
          reservedContextTokens: 4_000,
        }),
      } as never,
      { buildContext } as never,
      { buildTools } as never,
    );
    const message: NcpMessage = {
      id: "message-1",
      sessionId: "session-1",
      role: "user",
      status: "final",
      parts: [{ type: "text", text: "hello" }],
      timestamp: "2026-08-08T00:00:00.000Z",
      metadata: { agent_id: "researcher" },
    };

    await manager.resolveRunSurface({
      agentId: "researcher",
      message,
      metadata: message.metadata,
      sessionId: message.sessionId,
    });
    const preview = await manager.previewSession({
      requestMetadata: message.metadata ?? {},
      sessionId: message.sessionId,
      sessionMessages: [message],
      storedAgentId: "researcher",
      storedMetadata: {},
    });

    expect(preview?.usedContextTokens).toBeGreaterThan(2_000);
    expect(preview?.totalContextTokens).toBe(20_000);
    expect(buildContext).toHaveBeenCalledTimes(1);
    expect(buildTools).toHaveBeenCalledTimes(1);

    manager.forgetSession(message.sessionId);
    await manager.previewSession({
      requestMetadata: message.metadata ?? {},
      sessionId: message.sessionId,
      sessionMessages: [message],
      storedAgentId: "researcher",
      storedMetadata: {},
    });
    expect(buildContext).toHaveBeenCalledTimes(2);
    expect(buildTools).toHaveBeenCalledTimes(2);
  });

  it("keeps the preview bound to the session agent when a stale run surface used another agent", async () => {
    const { buildContext, manager, message } = createSwitchedAgentContextWindowFixture();

    await manager.resolveRunSurface({
      agentId: "main",
      message,
      metadata: message.metadata,
      sessionId: message.sessionId,
    });
    const cachedPreview = await manager.previewSession({
      requestMetadata: { agent_id: "researcher" },
      sessionId: message.sessionId,
      sessionMessages: [message],
      storedAgentId: "researcher",
      storedMetadata: {},
    });

    expect(cachedPreview).toMatchObject({
      totalContextTokens: 35_000,
      reservedContextTokens: 7_000,
      triggerContextTokens: 28_000,
    });

    manager.forgetSession(message.sessionId);
    const reconstructedPreview = await manager.previewSession({
      requestMetadata: { agent_id: "researcher" },
      sessionId: message.sessionId,
      sessionMessages: [message],
      storedAgentId: "researcher",
      storedMetadata: {},
    });

    expect(reconstructedPreview).toMatchObject({
      totalContextTokens: 35_000,
      reservedContextTokens: 7_000,
      triggerContextTokens: 28_000,
    });
    expect(buildContext).toHaveBeenLastCalledWith(expect.objectContaining({
      agentId: "researcher",
    }));
  });

  it("rejects values below the absolute schema floor without building runtime input", async () => {
    const manager = createManager();

    await expect(manager.assertCanSave({
      agentId: "researcher",
      contextTokens: 100,
    })).rejects.toThrow("at least 1000 tokens");
  });

  it("derives the minimum from the current instructions, full tool schemas, and output reserve", async () => {
    const manager = createManager({
      context: "research instructions ".repeat(500),
      tools: [{
        name: "research",
        description: "search and synthesize ".repeat(200),
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "source query ".repeat(200) },
          },
        },
      }],
    });

    await expect(manager.assertCanSave({
      agentId: "researcher",
      contextTokens: 3_000,
    })).rejects.toThrow(/needs at least \d+ context tokens/);

    const evaluation = await manager.assertCanSave({
      agentId: "researcher",
      contextTokens: 20_000,
    });
    expect(evaluation.minimumContextTokens).toBeGreaterThan(3_000);
    expect(evaluation.fixedInputTokens).toBeGreaterThan(3_000);
    expect(evaluation.reservedContextTokens).toBe(4_000);
  });

  it("validates only agents that inherit a changed default window", async () => {
    const manager = createManager();

    const evaluations = await manager.assertDefaultCanSave(4_000);

    expect(evaluations.map((entry) => entry.agentId)).toEqual(["main", "researcher"]);
  });

  it("rejects 3000 tokens against the real native context and full tool contribution chain", async () => {
    const homeDirectory = mkdtempSync(join(tmpdir(), "nextclaw-context-window-test-"));
    process.env.NEXTCLAW_HOME = homeDirectory;
    const configPath = join(homeDirectory, "config.json");
    saveConfig(ConfigSchema.parse({
      agents: {
        defaults: {
          contextTokens: 200_000,
          workspace: join(homeDirectory, "workspace"),
        },
        list: [{
          id: "researcher",
          contextTokens: 35_000,
          workspace: join(homeDirectory, "workspace", "agents", "researcher"),
        }],
      },
    }), configPath);
    const kernel = new NextclawKernel({ configPath, homeDir: homeDirectory });

    try {
      await kernel.start();
      await expect(kernel.agentContextWindowManager.assertCanSave({
        agentId: "researcher",
        contextTokens: 3_000,
      })).rejects.toThrow(/needs at least \d+ context tokens/);
      const evaluation = await kernel.agentContextWindowManager.assertCanSave({
        agentId: "researcher",
        contextTokens: 200_000,
      });
      expect(evaluation.minimumContextTokens).toBeGreaterThan(3_000);
      expect(evaluation.fixedInputTokens).toBeGreaterThan(3_000);

      const switchedSessionId = "session-created-as-researcher";
      await kernel.sessionManager.createAgentRunSession({
        agentId: "researcher",
        sessionId: switchedSessionId,
        task: "context window preview",
      });
      const switchedAgentMessage: NcpMessage = {
        id: "message-switched-to-main",
        sessionId: switchedSessionId,
        role: "user",
        status: "final",
        parts: [{ type: "text", text: "hello" }],
        timestamp: "2026-08-08T00:00:00.000Z",
        metadata: {
          run_spec: { agentId: "main" },
        },
      };
      const switchedAgentPreview = await kernel.agentContextWindowManager.previewSession({
        requestMetadata: { agent_id: "researcher" },
        sessionId: switchedAgentMessage.sessionId,
        sessionMessages: [switchedAgentMessage],
        storedAgentId: "researcher",
        storedMetadata: {},
      });
      expect(switchedAgentPreview).toMatchObject({
        completeInputBudget: true,
        totalContextTokens: 35_000,
        reservedContextTokens: 7_000,
        triggerContextTokens: 28_000,
      });
      expect(switchedAgentPreview?.fixedInputTokens).toBeGreaterThan(0);
      expect(switchedAgentPreview?.fixedInputTokens).toBeLessThan(28_000);
    } finally {
      await kernel.dispose();
      rmSync(homeDirectory, { recursive: true, force: true });
    }
  }, 30_000);
});
