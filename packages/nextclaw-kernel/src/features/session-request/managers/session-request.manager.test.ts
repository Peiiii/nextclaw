import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import { SessionManager } from "@kernel/managers/session.manager.js";
import { ProjectManager } from "@kernel/features/projects/index.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { SessionRequestManager } from "./session-request.manager.js";

const tempDirs: string[] = [];

async function createFixture(options: { dispatch?: () => Promise<{ finalResponseMessageId: string; finalResponseText: string }> } = {}) {
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
  await sessionManager.start();
  const dispatchedRequests: unknown[] = [];
  const notifiedResults: unknown[] = [];
  const manager = new SessionRequestManager({
    sessionManager,
    dispatcher: {
      dispatch: async ({ onAccepted, request }) => {
        dispatchedRequests.push(structuredClone(request));
        onAccepted(`accepted-${request.requestId}`);
        if (options.dispatch) {
          return await options.dispatch();
        }
        return {
          finalResponseMessageId: `final-${request.requestId}`,
          finalResponseText: "done",
        };
      },
    },
    notifySourceSession: async (payload) => {
      notifiedResults.push(structuredClone(payload));
    },
  });
  return { dir, dispatchedRequests, manager, notifiedResults, sessionManager };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe("SessionRequestManager", () => {
  it("returns a running handle immediately and notifies the source after completion", async () => {
    const fixture = await createFixture();
    const result = await fixture.manager.spawnSessionAndRequest({
      sourceSessionId: "source-session",
      sourceSessionMetadata: {},
      sourceToolCallId: "source-tool-call",
      task: "Review this",
      notify: "final_reply",
      wait: "none",
    });

    expect(result.status).toBe("running");
    const record = await fixture.sessionManager.getSessionRecord(result.sessionId);
    expect(record?.metadata?.label).toBe("Review this");
    await vi.waitFor(() => expect(fixture.notifiedResults).toHaveLength(1));
    const journal = readJournal(fixture.dir);
    expect(journal).toContain("session.request.accepted");
    expect(journal).toContain("session.request.completed");
    expect(journal).toContain('"toolCallId":"source-tool-call"');
    expect(fixture.notifiedResults[0]).toMatchObject({
      request: { notify: "final_reply", wait: "none" },
      result: { status: "completed", wait: "none" },
    });
  });

  it("waits only when wait is final_reply and does not enqueue a duplicate notification", async () => {
    let finishDispatch: ((value: { finalResponseMessageId: string; finalResponseText: string }) => void) | undefined;
    const fixture = await createFixture({
      dispatch: () => new Promise((resolve) => {
        finishDispatch = resolve;
      }),
    });
    const pending = fixture.manager.spawnSessionAndRequest({
      sourceSessionId: "source-session",
      sourceSessionMetadata: {},
      task: "Review this",
      notify: "final_reply",
      wait: "final_reply",
    });

    await vi.waitFor(() => expect(finishDispatch).toBeTypeOf("function"));
    let settled = false;
    void pending.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    finishDispatch?.({ finalResponseMessageId: "final", finalResponseText: "done" });

    await expect(pending).resolves.toMatchObject({ status: "completed", wait: "final_reply" });
    expect(fixture.notifiedResults).toHaveLength(0);
  });

  it("passes context inheritance through requested child session creation", async () => {
    const fixture = await createFixture();
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
      wait: "none",
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
    const fixture = await createFixture();
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
      wait: "none",
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
    const fixture = await createFixture();
    await expect(fixture.manager.requestSession({
      sourceSessionId: "same",
      targetSessionId: "same",
      task: "loop",
      notify: "none",
      wait: "none",
    })).rejects.toThrow("sessions_request cannot target the current session");
  });
});

function readJournal(dir: string): string {
  return readdirSync(join(dir, "journal"))
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => readFileSync(join(dir, "journal", name), "utf-8"))
    .join("\n");
}
