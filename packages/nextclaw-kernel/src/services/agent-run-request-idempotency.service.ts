import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import type {
  AgentRunAccepted,
  AgentRunRequest,
} from "@kernel/types/agent-run.types.js";

export class AgentRunRequestIdempotencyService {
  private readonly inFlight = new Map<
    string,
    { messageId: string; accepted: Promise<AgentRunAccepted> }
  >();

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly sessionRunManager: SessionRunManager,
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
        existing.messageId,
        request.message.id,
        idempotencyKey,
      );
      return await existing.accepted;
    }
    const accepted = this.acceptIdempotently(
      request,
      idempotencyKey,
      acceptOnce,
    );
    this.inFlight.set(inFlightKey, {
      messageId: request.message.id,
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
          materializedInRun.id,
          request.message.id,
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
          pending.request.message.id,
          request.message.id,
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
          materialized.id,
          request.message.id,
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
    existingMessageId: string,
    requestedMessageId: string,
    idempotencyKey: string,
  ): void => {
    if (existingMessageId !== requestedMessageId) {
      throw new Error(
        `Agent run idempotency key was reused with a different message: ${idempotencyKey}`,
      );
    }
  };
}
