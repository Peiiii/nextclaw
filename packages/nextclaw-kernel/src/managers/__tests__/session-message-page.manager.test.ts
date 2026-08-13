import { describe, expect, it, vi } from "vitest";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { EventBus } from "@nextclaw/shared";
import { SessionManager } from "@kernel/managers/session.manager.js";

describe("SessionManager message pages", () => {
  it("computes context window for the newest page and reuses it for cursor pages", async () => {
    const sessionId = "session-1";
    const record: AgentSessionRecord = {
      sessionId,
      createdAt: "2026-08-13T00:00:00.000Z",
      updatedAt: "2026-08-13T00:00:03.000Z",
      metadata: {},
      messages: [],
    };
    const contextWindow = {
      totalContextTokens: 128_000,
      updatedAt: "2026-08-13T00:00:03.000Z",
      usedContextTokens: 1_024,
    };
    let storedContextWindow: Record<string, unknown> | null = null;
    const listSessionMessagePage = vi.fn(async (params: { cursor?: string }) => {
      const { cursor } = params;
      return {
        contextWindow: storedContextWindow,
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
    const getSession = vi.fn(async () => structuredClone(record));
    const updateSessionMessageProjectionContextWindow = vi.fn(async (
      _sessionId: string,
      nextContextWindow: Record<string, unknown> | null,
    ) => {
      storedContextWindow = structuredClone(nextContextWindow);
    });
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

    expect(previewSession).toHaveBeenCalledTimes(1);
    expect(newest?.contextWindow).toEqual(contextWindow);
    expect(updateSessionMessageProjectionContextWindow).toHaveBeenCalledWith(
      sessionId,
      contextWindow,
    );

    const previous = await manager.listSessionMessagePage(sessionId, {
      limit: 1,
      cursor: newest?.pageInfo.startCursor ?? undefined,
    });

    expect(previewSession).toHaveBeenCalledTimes(1);
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(previous?.contextWindow).toEqual(contextWindow);
    expect(previous?.messages).toEqual([
      expect.objectContaining({ id: "message-2" }),
    ]);
  });
});
