import type { AgentRunSessionHost, AgentRunSessionRunHost } from "@kernel/types/agent-run-host.types.js";
import type { NcpMessage } from "@nextclaw/ncp";
import { createHash } from "node:crypto";
import { sessionJsonFragments } from "@kernel/utils/session-message-chunks.utils.js";
import type {
  AgentRunAccepted,
  AgentRunRequest,
} from "@kernel/types/agent-run.types.js";

function messageContent(message: NcpMessage): string {
  const hash = createHash("sha256");
  for (const fragment of sessionJsonFragments({ role: message.role, parts: message.parts }, true)) hash.update(fragment);
  return hash.digest("hex");
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
      const materialized = await this.sessionManager.findSessionMessageByIngressKey(sessionId, idempotencyKey);
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
          nextclaw_ingress_content_digest: messageContent(request.message),
        },
      },
    });
  };

  private assertSameMessage = (
    existingMessage: NcpMessage,
    requestedMessage: NcpMessage,
    idempotencyKey: string,
  ): void => {
    const recorded = existingMessage.metadata?.nextclaw_ingress_content_digest;
    if (existingMessage.id !== requestedMessage.id || (typeof recorded === "string" ? recorded : messageContent(existingMessage)) !== messageContent(requestedMessage)) {
      throw new Error(
        `Agent run idempotency key was reused with a different message: ${idempotencyKey}`,
      );
    }
  };
}
