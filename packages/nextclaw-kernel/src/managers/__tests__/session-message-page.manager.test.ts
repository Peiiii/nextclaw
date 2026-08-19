import { describe, expect, it, vi } from "vitest";
import { EventBus } from "@nextclaw/shared";
import { SessionManager } from "@kernel/managers/session.manager.js";

describe("SessionManager message pages", () => {
  it("keeps newest and cursor page reads inside the message projection", async () => {
    const sessionId = "session-1";
    const contextWindow = {
      totalContextTokens: 128_000,
      updatedAt: "2026-08-13T00:00:03.000Z",
      usedContextTokens: 1_024,
    };
    const listSessionMessagePage = vi.fn(async (params: { cursor?: string }) => {
      const { cursor } = params;
      return {
        contextWindow,
        messages: [{
          id: cursor ? "message-2" : "message-3",
          parts: [{ type: "text" as const, text: cursor ? "two" : "three" }],
          role: "user" as const,
          sessionId,
          status: "final" as const,
          timestamp: cursor ? "2026-08-13T00:00:02.000Z" : "2026-08-13T00:00:03.000Z",
        }],
        pageInfo: {
          hasPreviousPage: !cursor,
          startCursor: cursor ? "cursor-2" : "cursor-3",
        },
        total: 3,
      };
    });
    const getSession = vi.fn();
    const updateSessionMessageProjectionContextWindow = vi.fn();
    const previewSession = vi.fn(async () => contextWindow);
    const manager = new SessionManager({
      agentContextWindowManager: {
        forgetSession: () => undefined,
        previewSession,
      } as never,
      agentManager: {
        resolveAgentProfile: () => ({ workspace: "/tmp/nextclaw-session-message-page-test" }),
      } as never,
      configManager: {} as never,
      eventBus: new EventBus(),
      journalStore: {
        getSession,
        listSessionMessagePage,
        listUnfinishedRuns: async () => [],
        updateSessionMessageProjectionContextWindow,
      } as never,
      projectManager: {} as never,
      sessionSearch: { handleSessionUpdated: vi.fn() } as never,
    });

    const newest = await manager.listSessionMessagePage(sessionId, { limit: 1 });

    expect(newest?.contextWindow).toEqual(contextWindow);

    const previous = await manager.listSessionMessagePage(sessionId, {
      limit: 1,
      cursor: newest?.pageInfo.startCursor ?? undefined,
    });

    expect(previous?.contextWindow).toEqual(contextWindow);
    expect(previous?.messages).toEqual([
      expect.objectContaining({ id: "message-2" }),
    ]);
    expect(listSessionMessagePage).toHaveBeenCalledTimes(2);
    expect(getSession).not.toHaveBeenCalled();
    expect(previewSession).not.toHaveBeenCalled();
    expect(updateSessionMessageProjectionContextWindow).not.toHaveBeenCalled();
  });

  it("reads a session summary without replaying the journal or previewing context", async () => {
    const contextWindow = {
      totalContextTokens: 128_000,
      usedContextTokens: 1_024,
    };
    const getSession = vi.fn();
    const previewSession = vi.fn();
    const updateSessionMessageProjectionContextWindow = vi.fn();
    const manager = new SessionManager({
      agentContextWindowManager: {
        forgetSession: () => undefined,
        previewSession,
      } as never,
      agentManager: {
        resolveAgentProfile: () => ({ workspace: "/tmp/nextclaw-session-summary-test" }),
      } as never,
      configManager: {} as never,
      eventBus: new EventBus(),
      journalStore: {
        getSession,
        getSessionSummary: vi.fn(async () => ({
          sessionId: "session-1",
          createdAt: "2026-08-13T00:00:00.000Z",
          updatedAt: "2026-08-13T00:00:03.000Z",
          messageCount: 3,
          metadata: {},
        })),
        getSessionMessageProjectionContextWindow: vi.fn(async () => contextWindow),
        listUnfinishedRuns: async () => [],
        updateSessionMessageProjectionContextWindow,
      } as never,
      projectManager: {} as never,
      sessionSearch: { handleSessionUpdated: vi.fn() } as never,
    });

    await expect(manager.getSession("session-1")).resolves.toMatchObject({
      sessionId: "session-1",
      contextWindow,
      workingDir: "/tmp/nextclaw-session-summary-test",
    });
    expect(getSession).not.toHaveBeenCalled();
    expect(previewSession).not.toHaveBeenCalled();
    expect(updateSessionMessageProjectionContextWindow).not.toHaveBeenCalled();
  });
});
