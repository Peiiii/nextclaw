import {
  type NcpEndpointEvent,
  type NcpRequestEnvelope,
  isHiddenNcpMessage,
} from "@nextclaw/ncp";
import { NcpEventType } from "@nextclaw/ncp";
import type { LiveSessionState } from "./agent-backend-types.js";

export class AgentRunExecutor {
  async *executeRun(
    session: LiveSessionState,
    envelope: NcpRequestEnvelope,
    controller: AbortController,
  ): AsyncGenerator<NcpEndpointEvent> {
    if (!isHiddenNcpMessage(envelope.message)) {
      const messageSent: NcpEndpointEvent = {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId: envelope.sessionId,
          message: structuredClone(envelope.message),
          ...(envelope.correlationId ? { correlationId: envelope.correlationId } : {}),
          metadata: envelope.metadata,
        },
      };
      await session.stateManager.dispatch(messageSent);
      yield structuredClone(messageSent);
    }

    try {
      for await (const event of session.runtime.run(
        {
          sessionId: envelope.sessionId,
          messages: [envelope.message],
          correlationId: envelope.correlationId,
          metadata: envelope.metadata,
        },
        { signal: controller.signal },
      )) {
        yield normalizeRunEvent(event, envelope);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const runErrorEvent = await this.publishFailure(
          error,
          envelope,
          session,
        );
        yield structuredClone(runErrorEvent);
      }
    }
  }

  private async publishFailure(
    error: unknown,
    envelope: NcpRequestEnvelope,
    session: LiveSessionState,
  ): Promise<NcpEndpointEvent> {
    const message = error instanceof Error ? error.message : String(error);
    const runErrorEvent: NcpEndpointEvent = {
      type: NcpEventType.RunError,
      payload: {
        sessionId: envelope.sessionId,
        ...(envelope.correlationId ? { correlationId: envelope.correlationId } : {}),
        error: message,
      },
    };

    await session.stateManager.dispatch(runErrorEvent);
    return runErrorEvent;
  }
}

function normalizeRunEvent(
  event: NcpEndpointEvent,
  envelope: NcpRequestEnvelope,
): NcpEndpointEvent {
  if (!("payload" in event) || !event.payload || typeof event.payload !== "object") {
    return structuredClone(event);
  }
  return structuredClone({
    ...event,
    payload: {
      ...event.payload,
      sessionId:
        "sessionId" in event.payload && typeof event.payload.sessionId === "string"
          ? event.payload.sessionId
          : envelope.sessionId,
      ...(envelope.correlationId &&
      (!("correlationId" in event.payload) || typeof event.payload.correlationId !== "string")
        ? { correlationId: envelope.correlationId }
        : {}),
    },
  } as NcpEndpointEvent);
}
