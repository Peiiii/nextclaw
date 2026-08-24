import { describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import type { NcpSessionSummary } from "@nextclaw/ncp";
import { SessionManager } from "@kernel/managers/session.manager.js";

const SUMMARY: NcpSessionSummary = {
  sessionId: "long-running-session",
  agentId: "reviewer",
  messageCount: 101,
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:01:00.000Z",
  metadata: {
    agentRuntimeId: "codex",
    preferred_model: "openai/gpt-5",
    project_root: "/tmp/nextclaw-project",
    thinkingEffort: "high",
  },
};

function createFixture() {
  const getCanonicalSession = vi.fn();
  const getSessionSummary = vi.fn(async () => structuredClone(SUMMARY));
  const manager = new SessionManager({
    agentContextWindowManager: {} as never,
    agentManager: {
      resolveAgentProfile: () => ({ workspace: "/tmp/nextclaw-workspace" }),
    } as never,
    configManager: {} as never,
    eventBus: new EventBus(),
    journalStore: {
      getSession: getCanonicalSession,
      getSessionSummary,
    } as never,
    projectManager: {} as never,
    sessionSearch: {} as never,
  });
  return { getCanonicalSession, getSessionSummary, manager };
}

describe("SessionManager agent run session identity", () => {
  it("materializes existing runtime identity without reading canonical messages", async () => {
    const { getCanonicalSession, getSessionSummary, manager } = createFixture();

    const direct = await manager.getAgentRunSession(SUMMARY.sessionId);
    const existing = await manager.getOrCreateAgentRunSession({
      sessionId: SUMMARY.sessionId,
      task: "queue the next message",
    });

    expect(direct).toEqual(existing);
    expect(existing).toMatchObject({
      sessionId: SUMMARY.sessionId,
      agentId: "reviewer",
      agentRuntimeId: "codex",
      model: "openai/gpt-5",
      projectRoot: "/tmp/nextclaw-project",
      thinkingEffort: "high",
    });
    expect(getSessionSummary).toHaveBeenCalledTimes(2);
    expect(getCanonicalSession).not.toHaveBeenCalled();
  });
});
