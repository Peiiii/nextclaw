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
  it("rejects changed content under the same message ID while admission is in flight", async () => {
    const service = new AgentRunRequestIdempotencyService(
      { getSessionRecord: vi.fn(async () => null) } as never,
      { getSessionRun: vi.fn(() => undefined) } as never,
    );
    let complete!: (value: AgentRunAccepted) => void;
    const acceptOnce = vi.fn(async () => await new Promise<AgentRunAccepted>((resolve) => { complete = resolve; }));
    const original = createRequest("session-a", "message-a");
    const pending = service.accept(original, acceptOnce);
    await vi.waitFor(() => expect(acceptOnce).toHaveBeenCalledOnce());
    original.message.parts = [{ type: "text", text: "changed after admission" }];
    await expect(service.accept(original, acceptOnce)).rejects.toThrow("different message");
    complete({ sessionId: "session-a", userMessageId: "message-a", runId: null, delivery: "started" });
    await pending;
    expect(acceptOnce).toHaveBeenCalledOnce();
  });

  it.each(["persisted", "running", "queued"] as const)("checks content against %s requests without replaying effects", async (location) => {
    const original = createRequest("session-a", "message-a");
    original.message.metadata = { nextclaw_ingress_idempotency_key: "shared-key" };
    const run = {
      getSnapshot: () => ({ messages: location === "running" ? [original.message] : [] }),
      getActiveRunId: () => "run-a",
      listPendingRequests: () => location === "queued"
        ? [{ request: original, placement: "queued" }] : [],
    };
    const service = new AgentRunRequestIdempotencyService(
      { getSessionRecord: async () => ({ messages: location === "persisted" ? [original.message] : [] }) } as never,
      { getSessionRun: () => location === "persisted" ? undefined : run } as never,
    );
    const acceptOnce = vi.fn();
    const retry = createRequest("session-a", "message-a");
    retry.message.timestamp = "2026-09-30T00:00:00.000Z";
    retry.message.parts = [{ text: "test", type: "text" }];
    await expect(service.accept(retry, acceptOnce)).resolves.toMatchObject({ userMessageId: "message-a" });
    retry.message.parts = [{ type: "text", text: "different operation" }];
    await expect(service.accept(retry, acceptOnce)).rejects.toThrow("different message");
    expect(acceptOnce).not.toHaveBeenCalled();
  });

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
