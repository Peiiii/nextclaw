import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  ConfigSchema,
  MessageBus,
  SessionManager,
  type ProviderManager,
} from "@nextclaw/core";
import { NextclawNcpToolRegistry } from "../nextclaw-ncp-tool-registry.js";
import { NextclawAgentSessionStore } from "../nextclaw-agent-session-store.js";
import { SessionCreationService } from "../session-request/session-creation.service.js";
import type { SessionRequestBroker } from "../session-request/session-request-broker.service.js";
import { SessionSearchFeatureService } from "../session-search/session-search-feature.service.js";

const tempDirs: string[] = [];
const activeFeatures: SessionSearchFeatureService[] = [];
const originalNextclawHome = process.env.NEXTCLAW_HOME;

function createTempWorkspace(): { workspace: string; home: string } {
  const workspace = mkdtempSync(join(tmpdir(), "nextclaw-ncp-session-search-registry-"));
  const home = join(workspace, "home");
  mkdirSync(home, { recursive: true });
  process.env.NEXTCLAW_HOME = home;
  tempDirs.push(workspace);
  return { workspace, home };
}

afterEach(async () => {
  while (activeFeatures.length > 0) {
    const feature = activeFeatures.pop();
    if (feature) {
      await feature.dispose();
    }
  }
  if (originalNextclawHome) {
    process.env.NEXTCLAW_HOME = originalNextclawHome;
  } else {
    delete process.env.NEXTCLAW_HOME;
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("NextclawNcpToolRegistry session_search integration", () => {
  it("exposes session_search as an additional tool and executes it through the registry", async () => {
    const { workspace, home } = createTempWorkspace();
    const config = ConfigSchema.parse({
      agents: {
        defaults: {
          workspace,
          model: "default-model",
        },
      },
    });
    const sessionManager = new SessionManager(workspace);
    const sessionStore = new NextclawAgentSessionStore(sessionManager);
    await sessionStore.saveSession({
      sessionId: "history-session",
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: "user-1",
          sessionId: "history-session",
          role: "user",
          status: "final",
          timestamp: new Date().toISOString(),
          parts: [{ type: "text", text: "release checklist" }],
        },
      ],
      metadata: {
        label: "Release History",
      },
    });

    const feature = new SessionSearchFeatureService({
      sessionStore,
      databasePath: join(home, "session-search.db"),
    });
    activeFeatures.push(feature);
    await feature.initialize();

    const toolRegistry = new NextclawNcpToolRegistry({
      bus: new MessageBus(),
      providerManager: {} as ProviderManager,
      sessionManager,
      getConfig: () => config,
      sessionCreationService: new SessionCreationService(sessionManager, () => config),
      sessionRequestBroker: {} as SessionRequestBroker,
      getAdditionalTools: (context) => [
        feature.createTool({
          currentSessionId: context.sessionId,
        }),
      ],
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
      sessionId: "current-session",
      workspace,
    });

    expect(toolRegistry.getTool("session_search")).toBeDefined();

    const result = await toolRegistry.execute("call-1", "session_search", {
      query: "release",
    }) as {
      totalHits: number;
      hits: Array<{ sessionId: string; label: string }>;
    };

    expect(result.totalHits).toBe(1);
    expect(result.hits[0]).toMatchObject({
      sessionId: "history-session",
      label: "Release History",
    });
  });
});
