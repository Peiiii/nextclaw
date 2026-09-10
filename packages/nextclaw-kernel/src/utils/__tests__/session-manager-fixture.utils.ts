import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";
import type { NcpMessage } from "@nextclaw/ncp";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { EventBus } from "@nextclaw/shared";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { SessionManager } from "@kernel/managers/session.manager.js";
import { ProjectManager } from "@kernel/features/projects/index.js";
import type { LlmProviderRuntime } from "@kernel/managers/llm-provider.manager.js";

const tempDirs: string[] = [];

export function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-ncp-session-manager-"));
  tempDirs.push(dir);
  return dir;
}

export function createConfig(workspace = createTempDir()) {
  return {
    agents: {
      defaults: {
        workspace,
        model: "",
        engine: "native",
        engineConfig: {},
        thinkingDefault: "off",
        models: {},
        contextTokens: 200000,
      },
      list: [],
    },
  } as never;
}

export function createMessage(params: {
  id: string;
  sessionId: string;
  text: string;
  timestamp?: string;
  role?: NcpMessage["role"];
}): NcpMessage {
  const {
    id,
    role = "user",
    sessionId,
    text,
    timestamp = "2026-05-12T00:00:00.000Z",
  } = params;
  return {
    id,
    sessionId,
    role,
    status: "final",
    parts: [{ type: "text", text }],
    timestamp,
  };
}

export function createRecord(params: {
  sessionId: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
  messages?: NcpMessage[];
  createdAt?: string;
  updatedAt?: string;
}): AgentSessionRecord {
  const {
    agentId,
    createdAt = "2026-05-12T00:00:00.000Z",
    messages = [],
    metadata = {},
    sessionId,
    updatedAt = createdAt,
  } = params;
  return {
    sessionId,
    ...(agentId ? { agentId } : {}),
    messages: messages.map((message) => structuredClone(message)),
    createdAt,
    updatedAt,
    metadata: structuredClone(metadata),
  };
}

export async function createFixture(
  records: AgentSessionRecord[] = [],
  config: unknown = createConfig(),
  providerManager?: LlmProviderRuntime,
) {
  const eventBus = new EventBus();
  const sessionsDir = createTempDir();
  const journalStore = new NcpAgentSessionJournalStore(join(sessionsDir, ".ncp-agent-journal"));
  const handleSessionUpdated = vi.fn();
  const sessionSearch = {
    handleSessionUpdated,
  };
  for (const record of records) {
    await journalStore.importSessionSnapshot(record);
  }
  const manager = new SessionManager({
    providerManager,
    agentContextWindowManager: {
      forgetSession: () => undefined,
      previewSession: async () => null,
    } as never,
    agentManager: {
      resolveAgentProfile: () => ({
        workspace: (config as { agents: { defaults: { workspace: string } } }).agents.defaults.workspace,
      }),
    } as never,
    configManager: { loadConfig: () => config } as never,
    eventBus,
    journalStore,
    projectManager: new ProjectManager({
      databasePath: join(sessionsDir, "projects.db"),
      legacyStorePath: join(sessionsDir, "projects.json"),
      getDefaultWorkspacePath: () =>
        (config as { agents: { defaults: { workspace: string } } }).agents.defaults.workspace,
    }),
    sessionSearch: sessionSearch as never,
  });
  return {
    sessionsDir,
    eventBus,
    journalStore,
    manager,
    handleSessionUpdated,
  };
}

export function cleanupSessionFixtures() {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}
