import { mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConfigSchema,
  MessageBus,
  SessionManager,
  type ProviderManager,
} from "@nextclaw/core";
import { McpRegistryService, McpServerLifecycleManager } from "@nextclaw/mcp";
import { McpNcpToolRegistryAdapter } from "@nextclaw/ncp-mcp";
import { NextclawNcpToolRegistry } from "./nextclaw-ncp-tool-registry.js";
import { SessionCreationService } from "./session-request/session-creation.service.js";
import type { SessionRequestBroker } from "./session-request/session-request-broker.js";

const fixturePath = resolve(
  import.meta.dirname,
  "../../../../../nextclaw-mcp/tests/fixtures/mock-mcp-server.mjs",
);

const tempDirs: string[] = [];

function createTempWorkspace(): string {
  const dir = mkdtempSync(resolve(tmpdir(), `nextclaw-mcp-native-${Date.now()}-`));
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

describe("NextclawNcpToolRegistry MCP integration", () => {
  it("exposes cached MCP tools as supplemental NCP tools", async () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "default-model",
        },
      },
      mcp: {
        servers: {
          demo: {
            enabled: true,
            transport: {
              type: "stdio",
              command: process.execPath,
              args: [fixturePath, "stdio"],
              stderr: "pipe",
            },
          },
        },
      },
    });
    const lifecycleManager = new McpServerLifecycleManager({
      getConfig: () => config,
    });
    const registryService = new McpRegistryService({
      getConfig: () => config,
      lifecycleManager,
    });
    const warmResults = await registryService.prewarmEnabledServers();
    expect(warmResults[0]?.ok).toBe(true);

    const adapter = new McpNcpToolRegistryAdapter(registryService);
    const toolRegistry = new NextclawNcpToolRegistry({
      bus: new MessageBus(),
      providerManager: {} as ProviderManager,
      sessionManager: new SessionManager(workspace),
      getConfig: () => config,
      sessionCreationService: {} as SessionCreationService,
      sessionRequestBroker: {} as SessionRequestBroker,
      getAdditionalTools: (context) =>
        adapter.listToolsForRun({
          agentId: context.agentId,
        }),
    });

    toolRegistry.prepareForRun({
      agentId: "main",
      channel: "cli",
      chatId: "default",
      config,
      contextTokens: 200000,
      execTimeoutSeconds: 60,
      handoffDepth: 0,
      metadata: {},
      model: "default-model",
      restrictToWorkspace: false,
      searchConfig: config.search,
      sessionId: "cli:default",
      workspace,
    });

    const mcpTool = toolRegistry.listTools().find((tool) => tool.name === "mcp_demo__echo");
    expect(mcpTool).toBeDefined();

    const result = await toolRegistry.execute("call-1", "mcp_demo__echo", {});
    expect(result).toMatchObject({
      content: [
        {
          text: "echo:ok",
        },
      ],
    });

    await registryService.close();
  });

  it("creates a regular session for sessions_spawn instead of a child session", async () => {
    const workspace = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "default-model",
        },
      },
    });
    const sessionManager = new SessionManager(workspace);
    const sessionCreationService = new SessionCreationService(sessionManager);
    const toolRegistry = new NextclawNcpToolRegistry({
      bus: new MessageBus(),
      providerManager: {} as ProviderManager,
      sessionManager,
      getConfig: () => config,
      sessionCreationService,
      sessionRequestBroker: {} as SessionRequestBroker,
    });

    toolRegistry.prepareForRun({
      agentId: "main",
      channel: "cli",
      chatId: "default",
      config,
      contextTokens: 200000,
      execTimeoutSeconds: 60,
      handoffDepth: 0,
      metadata: {
        session_type: "native",
        preferred_model: "default-model",
      },
      model: "default-model",
      restrictToWorkspace: false,
      searchConfig: config.search,
      sessionId: "source-session-1",
      workspace,
    });

    const result = await toolRegistry.execute("call-spawn", "sessions_spawn", {
      task: "Review the deployment status",
    });

    expect(result).toMatchObject({
      kind: "nextclaw.session",
      isChildSession: false,
      title: "Review the deployment status",
      sessionType: "native",
      lifecycle: "persistent",
    });
    expect(result).not.toHaveProperty("parentSessionId");
    const sessionId =
      result && typeof result === "object" && "sessionId" in result && typeof result.sessionId === "string"
        ? result.sessionId
        : null;
    expect(sessionId).toBeTruthy();
    const createdSession = sessionId ? sessionManager.getIfExists(sessionId) : null;
    expect(createdSession).toBeTruthy();
    expect(createdSession?.metadata?.parent_session_id).toBeUndefined();
    expect(createdSession?.metadata?.child_session_promoted).toBeUndefined();
    expect(createdSession?.metadata?.label).toBe("Review the deployment status");
  });
});
