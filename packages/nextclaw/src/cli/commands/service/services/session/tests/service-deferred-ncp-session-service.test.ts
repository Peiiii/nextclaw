import { describe, expect, it, vi } from "vitest";
import type { NcpSessionApi } from "@nextclaw/ncp";
import { createDeferredUiNcpSessionService } from "../service-deferred-ncp-session-service.js";

function createSessionApi(label: string): NcpSessionApi {
  return {
    listSessions: vi.fn(async () => [
      {
        sessionId: `${label}-session`,
        messageCount: 1,
        updatedAt: "2026-03-29T00:00:00.000Z",
        status: "idle" as const,
        metadata: {}
      }
    ]),
    listSessionMessages: vi.fn(async () => []),
    getSession: vi.fn(async (sessionId: string) => ({
      sessionId,
      messageCount: 1,
      updatedAt: "2026-03-29T00:00:00.000Z",
      status: "idle" as const,
      metadata: { source: label }
    })),
    updateSession: vi.fn(async (sessionId: string, _patch) => ({
      sessionId,
      messageCount: 1,
      updatedAt: "2026-03-29T00:00:00.000Z",
      status: "idle" as const,
      metadata: { source: label }
    })),
    deleteSession: vi.fn(async () => undefined),
  };
}

describe("createDeferredUiNcpSessionService", () => {
  it("delegates to the fallback service until activated and returns to it after clear", async () => {
    const fallback = createSessionApi("fallback");
    const active = createSessionApi("active");
    const deferred = createDeferredUiNcpSessionService(fallback);

    expect((await deferred.service.getSession("session-1"))?.metadata).toMatchObject({ source: "fallback" });

    deferred.activate(active);
    expect((await deferred.service.getSession("session-1"))?.metadata).toMatchObject({ source: "active" });

    deferred.clear();
    expect((await deferred.service.getSession("session-1"))?.metadata).toMatchObject({ source: "fallback" });
  });
});
