import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { SessionRun } from "@kernel/managers/session-run.manager.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";

function message(id: string, role: NcpMessage["role"], timestamp: string): NcpMessage {
  return {
    id,
    sessionId: "session-1",
    role,
    status: "final",
    parts: [],
    timestamp
  };
}

describe("SessionRun", () => {
  it("materializes a streaming assistant before a later stable user message", async () => {
    const run = new SessionRun({
      sessionId: "session-1",
      messages: [
        message("user-first", "user", "2026-05-14T00:00:00.000Z"),
        message("user-later", "user", "2026-05-14T00:00:02.000Z")
      ]
    });

    await run.applyEvents([
      {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId: "session-1",
          message: {
            ...message("assistant-old", "assistant", "2026-05-14T00:00:01.000Z"),
            status: "streaming"
          }
        }
      },
      {
        type: NcpEventType.MessageTextStart,
        payload: { sessionId: "session-1", messageId: "assistant-old" }
      }
    ]);

    expect(run.getSnapshot().messages.map((item) => item.id)).toEqual([
      "user-first",
      "assistant-old",
      "user-later"
    ]);
  });

  it("moves queued input atomically to next-step and restores an unacknowledged claim on error", async () => {
    const run = new SessionRun({ sessionId: "session-1", messages: [] });
    const session: AgentRunSession = {
      sessionId: "session-1",
      agentRuntimeId: "native",
      metadata: {},
    };
    const request = (id: string): AgentRunRequest => ({
      sessionId: "session-1",
      message: message(id, "user", new Date().toISOString()),
    });
    run.enqueueRequest(request("user-1"), session);
    const active = run.beginNextRun();
    const queued = run.enqueueRequest(request("user-2"), session);

    expect(run.moveQueuedRequestToNextStep(queued.id)).toMatchObject({
      id: queued.id,
      intendedRunId: active?.runId,
      placement: "steering",
    });
    expect(run.listQueuedRequests()).toEqual([]);
    expect(run.claimNextStepRequests(active!.runId)).toHaveLength(1);

    await run.applyEvents([{
      type: NcpEventType.RunError,
      payload: { sessionId: "session-1", runId: active!.runId, error: "failed" },
    }]);

    expect(run.listQueuedRequests()).toMatchObject([{ id: queued.id }]);
    expect(run.listPendingRequests()).toMatchObject([{
      id: queued.id,
      placement: "queued",
      intendedRunId: null,
    }]);
  });
});
