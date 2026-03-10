import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigSchema, SessionManager, type Config, type AgentEngine } from "@nextclaw/core";
import { GatewayAgentRuntimePool } from "./agent-runtime-pool.js";

const tempWorkspaces: string[] = [];

function createWorkspace(): string {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-runtime-pool-command-test-"));
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

function createConfig(workspace: string): Config {
  return ConfigSchema.parse({
    agents: {
      defaults: {
        workspace,
        engine: "mock",
        model: "openai/gpt-5"
      }
    }
  });
}

function createRuntimePool(params: { workspace: string; engine: AgentEngine }) {
  const config = createConfig(params.workspace);
  const sessionManager = new SessionManager(params.workspace);
  const providerManager = {
    setConfig: () => {},
    get: () => ({
      getDefaultModel: () => "openai/gpt-5"
    })
  };
  const bus = {
    consumeInbound: vi.fn(async () => {
      throw new Error("not implemented in unit test");
    }),
    publishOutbound: vi.fn(async () => undefined)
  };

  const runtimePool = new GatewayAgentRuntimePool({
    bus: bus as never,
    providerManager: providerManager as never,
    sessionManager,
    config,
    restrictToWorkspace: true,
    execConfig: config.tools.exec,
    contextConfig: config.agents.context,
    extensionRegistry: {
      engines: [
        {
          extensionId: "test.mock",
          source: "workspace",
          kind: "mock",
          factory: () => params.engine
        }
      ],
      channels: [],
      tools: [],
      diagnostics: []
    }
  });

  return {
    runtimePool,
    sessionManager
  };
}

describe("GatewayAgentRuntimePool slash commands", () => {
  it("executes slash command before engine processDirect", async () => {
    const workspace = createWorkspace();
    const processDirect = vi.fn(async () => "engine-reply");
    const engine: AgentEngine = {
      kind: "mock",
      handleInbound: vi.fn(async () => null),
      processDirect,
      applyRuntimeConfig: vi.fn()
    };
    const { runtimePool } = createRuntimePool({ workspace, engine });

    const result = await runtimePool.processDirect({
      content: "/status",
      sessionKey: "agent:main:ui:direct:web-ui",
      channel: "ui",
      chatId: "web-ui"
    });

    expect(result).toContain("Session: agent:main:ui:direct:web-ui");
    expect(processDirect).not.toHaveBeenCalled();
  });

  it("falls back to engine processing for normal messages", async () => {
    const workspace = createWorkspace();
    const processDirect = vi.fn(async () => "engine-reply");
    const engine: AgentEngine = {
      kind: "mock",
      handleInbound: vi.fn(async () => null),
      processDirect,
      applyRuntimeConfig: vi.fn()
    };
    const { runtimePool } = createRuntimePool({ workspace, engine });

    const result = await runtimePool.processDirect({
      content: "hello",
      sessionKey: "agent:main:ui:direct:web-ui",
      channel: "ui",
      chatId: "web-ui"
    });

    expect(result).toBe("engine-reply");
    expect(processDirect).toHaveBeenCalledTimes(1);
  });

  it("marks non-native engine without supportsAbort as unsupported for stop", () => {
    const workspace = createWorkspace();
    const engine: AgentEngine = {
      kind: "mock",
      handleInbound: vi.fn(async () => null),
      processDirect: vi.fn(async () => "engine-reply"),
      applyRuntimeConfig: vi.fn()
    };
    const { runtimePool } = createRuntimePool({ workspace, engine });

    const capability = runtimePool.supportsTurnAbort({
      sessionKey: "agent:main:ui:direct:web-ui",
      channel: "ui",
      chatId: "web-ui"
    });

    expect(capability.supported).toBe(false);
    expect(capability.reason).toContain("does not support");
  });

  it("marks engine with supportsAbort=true as supported for stop", () => {
    const workspace = createWorkspace();
    const engine: AgentEngine = {
      kind: "mock",
      supportsAbort: true,
      handleInbound: vi.fn(async () => null),
      processDirect: vi.fn(async () => "engine-reply"),
      applyRuntimeConfig: vi.fn()
    };
    const { runtimePool } = createRuntimePool({ workspace, engine });

    const capability = runtimePool.supportsTurnAbort({
      sessionKey: "agent:main:ui:direct:web-ui",
      channel: "ui",
      chatId: "web-ui"
    });

    expect(capability.supported).toBe(true);
  });

  it("routes system messages back to session_key_override and emits session update hook", async () => {
    const workspace = createWorkspace();
    const handleInbound = vi.fn(async () => null);
    const engine: AgentEngine = {
      kind: "mock",
      handleInbound,
      processDirect: vi.fn(async () => "ok"),
      applyRuntimeConfig: vi.fn()
    };

    const config = createConfig(workspace);
    const sessionManager = new SessionManager(workspace);
    const providerManager = {
      setConfig: () => {},
      get: () => ({
        getDefaultModel: () => "openai/gpt-5"
      })
    };
    const inboundQueue: Array<Record<string, unknown> | null> = [
      {
        channel: "system",
        senderId: "subagent",
        chatId: "ui:web-ui",
        content: "subagent done",
        timestamp: new Date(),
        attachments: [],
        metadata: {
          session_key_override: "agent:main:ui:direct:web-ui",
          target_agent_id: "main"
        }
      },
      null
    ];
    const bus = {
      consumeInbound: vi.fn(async () => {
        const next = inboundQueue.shift();
        if (!next) {
          throw new Error("stop-loop");
        }
        return next;
      }),
      publishOutbound: vi.fn(async () => undefined)
    };

    const runtimePool = new GatewayAgentRuntimePool({
      bus: bus as never,
      providerManager: providerManager as never,
      sessionManager,
      config,
      restrictToWorkspace: true,
      execConfig: config.tools.exec,
      contextConfig: config.agents.context,
      extensionRegistry: {
        engines: [
          {
            extensionId: "test.mock",
            source: "workspace",
            kind: "mock",
            factory: () => engine
          }
        ],
        channels: [],
        tools: [],
        diagnostics: []
      }
    });
    const sessionUpdated = vi.fn();
    runtimePool.setSystemSessionUpdatedHandler(sessionUpdated);

    await expect(runtimePool.run()).rejects.toThrow("stop-loop");
    expect(handleInbound).toHaveBeenCalledWith({
      message: expect.objectContaining({
        channel: "system",
        chatId: "ui:web-ui"
      }),
      sessionKey: "agent:main:ui:direct:web-ui",
      publishResponse: true
    });
    expect(sessionUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:ui:direct:web-ui"
      })
    );
  });
});
