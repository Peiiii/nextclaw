import { describe, expect, it } from "vitest";
import { NcpEventType, type NcpMessage } from "@nextclaw/ncp";
import { SessionRun, SessionRunManager } from "@kernel/managers/session-run.manager.js";
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
  it("bounds a new giant message while retaining its source identity and later streaming parts", async () => {
    const run = new SessionRun({ sessionId: "session-1", messages: [] });
    const giant = { ...message("giant-live", "assistant", new Date().toISOString()), status: "streaming" as const,
      parts: [{ type: "text" as const, text: "x".repeat(64 * 1024 * 1024) }] };
    await run.applyEvents([{ type: NcpEventType.MessageSent, payload: { sessionId: "session-1", message: giant } }]);
    await run.applyEvents([{ type: NcpEventType.MessageTextStart, payload: { sessionId: "session-1", messageId: giant.id } },
      { type: NcpEventType.MessageTextDelta, payload: { sessionId: "session-1", messageId: giant.id, delta: "new evidence" } }]);
    const current = run.getSnapshot().messages.find(value => value.id === giant.id)!;
    expect(JSON.stringify(run.getSnapshot()).length).toBeLessThan(64 * 1024);
    expect(current.metadata?.nextclaw_archived_body).toBe(true);
    expect(current.metadata?.nextclaw_source).toMatchObject({ messageId: giant.id });
    expect(current.parts.at(-1)).toMatchObject({ type: "text", text: "new evidence" });
    expect(run.getContextRecoveryState().required).toBe(true);
  });

  it("limits cold loads to two and retains active actors while evicting inactive windows by bytes", async () => {
    let activeLoads = 0; let peak = 0;
    const manager = new SessionRunManager({ listSessionMessages: async () => { throw new Error("unbounded fallback must not be used"); },
      loadSessionRunSeed: async id => {
        activeLoads++; peak = Math.max(peak, activeLoads); await new Promise(resolve => setTimeout(resolve, 1)); activeLoads--;
        return [{ ...message(`seed-${id}`, "user", new Date().toISOString()), sessionId: id,
          parts: [{ type: "text", text: "x".repeat(7 * 1024 * 1024) }] }];
      } });
    const pinned = await manager.getOrCreateSessionRun("active");
    pinned.enqueueRequest({ sessionId: "active", message: { ...message("request", "user", new Date().toISOString()), sessionId: "active" } },
      { sessionId: "active", agentRuntimeId: "native", metadata: {} }); pinned.beginNextRun();
    await Promise.all(Array.from({ length: 10 }, (_, index) => manager.getOrCreateSessionRun(`cold-${index}`)));
    expect(peak).toBe(2); expect(manager.getSessionRun("active")).toBe(pinned);
    expect(manager.getSessionRun("cold-0")).toBeNull();
    const internals = manager as unknown as { inactiveBytes: Map<string, number> };
    expect([...internals.inactiveBytes.values()].reduce((sum, bytes) => sum + bytes, 0)).toBeLessThanOrEqual(64 * 1024 * 1024);
    manager.dispose();
  });
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
    const activeRequest = request("user-1");
    activeRequest.message = {
      ...activeRequest.message,
      metadata: {
        run_spec: {
          runId: "active-run-placeholder",
          model: "openai/gpt-5.6",
        },
      },
    };
    run.enqueueRequest(activeRequest, session);
    const active = run.beginNextRun();
    await run.applyEvents([{
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: "session-1",
        message: {
          ...activeRequest.message,
          metadata: {
            run_spec: {
              runId: active!.runId,
              model: "openai/gpt-5.6",
            },
          },
        },
      },
    }]);
    const queued = run.enqueueRequest(request("user-2"), session);

    expect(run.moveQueuedRequestToNextStep(queued.id)).toMatchObject({
      id: queued.id,
      intendedRunId: active?.runId,
      placement: "steering",
      request: {
        message: {
          metadata: {
            run_spec: {
              runId: active?.runId,
              model: "openai/gpt-5.6",
            },
            run_trigger: {
              actor: "human",
              sourceMessageId: "user-2",
              targetRunId: active?.runId,
            },
          },
        },
      },
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
