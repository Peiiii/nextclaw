import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import { SessionManager } from "@kernel/managers/session.manager.js";
import { ProjectManager } from "@kernel/managers/project.manager.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { SessionRequestManager } from "./session-request.manager.js";

const tempDirs: string[] = [];

function createFixture() {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-session-request-manager-"));
  tempDirs.push(dir);
  const configManager = {
    loadConfig: () => ({
      agents: {
        defaults: {
          workspace: "",
          model: "",
          engine: "native",
          engineConfig: {},
          thinkingDefault: "off",
          models: {},
          contextTokens: 200000,
        },
        list: [],
      },
    }) as never,
  };
  const sessionManager = new SessionManager({
    agentContextWindowManager: {
      forgetSession: () => undefined,
      previewSession: async () => null,
    } as never,
    agentManager: {
      resolveAgentProfile: () => ({ workspace: "" }),
      resolveAgentProfileForRun: () => ({
        contextTokens: 200000,
        model: "",
        reservedContextTokens: 0,
      }),
    } as never,
    configManager: configManager as never,
    eventBus: new EventBus(),
    journalStore: new NcpAgentSessionJournalStore(join(dir, "journal")),
    projectManager: new ProjectManager({
      storePath: join(dir, "projects.json"),
      getDefaultWorkspacePath: () => dir,
    }),
    sessionSearch: { handleSessionUpdated: async () => undefined } as never,
  });
  const dispatchedRequests: unknown[] = [];
  const manager = new SessionRequestManager({
    sessionManager,
    dispatcher: {
      dispatch: async ({ onAccepted, request }) => {
        dispatchedRequests.push(structuredClone(request));
        onAccepted(`accepted-${request.requestId}`);
        return {
          finalResponseMessageId: `final-${request.requestId}`,
          finalResponseText: "done",
        };
      },
    },
  });
  return { dir, dispatchedRequests, manager, sessionManager };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("SessionRequestManager", () => {
  it("creates requested sessions and writes request status as NCP events", async () => {
    const fixture = createFixture();
    const result = await fixture.manager.spawnSessionAndRequest({
      sourceSessionId: "source-session",
      sourceSessionMetadata: {},
      task: "Review this",
      notify: "final_reply",
    });

    expect(result.status).toBe("completed");
    const record = await fixture.sessionManager.getSessionRecord(result.sessionId);
    expect(record?.metadata?.label).toBe("Review this");
    const journal = readdirSync(join(fixture.dir, "journal"))
      .filter((name) => name.endsWith(".jsonl"))
      .map((name) => readFileSync(join(fixture.dir, "journal", name), "utf-8"))
      .join("\n");
    expect(journal).toContain("session.request.accepted");
    expect(journal).toContain("session.request.completed");
  });

  it("passes context inheritance through requested child session creation", async () => {
    const fixture = createFixture();
    await fixture.sessionManager.createSession({
      sessionId: "source-session",
      sourceSessionMetadata: {},
      task: "Parent",
    });

    const result = await fixture.manager.spawnSessionAndRequest({
      sourceSessionId: "source-session",
      sourceSessionMetadata: {},
      contextInheritance: { anchorToolCallId: "call-spawn-1" },
      parentSessionId: "source-session",
      task: "Review this",
      notify: "final_reply",
    });
    const record = await fixture.sessionManager.getSessionRecord(result.sessionId);

    expect(record?.metadata).toMatchObject({
      parent_session_id: "source-session",
      context_inheritance: {
        enabled: true,
        sourceSessionId: "source-session",
        anchorKind: "latest_persisted",
        anchorToolCallId: "call-spawn-1",
        inheritedMessageCount: 0,
      },
    });
  });

  it("persists agent trigger provenance in the request and child session", async () => {
    const fixture = createFixture();
    await fixture.sessionManager.createSession({
      sessionId: "source-session",
      sourceSessionMetadata: {},
      task: "Parent",
    });
    const trigger = {
      actor: "agent" as const,
      source: "sessions_spawn",
      triggeredAt: "2026-08-25T00:00:00.000Z",
      sourceSessionId: "source-session",
      sourceMessageId: "source-message",
      sourceRunId: "source-run",
      sourceToolCallId: "source-tool-call",
      sourceModel: "openai/gpt-5.6",
    };

    const result = await fixture.manager.spawnSessionAndRequest({
      sourceSessionId: "source-session",
      sourceSessionMetadata: {},
      parentSessionId: "source-session",
      task: "Review this",
      notify: "none",
      trigger,
    });
    const child = await fixture.sessionManager.getSessionRecord(result.sessionId);

    expect(child?.metadata?.session_creation_trigger).toMatchObject(trigger);
    await vi.waitFor(() => {
      expect(fixture.dispatchedRequests).toHaveLength(1);
    });
    expect(fixture.dispatchedRequests[0]).toMatchObject({
      metadata: { run_trigger: trigger },
    });
  });

  it("rejects self-targeting requests before dispatch", async () => {
    const fixture = createFixture();
    await expect(fixture.manager.requestSession({
      sourceSessionId: "same",
      targetSessionId: "same",
      task: "loop",
      notify: "none",
    })).rejects.toThrow("sessions_request cannot target the current session");
  });
});
