import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { EventBus } from "@nextclaw/shared";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { SessionManager } from "@kernel/managers/session.manager.js";
import { ProjectManager } from "@kernel/features/projects/index.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

async function createFixture(records: AgentSessionRecord[] = []) {
  const homeDir = mkdtempSync(join(tmpdir(), "nextclaw-child-delegation-"));
  tempDirs.push(homeDir);
  const workspace = join(homeDir, "workspace");
  const journalStore = new NcpAgentSessionJournalStore(
    join(homeDir, ".ncp-agent-journal"),
  );
  for (const record of records) {
    await journalStore.importSessionSnapshot(record);
  }
  const manager = new SessionManager({
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
  return { journalStore, manager };
}

function createRecord(
  sessionId: string,
  metadata: Record<string, unknown> = {},
): AgentSessionRecord {
  return {
    sessionId,
    agentId: "main",
    messages: [],
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    metadata,
  };
}

describe("SessionManager child delegation depth", () => {
  it("rejects nested child sessions before persistence", async () => {
    const fixture = await createFixture([
      createRecord("root-session"),
      createRecord("child-session", { parent_session_id: "root-session" }),
    ]);

    await expect(fixture.manager.createSession({
      sessionId: "grandchild-session",
      sourceSessionId: "child-session",
      sourceSessionMetadata: {},
      parentSessionId: "child-session",
      task: "不应创建的孙会话",
    })).rejects.toThrow("Child sessions cannot create additional sessions.");
    await expect(fixture.journalStore.getSession("grandchild-session")).resolves.toBeNull();
  });

  it("does not let a child hide new sessions under a root or standalone scope", async () => {
    const fixture = await createFixture([
      createRecord("root-session"),
      createRecord("child-session", { parent_session_id: "root-session" }),
    ]);

    await expect(fixture.manager.createSession({
      sessionId: "disguised-root-child",
      sourceSessionId: "child-session",
      sourceSessionMetadata: {},
      parentSessionId: "root-session",
      task: "伪装挂到根会话",
    })).rejects.toThrow("Child sessions cannot create additional sessions.");
    await expect(fixture.manager.createSession({
      sessionId: "disguised-standalone",
      sourceSessionId: "child-session",
      sourceSessionMetadata: {},
      task: "伪装成独立会话",
    })).rejects.toThrow("Child sessions cannot create additional sessions.");

    await expect(fixture.journalStore.getSession("disguised-root-child")).resolves.toBeNull();
    await expect(fixture.journalStore.getSession("disguised-standalone")).resolves.toBeNull();
  });

  it("rejects child sessions whose parent does not exist", async () => {
    const fixture = await createFixture();

    await expect(fixture.manager.createSession({
      sessionId: "orphan-child-session",
      sourceSessionMetadata: {},
      parentSessionId: "missing-parent-session",
      task: "不应创建的孤儿会话",
    })).rejects.toThrow("Parent session not found: missing-parent-session");
    await expect(fixture.journalStore.getSession("orphan-child-session")).resolves.toBeNull();
  });

  it("rejects lineage injected through generic metadata overrides", async () => {
    const fixture = await createFixture([
      createRecord("root-session"),
      createRecord("child-session", { parent_session_id: "root-session" }),
    ]);

    await expect(fixture.manager.createSession({
      sessionId: "metadata-grandchild",
      sourceSessionMetadata: {},
      metadataOverrides: { parent_session_id: "child-session" },
      task: "不应通过 metadata 绕过层级校验",
    })).rejects.toThrow("Session parent must be set through parentSessionId.");
    await expect(fixture.journalStore.getSession("metadata-grandchild")).resolves.toBeNull();
  });

});
