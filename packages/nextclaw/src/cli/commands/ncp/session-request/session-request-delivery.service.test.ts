import { describe, expect, it, vi } from "vitest";
import type { DefaultNcpAgentBackend } from "@nextclaw/ncp-toolkit";
import { SessionRequestDeliveryService } from "./session-request-delivery.service.js";
import type {
  SessionRequestRecord,
  SessionRequestToolResult,
} from "./session-request.types.js";

function createRequest(): SessionRequestRecord {
  return {
    requestId: "request-1",
    sourceSessionId: "source-session-1",
    targetSessionId: "child-session-1",
    sourceToolCallId: "spawn-call-1",
    rootRequestId: "request-1",
    handoffDepth: 0,
    awaitMode: "final_reply",
    deliveryMode: "resume_source",
    status: "completed",
    createdAt: "2026-04-08T00:00:00.000Z",
    startedAt: "2026-04-08T00:00:00.000Z",
    completedAt: "2026-04-08T00:00:01.000Z",
    finalResponseText: "Verified 1+1=2.",
    metadata: {
      title: "Verifier",
      task: "Verify that 1+1=2",
      is_child_session: true,
      parent_session_id: "source-session-1",
    },
  };
}

function createResult(): SessionRequestToolResult {
  return {
    kind: "nextclaw.session_request",
    requestId: "request-1",
    sessionId: "child-session-1",
    targetKind: "child",
    parentSessionId: "source-session-1",
    isChildSession: true,
    lifecycle: "persistent",
    title: "Verifier",
    task: "Verify that 1+1=2",
    status: "completed",
    awaitMode: "final_reply",
    deliveryMode: "resume_source",
    finalResponseText: "Verified 1+1=2.",
  };
}

describe("SessionRequestDeliveryService", () => {
  it("publishes tool results immediately even while the source session is still running", async () => {
    const backend = {
      updateToolCallResult: vi.fn(async () => null),
      getSession: vi.fn(async () => ({
        sessionId: "source-session-1",
        messageCount: 1,
        updatedAt: "2026-04-08T00:00:00.000Z",
        status: "running" as const,
      })),
    };
    const service = new SessionRequestDeliveryService(
      () => backend as unknown as DefaultNcpAgentBackend,
    );

    await service.publishToolResult({
      request: createRequest(),
      result: createResult(),
    });

    expect(backend.updateToolCallResult).toHaveBeenCalledWith(
      "source-session-1",
      "spawn-call-1",
      expect.objectContaining({
        kind: "nextclaw.session_request",
        status: "completed",
      }),
    );
    expect(backend.getSession).not.toHaveBeenCalled();
  });

  it("still waits for the source session to become idle before resuming it", async () => {
    vi.useFakeTimers();
    try {
      const backend = {
        getSession: vi
          .fn()
          .mockResolvedValueOnce({
            sessionId: "source-session-1",
            messageCount: 1,
            updatedAt: "2026-04-08T00:00:00.000Z",
            status: "running" as const,
          })
          .mockResolvedValueOnce({
            sessionId: "source-session-1",
            messageCount: 1,
            updatedAt: "2026-04-08T00:00:01.000Z",
            status: "idle" as const,
          }),
        send: vi.fn(
          () =>
            (async function* (): AsyncGenerator<unknown> {
              return;
            })(),
        ),
      };
      const service = new SessionRequestDeliveryService(
        () => backend as unknown as DefaultNcpAgentBackend,
      );

      const resumePromise = service.resumeSourceSession({
        request: createRequest(),
        result: createResult(),
      });

      await vi.advanceTimersByTimeAsync(150);
      await resumePromise;
      await vi.runAllTimersAsync();

      expect(backend.getSession).toHaveBeenCalledTimes(2);
      expect(backend.send).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
