import type { AgentRunSessionHost, AgentRunSessionRunHost } from "@kernel/types/agent-run-host.types.js";
import type { NcpMessage } from "@nextclaw/ncp";
import type {
  AgentRunAccepted,
  AgentRunRequest,
} from "@kernel/types/agent-run.types.js";

function messageContent(message: NcpMessage): string {
  return JSON.stringify({ role: message.role, parts: message.parts }, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
      : value);
}

export class AgentRunRequestIdempotencyService {
  private readonly inFlight = new Map<
    string,
    { message: NcpMessage; accepted: Promise<AgentRunAccepted> }
  >();

  constructor(
    private readonly sessionManager: AgentRunSessionHost,
    private readonly sessionRunManager: AgentRunSessionRunHost,
  ) {}

  accept = async (
    request: AgentRunRequest,
    acceptOnce: (request: AgentRunRequest) => Promise<AgentRunAccepted>,
  ): Promise<AgentRunAccepted> => {
    const idempotencyKey = request.idempotencyKey?.trim();
    if (!idempotencyKey) return await acceptOnce(request);
    const requestScope =
      request.sessionId?.trim() ||
      request.message.sessionId.trim() ||
      "new-session";
    const inFlightKey = `${requestScope}\0${idempotencyKey}`;
    const existing = this.inFlight.get(inFlightKey);
    if (existing) {
      this.assertSameMessage(
        existing.message,
        request.message,
        idempotencyKey,
      );
      return await existing.accepted;
    }
    const message = structuredClone(request.message);
    const accepted = this.acceptIdempotently(
      { ...request, message },
      idempotencyKey,
      acceptOnce,
    );
    this.inFlight.set(inFlightKey, {
      message,
      accepted,
    });
    try {
      return await accepted;
    } finally {
      if (this.inFlight.get(inFlightKey)?.accepted === accepted) {
        this.inFlight.delete(inFlightKey);
      }
    }
  };

  dispose = (): void => this.inFlight.clear();

  private acceptIdempotently = async (
    request: AgentRunRequest,
    idempotencyKey: string,
    acceptOnce: (request: AgentRunRequest) => Promise<AgentRunAccepted>,
  ): Promise<AgentRunAccepted> => {
    const sessionId =
      request.sessionId?.trim() || request.message.sessionId.trim();
    if (sessionId) {
      const sessionRun = this.sessionRunManager.getSessionRun(sessionId);
      const materializedInRun = sessionRun
        ?.getSnapshot()
        .messages.find(
          (message) =>
            message.metadata?.nextclaw_ingress_idempotency_key ===
            idempotencyKey,
        );
      if (materializedInRun) {
        this.assertSameMessage(
          materializedInRun,
          request.message,
          idempotencyKey,
        );
        return {
          sessionId,
          userMessageId: materializedInRun.id,
          runId: sessionRun?.getActiveRunId() ?? null,
          correlationId: request.correlationId,
          delivery: "started",
        };
      }
      const pending = sessionRun
        ?.listPendingRequests()
        .find((item) => item.request.idempotencyKey === idempotencyKey);
      if (pending) {
        this.assertSameMessage(
          pending.request.message,
          request.message,
          idempotencyKey,
        );
        return {
          sessionId,
          userMessageId: pending.request.message.id,
          runId:
            pending.placement === "steering" ? pending.intendedRunId : null,
          correlationId: pending.request.correlationId,
          delivery: pending.placement === "steering" ? "steered" : "queued",
        };
      }
      const record = await this.sessionManager.getSessionRecord(sessionId);
      const materialized = record?.messages.find(
        (message) =>
          message.metadata?.nextclaw_ingress_idempotency_key === idempotencyKey,
      );
      if (materialized) {
        this.assertSameMessage(
          materialized,
          request.message,
          idempotencyKey,
        );
        return {
          sessionId,
          userMessageId: materialized.id,
          runId: null,
          correlationId: request.correlationId,
          delivery: "started",
        };
      }
    }
    return await acceptOnce({
      ...request,
      idempotencyKey,
      message: {
        ...request.message,
        metadata: {
          ...request.message.metadata,
          nextclaw_ingress_idempotency_key: idempotencyKey,
        },
      },
    });
  };

  private assertSameMessage = (
    existingMessage: NcpMessage,
    requestedMessage: NcpMessage,
    idempotencyKey: string,
  ): void => {
    if (existingMessage.id !== requestedMessage.id || messageContent(existingMessage) !== messageContent(requestedMessage)) {
      throw new Error(
        `Agent run idempotency key was reused with a different message: ${idempotencyKey}`,
      );
    }
  };
}
