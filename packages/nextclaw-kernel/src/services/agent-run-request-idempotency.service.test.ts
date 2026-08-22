import type {
  AgentRunAccepted,
  AgentRunRequest,
} from "@kernel/types/agent-run.types.js";
import { describe, expect, it, vi } from "vitest";
import { AgentRunRequestIdempotencyService } from "./agent-run-request-idempotency.service.js";

function createRequest(sessionId: string, messageId: string): AgentRunRequest {
  return {
    sessionId,
    idempotencyKey: "shared-key",
    message: {
      id: messageId,
      sessionId,
      role: "user",
      status: "final",
      timestamp: "2026-08-22T00:00:00.000Z",
      parts: [{ type: "text", text: "test" }],
    },
  };
}

describe("AgentRunRequestIdempotencyService", () => {
  it("scopes concurrent in-flight keys by session", async () => {
    const service = new AgentRunRequestIdempotencyService(
      { getSessionRecord: vi.fn(async () => null) } as never,
      { getSessionRun: vi.fn(() => undefined) } as never,
    );
    const resolvers = new Map<string, (accepted: AgentRunAccepted) => void>();
    const acceptOnce = vi.fn(
      async (request: AgentRunRequest) =>
        await new Promise<AgentRunAccepted>((resolve) => {
          resolvers.set(request.sessionId ?? "", resolve);
        }),
    );

    const first = service.accept(
      createRequest("session-a", "message-a"),
      acceptOnce,
    );
    await vi.waitFor(() => expect(acceptOnce).toHaveBeenCalledTimes(1));
    const second = service.accept(
      createRequest("session-b", "message-b"),
      acceptOnce,
    );
    await vi.waitFor(() => expect(acceptOnce).toHaveBeenCalledTimes(2));
    resolvers.get("session-a")?.({
      sessionId: "session-a",
      userMessageId: "message-a",
      runId: null,
      delivery: "started",
    });
    resolvers.get("session-b")?.({
      sessionId: "session-b",
      userMessageId: "message-b",
      runId: null,
      delivery: "started",
    });

    await expect(first).resolves.toMatchObject({ sessionId: "session-a" });
    await expect(second).resolves.toMatchObject({ sessionId: "session-b" });
  });
});
