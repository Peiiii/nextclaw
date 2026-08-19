import { describe, expect, it, vi } from "vitest";
import { EventBus, Ingress } from "@nextclaw/shared";
import {
  NcpEventType,
  type NcpEndpointEvent,
} from "@nextclaw/ncp";
import { AgentRunRequestManager } from "@kernel/managers/agent-run-request.manager.js";
import { SessionRun } from "@kernel/managers/session-run.manager.js";

async function waitForCondition(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function startDiagnosticRun(events: NcpEndpointEvent[]): ReturnType<typeof vi.fn> {
  const record = vi.fn((event: Record<string, unknown>) => event);
  const sessionRun = new SessionRun({ sessionId: "session-diagnostic", messages: [] });
  const manager = new AgentRunRequestManager(
    { disposeRuntime: vi.fn(async () => true) } as never,
    {} as never,
    {} as never,
    {} as never,
    new EventBus(),
    new Ingress(),
    {} as never,
    {} as never,
    { record } as never,
  );
  const runtime = {
    run: async function* (): AsyncGenerator<NcpEndpointEvent> {
      yield* events;
    },
  };

  (manager as unknown as {
    startRuntimeRun: (params: Record<string, unknown>) => void;
  }).startRuntimeRun({
    options: {
      contextBlocks: [],
      session: {
        agentRuntimeId: "native",
        sessionId: "session-diagnostic",
      },
      sessionRun,
      signal: new AbortController().signal,
      tools: [],
    },
    requestRunStartedAt: new Date().toISOString(),
    runtime,
    spec: {
      agentId: "main",
      model: "test-model",
      requestedModel: null,
      runId: "run-diagnostic",
      runtimeId: "native",
    },
  });

  return record;
}

describe("AgentRunRequestManager diagnostics", () => {
  it("records a MessageAbort-only runtime as cancelled instead of completed", async () => {
    const record = startDiagnosticRun([{
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId: "session-diagnostic",
        messageId: "assistant-cancelled",
        runId: "run-diagnostic",
      },
    }]);

    await waitForCondition(() => record.mock.calls.some(([event]) => event.event === "run.cancelled"));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      domain: "agent.run",
      event: "run.cancelled",
      outcome: "cancelled",
      reasonCode: "operation_cancelled",
    }));
  });

  it("classifies a structured runtime network failure without recording private detail", async () => {
    const record = startDiagnosticRun([{
      type: NcpEventType.RunError,
      payload: {
        sessionId: "session-diagnostic",
        runId: "run-diagnostic",
        error: {
          code: "ENOTFOUND",
          message: "private-service.internal.example could not be resolved",
        },
      },
    } as NcpEndpointEvent]);

    await waitForCondition(() => record.mock.calls.some(([event]) => event.event === "run.failed"));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({
      domain: "agent.run",
      event: "run.failed",
      outcome: "failed",
      reasonCode: "network_dns_failure",
      providerCode: "enotfound",
    }));
    expect(JSON.stringify(record.mock.calls)).not.toContain("private-service.internal.example");
  });
});
