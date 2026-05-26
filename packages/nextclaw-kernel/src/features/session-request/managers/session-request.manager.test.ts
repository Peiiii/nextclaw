import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SessionManager } from "@nextclaw/core";
import { EventBus } from "@nextclaw/shared";
import { NcpSessionManager } from "@kernel/managers/ncp-session.manager.js";
import { NcpAgentSessionJournalStore } from "@kernel/stores/ncp-agent-session-journal.store.js";
import { SessionRequestManager } from "./session-request.manager.js";

const tempDirs: string[] = [];

function createFixture() {
  const dir = mkdtempSync(join(tmpdir(), "nextclaw-session-request-manager-"));
  tempDirs.push(dir);
  const sessionManager = new SessionManager({ sessionsDir: join(dir, "legacy") });
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
          maxToolIterations: 1000,
        },
        list: [],
      },
    }) as never,
  };
  const ncpSessionManager = new NcpSessionManager({
    configManager: configManager as never,
    eventBus: new EventBus(),
    journalStore: new NcpAgentSessionJournalStore(join(dir, "journal")),
    sessionSearch: { handleSessionUpdated: async () => undefined } as never,
  });
  const manager = new SessionRequestManager({
    ncpSessionManager,
    dispatcher: {
      dispatch: async ({ onAccepted, request }) => {
        onAccepted(`accepted-${request.requestId}`);
        return {
          finalResponseMessageId: `final-${request.requestId}`,
          finalResponseText: "done",
        };
      },
    },
  });
  return { dir, manager, ncpSessionManager, sessionManager };
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
    expect(fixture.sessionManager.getIfExists(result.sessionId)).toBeNull();

    const record = await fixture.ncpSessionManager.getSessionRecord(result.sessionId);
    expect(record?.metadata?.label).toBe("Review this");
    const journal = readdirSync(join(fixture.dir, "journal"))
      .filter((name) => name.endsWith(".jsonl"))
      .map((name) => readFileSync(join(fixture.dir, "journal", name), "utf-8"))
      .join("\n");
    expect(journal).toContain("session.request.accepted");
    expect(journal).toContain("session.request.completed");
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
