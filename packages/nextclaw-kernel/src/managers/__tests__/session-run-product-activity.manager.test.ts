import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import { describe, expect, it, vi } from "vitest";
import { SessionRun } from "@kernel/managers/session-run.manager.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";

const session = {
  agentRuntimeId: "native",
  sessionId: "session-activity",
} as AgentRunSession;

function createRun() {
  const record = vi.fn();
  const run = new SessionRun(
    { sessionId: session.sessionId, messages: [] },
    undefined,
    { record },
  );
  run.enqueueRequest({
    message: {
      id: "message-private",
      role: "user",
      content: "private content must not enter analytics",
    },
  } as AgentRunRequest, session);
  const active = run.beginNextRun();
  if (!active) throw new Error("Expected an active run.");
  return { active, record, run };
}

describe("SessionRun product activity", () => {
  it("records accepted and successful human activity without business payload", async () => {
    const { active, record, run } = createRun();
    expect(record).toHaveBeenCalledWith({
      kind: "intent_accepted",
      occurredAt: expect.any(String),
      source: "direct",
    });

    await run.applyEvents([{
      type: NcpEventType.RunFinished,
      payload: { sessionId: session.sessionId, runId: active.runId },
    } as NcpEndpointEvent]);

    expect(record).toHaveBeenCalledWith({
      kind: "run_succeeded",
      occurredAt: expect.any(String),
      source: "direct",
    });
    expect(JSON.stringify(record.mock.calls)).not.toContain("session-activity");
    expect(JSON.stringify(record.mock.calls)).not.toContain("private content");
  });

  it("does not record failed runs as successful activity", async () => {
    const { active, record, run } = createRun();
    await run.applyEvents([{
      type: NcpEventType.RunError,
      payload: {
        sessionId: session.sessionId,
        runId: active.runId,
        error: "private runtime failure",
      },
    } as NcpEndpointEvent]);

    expect(record.mock.calls.map(([signal]) => signal.kind)).toEqual([
      "intent_accepted",
    ]);
  });
});
