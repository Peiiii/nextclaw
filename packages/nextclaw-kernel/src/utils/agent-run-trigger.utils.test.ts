import { describe, expect, it } from "vitest";
import type { AgentRunRequest, AgentRunSpec } from "@kernel/types/agent-run.types.js";
import {
  attachSourceToolCall,
  createAgentToolRunTriggerInput,
  createIngressRunTriggerInput,
  resolveRunTriggerMetadata,
  resolveSteeringRunTriggerMetadata,
} from "@kernel/utils/agent-run-trigger.utils.js";

function createRequest(): AgentRunRequest {
  return {
    sessionId: "source-session",
    message: {
      id: "source-message",
      sessionId: "source-session",
      role: "assistant",
      status: "final",
      timestamp: "2026-08-25T00:00:00.000Z",
      parts: [{ type: "text", text: "delegate" }],
      metadata: {
        run_spec: {
          runId: "source-run",
          model: "openai/gpt-5.6",
        },
      },
    },
  };
}

describe("agent run trigger metadata", () => {
  it("captures agent tool provenance and freezes the target run", () => {
    const request = createRequest();
    const input = attachSourceToolCall(
      createAgentToolRunTriggerInput({ request, source: "sessions_spawn" }),
      "tool-call-1",
    );
    const trigger = resolveRunTriggerMetadata({
      request: { ...request, trigger: input },
      spec: { runId: "target-run" } as AgentRunSpec,
      startedAt: "2026-08-25T00:01:00.000Z",
    });

    expect(trigger).toMatchObject({
      version: 1,
      actor: "agent",
      source: "sessions_spawn",
      sourceSessionId: "source-session",
      sourceMessageId: "source-message",
      sourceRunId: "source-run",
      sourceToolCallId: "tool-call-1",
      sourceModel: "openai/gpt-5.6",
      targetRunId: "target-run",
    });
  });

  it("classifies direct user and service ingress without changing legacy source data", () => {
    const request = createRequest();
    expect(createIngressRunTriggerInput({
      request: {
        ...request,
        channel: "telegram",
        message: { ...request.message, role: "user" },
      },
      source: "ignored",
    })).toMatchObject({ actor: "human", source: "channel:telegram" });
    expect(createIngressRunTriggerInput({
      request: {
        ...request,
        message: { ...request.message, role: "service" },
      },
      source: "observation",
    })).toMatchObject({ actor: "automation", source: "observation" });
  });

  it("freezes a steering input onto the active run without changing its own trigger identity", () => {
    const request = {
      ...createRequest(),
      message: {
        ...createRequest().message,
        role: "user" as const,
        timestamp: "2026-08-25T00:02:00.000Z",
      },
    };

    expect(resolveSteeringRunTriggerMetadata({
      request,
      targetRunId: "active-run",
      acceptedAt: "2026-08-25T00:03:00.000Z",
    })).toMatchObject({
      actor: "human",
      sourceMessageId: "source-message",
      targetRunId: "active-run",
      triggeredAt: "2026-08-25T00:02:00.000Z",
      version: 1,
    });
  });

  it("classifies cron runs as automation and retains queryable job context", () => {
    const request = createRequest();
    expect(createIngressRunTriggerInput({
      request: {
        ...request,
        metadata: {
          session_origin: "cron",
          cron_job_id: "daily-review",
          cron_job_name: "Daily review",
        },
        message: { ...request.message, role: "user" },
      },
      source: "agent-run-client",
    })).toMatchObject({
      actor: "automation",
      source: "cron:daily-review",
      sourceContext: {
        session_origin: "cron",
        cron_job_id: "daily-review",
        cron_job_name: "Daily review",
      },
    });
  });

  it("drops non-finite numeric source context before persistence", () => {
    const request = createRequest();
    const trigger = createIngressRunTriggerInput({
      request: {
        ...request,
        metadata: {
          chatId: Number.NaN,
          accountId: Number.POSITIVE_INFINITY,
          senderId: 42,
        },
        message: { ...request.message, role: "user" },
      },
      source: "agent-run-client",
    });

    expect(trigger.sourceContext).toEqual({ senderId: 42 });
  });
});
