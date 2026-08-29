import { describe, expect, it, vi } from "vitest";
import {
  NCP_INTERNAL_VISIBILITY_METADATA_KEY,
  NcpEventType,
  type NcpMessage,
} from "@nextclaw/ncp";
import { EventBus, Ingress, eventKeys, ingressKeys } from "@nextclaw/shared";
import type { SessionRequestRecord } from "@nextclaw/core";
import {
  dispatchAgentRuntimeSessionRequest,
  createAgentRuntimeSessionRequestSourceNotifier,
  waitForAgentRuntimeSessionReply,
} from "./agent-runtime-session-request-dispatcher.utils.js";

const finalMessage: NcpMessage = {
  id: "assistant-1",
  sessionId: "session-1",
  role: "assistant",
  status: "final",
  parts: [{ type: "text", text: "done" }],
  timestamp: "2026-05-23T00:00:00.000Z",
};

describe("waitForAgentRuntimeSessionReply", () => {
  it("resolves when run.finished carries the request correlation after an uncorrelated completion", async () => {
    const eventBus = new EventBus();
    const onAccepted = vi.fn();
    const reply = waitForAgentRuntimeSessionReply({
      eventBus,
      onAccepted,
      requestId: "request-1",
    });

    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId: "session-1",
        message: finalMessage,
      },
    });
    eventBus.emit(eventKeys.ncpEvent, {
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: "session-1",
        messageId: "assistant-1",
        correlationId: "request-1",
      },
    });

    await expect(reply.promise).resolves.toMatchObject({ id: "assistant-1" });
    expect(onAccepted).toHaveBeenCalledWith("assistant-1");
  });

});

describe("dispatchAgentRuntimeSessionRequest", () => {
  function createRequest(metadata?: Record<string, unknown>): SessionRequestRecord {
    return {
      requestId: "request-1",
      sourceSessionId: "source-session",
      targetSessionId: "target-session",
      rootRequestId: "request-1",
      handoffDepth: 1,
      notify: "none",
      wait: "none",
      status: "running",
      createdAt: "2026-08-25T00:00:00.000Z",
      metadata,
    };
  }

  it("dispatches the persisted source trigger with the target message", async () => {
    const ingress = new Ingress();
    const received = vi.fn();
    ingress.addHandler(ingressKeys.agentRun.sessionMessageRequest, (envelope) => {
      received(envelope.payload);
    });
    const trigger = {
      actor: "agent",
      source: "sessions_request",
      triggeredAt: "2026-08-25T00:00:00.000Z",
      sourceSessionId: "source-session",
      sourceRunId: "source-run",
      sourceModel: "openai/gpt-5.6",
    };

    await dispatchAgentRuntimeSessionRequest({
      ingress,
      request: createRequest({ run_trigger: trigger }),
      task: "Continue",
    });

    expect(received).toHaveBeenCalledWith(expect.objectContaining({ trigger }));
  });

  it("uses an explicit system recovery trigger for legacy pending requests", async () => {
    const ingress = new Ingress();
    const received = vi.fn();
    ingress.addHandler(ingressKeys.agentRun.sessionMessageRequest, (envelope) => {
      received(envelope.payload);
    });

    await dispatchAgentRuntimeSessionRequest({
      ingress,
      request: createRequest(),
      task: "Recover",
    });

    expect(received).toHaveBeenCalledWith(expect.objectContaining({
      trigger: expect.objectContaining({
        actor: "system",
        source: "session-request-recovery",
        sourceRequestId: "request-1",
      }),
    }));
  });
});

describe("createAgentRuntimeSessionRequestSourceNotifier", () => {
  it("queues a hidden structured completion message for the source session", async () => {
    const ingress = new Ingress();
    const received = vi.fn();
    ingress.addHandler(ingressKeys.agentRun.sessionMessageRequest, (envelope) => {
      received(envelope.payload);
    });
    const notify = createAgentRuntimeSessionRequestSourceNotifier({ ingress });

    await notify({
      request: {
        requestId: "request-1",
        sourceSessionId: "source-session",
        targetSessionId: "target-session",
        rootRequestId: "request-1",
        handoffDepth: 0,
        notify: "final_reply",
        wait: "none",
        status: "completed",
        createdAt: "2026-08-30T00:00:00.000Z",
        metadata: { title: "Verifier", task: "Check <value>" },
      },
      result: {
        kind: "nextclaw.session_request",
        requestId: "request-1",
        sessionId: "target-session",
        targetKind: "child",
        isChildSession: true,
        lifecycle: "persistent",
        task: "Check <value>",
        status: "completed",
        notify: "final_reply",
        wait: "none",
        finalResponseText: "Done & verified",
      },
    });

    expect(received).toHaveBeenCalledWith(expect.objectContaining({
      requestId: "request-1:completion",
      sessionId: "source-session",
      message: expect.objectContaining({
        role: "user",
        metadata: expect.objectContaining({
          [NCP_INTERNAL_VISIBILITY_METADATA_KEY]: "hidden",
          system_event_kind: "session_request_completion",
        }),
        parts: [expect.objectContaining({
          text: expect.stringContaining("Done &amp; verified"),
        })],
      }),
      trigger: expect.objectContaining({
        actor: "system",
        source: "session-request-completion",
        sourceSessionId: "target-session",
        sourceRequestId: "request-1",
      }),
    }));
  });
});
