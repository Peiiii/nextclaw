import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ConfigSchema } from "@nextclaw/core";
import { EventBus } from "@nextclaw/shared";
import { ToolProviderRunContextService } from "@kernel/contributions/tool-provider/services/tool-provider-run-context.service.js";
import { SessionManager } from "@kernel/managers/session.manager.js";
import { ProjectManager } from "@kernel/features/projects/index.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { SessionToolProvider } from "@kernel/contributions/tool-provider/providers/session-tool.provider.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function createRequest(sessionId: string) {
  return {
    sessionId,
    message: {
      id: `${sessionId}:message`,
      sessionId,
      role: "user",
      status: "final",
      parts: [{ type: "text", text: "continue" }],
      timestamp: "2026-08-25T00:00:00.000Z",
    },
  };
}

async function createPersistedFixture() {
  const homeDir = mkdtempSync(join(tmpdir(), "nextclaw-session-tool-provider-"));
  tempDirs.push(homeDir);
  const workspace = join(homeDir, "workspace");
  const journalStore = new NcpAgentSessionJournalStore(
    join(homeDir, ".ncp-agent-journal"),
  );
  const sessionManager = new SessionManager({
    agentContextWindowManager: {
      forgetSession: () => undefined,
      previewSession: async () => null,
    } as never,
    agentManager: {
      resolveAgentProfile: () => ({ workspace }),
    } as never,
    configManager: { loadConfig: () => ({}) } as never,
    eventBus: new EventBus(),
    journalStore,
    projectManager: new ProjectManager({
      databasePath: join(homeDir, "projects.db"),
      legacyStorePath: join(homeDir, "projects.json"),
      getDefaultWorkspacePath: () => workspace,
    }),
    sessionSearch: { handleSessionUpdated: () => undefined } as never,
  });
  await sessionManager.createSession({
    sessionId: "root-session",
    sourceSessionMetadata: {},
    task: "root",
  });
  await sessionManager.createSession({
    sessionId: "child-session",
    sourceSessionId: "root-session",
    sourceSessionMetadata: {},
    parentSessionId: "root-session",
    task: "child",
  });
  const config = ConfigSchema.parse({});
  const runContextService = new ToolProviderRunContextService(
    sessionManager,
    {
      resolveAgentProfileForRun: () => ({
        id: "main",
        workspace,
        model: "minimax/MiniMax-M3",
        contextTokens: 200_000,
        reservedContextTokens: 0,
      }),
    } as never,
    { loadConfig: () => config } as never,
  );
  return new SessionToolProvider(
    runContextService,
    sessionManager,
    {} as never,
    { isReady: () => false } as never,
  );
}

function createProvider(
  sessionMetadata: Record<string, unknown>,
  requestMetadata: Record<string, unknown> = sessionMetadata,
) {
  const runContextService = {
    resolve: async () => ({
      session: {
        metadata: structuredClone(sessionMetadata),
      },
      toolRunContext: {
        handoffDepth: 0,
        metadata: structuredClone(requestMetadata),
        sessionId: "current-session",
      },
    }),
  } as ToolProviderRunContextService;
  return new SessionToolProvider(
    runContextService,
    {} as never,
    {} as never,
    { isReady: () => false } as never,
  );
}

describe("SessionToolProvider child delegation policy", () => {
  it("provides session creation only to top-level sessions", async () => {
    const rootTools = await createProvider({}).provide(createRequest("current-session") as never);
    const childTools = await createProvider({
      parent_session_id: "parent-session",
    }).provide(createRequest("current-session") as never);

    expect(rootTools.map((tool) => tool.name)).toContain("sessions_spawn");
    expect(childTools.map((tool) => tool.name)).not.toContain("sessions_spawn");
    expect(childTools.map((tool) => tool.name)).toEqual([
      "sessions_request",
      "sessions_list",
      "sessions_history",
      "sessions_update",
    ]);
  });

  it("uses canonical session lineage instead of request metadata", async () => {
    const rootTools = await createProvider({}, {
      parent_session_id: "forged-parent",
    }).provide(createRequest("current-session") as never);
    const childTools = await createProvider({
      parent_session_id: "canonical-parent",
    }, {}).provide(createRequest("current-session") as never);

    expect(rootTools.map((tool) => tool.name)).toContain("sessions_spawn");
    expect(childTools.map((tool) => tool.name)).not.toContain("sessions_spawn");
  });

  it("filters spawn after resolving a persisted child session", async () => {
    const config = ConfigSchema.parse({});
    const runContextService = new ToolProviderRunContextService(
      {
        getAgentRunSession: async () => ({
          sessionId: "persisted-child",
          agentId: "main",
          metadata: { parent_session_id: "persisted-parent" },
          model: "minimax/MiniMax-M3",
          projectRoot: undefined,
          thinkingEffort: null,
        }),
      } as never,
      {
        resolveAgentProfileForRun: () => ({
          id: "main",
          workspace: "/tmp/nextclaw-workspace",
          model: "minimax/MiniMax-M3",
          contextTokens: 200_000,
          reservedContextTokens: 0,
        }),
      } as never,
      { loadConfig: () => config } as never,
    );
    const provider = new SessionToolProvider(
      runContextService,
      {} as never,
      {} as never,
      { isReady: () => false } as never,
    );

    const tools = await provider.provide({
      sessionId: "persisted-child",
      message: {
        id: "child-message",
        sessionId: "persisted-child",
        role: "user",
        status: "final",
        parts: [{ type: "text", text: "continue" }],
        timestamp: "2026-08-25T00:00:00.000Z",
        metadata: { parent_session_id: "" },
      },
    } as never);

    expect(tools.map((tool) => tool.name)).not.toContain("sessions_spawn");
  });

  it("projects spawn only for the persisted top-level session", async () => {
    const provider = await createPersistedFixture();

    const rootTools = await provider.provide(createRequest("root-session") as never);
    const childTools = await provider.provide(createRequest("child-session") as never);

    expect(rootTools.map((tool) => tool.name)).toContain("sessions_spawn");
    expect(childTools.map((tool) => tool.name)).not.toContain("sessions_spawn");
  });
});
