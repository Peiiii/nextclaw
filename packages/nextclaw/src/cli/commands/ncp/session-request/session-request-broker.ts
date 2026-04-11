import type { SessionManager } from "@nextclaw/core";
import {
  NcpEventType,
  type NcpCompletedEnvelope,
  type NcpEndpointEvent,
} from "@nextclaw/ncp";
import type { DefaultNcpAgentBackend } from "@nextclaw/ncp-toolkit";
import { randomUUID } from "node:crypto";
import {
  buildSessionRequestToolResult,
  extractSessionMessageText,
  readOptionalString,
  readParentSessionId,
  summarizeSessionRequestTask,
} from "./session-request-result.js";
import {
  buildSessionRequestUserMessage,
  createCompletedSessionRequest,
  createFailedSessionRequest,
  createRunningSessionRequest,
} from "./session-request-execution.js";
import type {
  DispatchRequestParams,
  PublishRequestOutcomeParams,
  RequestSessionParams,
  SessionRequestExecutionParams,
  SpawnSessionAndRequestParams,
  StreamCompletedMessageParams,
} from "./session-request-broker.types.js";
import type { SessionCreationService } from "./session-creation.service.js";
import type { SessionRequestDeliveryService } from "./session-request-delivery.service.js";
import type {
  SessionRequestRecord,
  SessionRequestToolResult,
} from "./session-request.types.js";

export class SessionRequestBroker {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly sessionCreationService: SessionCreationService,
    private readonly deliveryService: SessionRequestDeliveryService,
    private readonly resolveBackend: () => DefaultNcpAgentBackend | null,
    private readonly onSessionUpdated?: (sessionKey: string) => void,
  ) {}

  spawnSessionAndRequest = async (
    params: SpawnSessionAndRequestParams,
  ): Promise<SessionRequestToolResult> => {
    const {
      sourceSessionId,
      sourceToolCallId,
      sourceSessionMetadata,
      task,
      title,
      model,
      runtime,
      handoffDepth,
      sessionType,
      thinkingLevel,
      projectRoot,
      agentId,
      parentSessionId,
      notify,
    } = params;
    const requestId = randomUUID();
    const createdSession = this.sessionCreationService.createSession({
      ...(parentSessionId ? { parentSessionId } : {}),
      task,
      title,
      sourceSessionMetadata,
      agentId,
      model,
      runtime,
      thinkingLevel,
      sessionType,
      projectRoot,
      requestId,
    });

    return this.dispatchRequest({
      requestId,
      sourceSessionId,
      sourceToolCallId,
      targetSessionId: createdSession.sessionId,
      task,
      title: createdSession.title ?? summarizeSessionRequestTask(task),
      handoffDepth: handoffDepth ?? 0,
      notify,
      agentId: createdSession.agentId,
      isChildSession: Boolean(parentSessionId),
      ...(parentSessionId ? { parentSessionId } : {}),
      spawnedByRequestId: requestId,
    });
  };

  requestSession = async (
    params: RequestSessionParams,
  ): Promise<SessionRequestToolResult> => {
    const {
      sourceSessionId,
      sourceToolCallId,
      targetSessionId,
      task,
      title,
      notify,
      handoffDepth,
    } = params;
    const normalizedTargetSessionId = targetSessionId.trim();

    if (normalizedTargetSessionId === sourceSessionId.trim()) {
      throw new Error("sessions_request cannot target the current session.");
    }
    const backend = this.resolveBackend();
    if (!backend) {
      throw new Error("NCP backend is not ready for session requests.");
    }
    const targetSummary = await backend.getSession(normalizedTargetSessionId);
    if (!targetSummary) {
      throw new Error(`Target session not found: ${targetSessionId}`);
    }
    const parentSessionId = readParentSessionId(targetSummary.metadata);

    return this.dispatchRequest({
      requestId: randomUUID(),
      sourceSessionId,
      sourceToolCallId,
      targetSessionId: normalizedTargetSessionId,
      task,
      title:
        readOptionalString(title) ??
        readOptionalString(targetSummary.metadata?.label) ??
        summarizeSessionRequestTask(task),
      handoffDepth: handoffDepth ?? 0,
      notify,
      agentId: targetSummary.agentId,
      isChildSession: Boolean(parentSessionId),
      parentSessionId: parentSessionId ?? undefined,
      spawnedByRequestId: undefined,
    });
  };

  private dispatchRequest = async (
    params: DispatchRequestParams,
  ): Promise<SessionRequestToolResult> => {
    const {
      requestId,
      sourceSessionId,
      sourceToolCallId,
      targetSessionId,
      task,
      title,
      handoffDepth,
      notify,
      agentId,
      isChildSession,
      parentSessionId,
      spawnedByRequestId,
    } = params;
    const request = createRunningSessionRequest({
      requestId,
      sourceSessionId,
      targetSessionId,
      sourceToolCallId,
      handoffDepth,
      notify,
      title,
      task,
      isChildSession,
      parentSessionId,
    });

    void this.runRequest({
      request,
      task,
      title,
      agentId,
      isChildSession,
      parentSessionId,
    }).catch((error) => {
      console.error(
        `[session-request] Background request ${requestId} crashed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });

    return buildSessionRequestToolResult({
      request,
      task,
      title,
      agentId,
      isChildSession,
      parentSessionId,
      spawnedByRequestId,
      message: `Session request started. You'll receive the final reply when it finishes.`,
    });
  };

  private resolveBackendOrThrow = (): DefaultNcpAgentBackend => {
    const backend = this.resolveBackend();
    if (!backend) {
      throw new Error("NCP backend is not ready for session request execution.");
    }
    return backend;
  };

  private readCompletedMessageFromStream = async (
    params: StreamCompletedMessageParams,
  ): Promise<NcpCompletedEnvelope["message"] | undefined> => {
    const { backend, request, task } = params;
    let completedMessage: NcpCompletedEnvelope["message"] | undefined;
    const message = buildSessionRequestUserMessage({
      sessionId: request.targetSessionId,
      requestId: request.requestId,
      task,
    });
    for await (const event of backend.send({
      sessionId: request.targetSessionId,
      message,
    })) {
      if (event.type === NcpEventType.MessageAccepted) {
        this.handleRequestEvent(request, event);
        continue;
      }
      if (event.type === NcpEventType.MessageFailed) {
        throw new Error(event.payload.error.message);
      }
      if (event.type === NcpEventType.RunError) {
        throw new Error(event.payload.error ?? "Session request failed.");
      }
      if (event.type === NcpEventType.MessageCompleted) {
        completedMessage = event.payload.message;
      }
    }
    return completedMessage;
  };

  private resolveCompletedMessage = async (params: {
    request: SessionRequestRecord;
    task: string;
  }): Promise<NcpCompletedEnvelope["message"]> => {
    const { request, task } = params;
    const backend = this.resolveBackendOrThrow();
    const streamedMessage = await this.readCompletedMessageFromStream({
      backend,
      request,
      task,
    });
    if (streamedMessage) {
      return streamedMessage;
    }
    throw new Error("Session request completed without a final reply.");
  };

  private appendRequestEvents = (
    request: SessionRequestRecord,
    type: string,
  ): void => {
    this.appendRequestEvent(request.sourceSessionId, type, request);
    this.appendRequestEvent(request.targetSessionId, type, request);
  };

  private publishRequestOutcome = async (
    params: PublishRequestOutcomeParams,
  ): Promise<void> => {
    const {
      request,
      task,
      title,
      agentId,
      isChildSession,
      parentSessionId,
      spawnedByRequestId,
    } = params;
    const result = buildSessionRequestToolResult({
      request,
      task,
      title,
      agentId,
      isChildSession,
      parentSessionId,
      spawnedByRequestId,
    });
    await this.deliveryService.publishToolResult({
      request,
      result,
    });
    if (request.notify === "final_reply") {
      await this.deliveryService.notifySourceSession({
        request,
        result,
      });
    }
  };

  private runRequest = async (
    params: SessionRequestExecutionParams,
  ): Promise<void> => {
    const {
      request,
      task,
      title,
      agentId,
      isChildSession,
      parentSessionId,
      spawnedByRequestId,
    } = params;
    try {
      const completedMessage = await this.resolveCompletedMessage({
        request,
        task,
      });
      const finalResponseText = extractSessionMessageText(completedMessage);
      const completedRequest = createCompletedSessionRequest({
        request,
        completedMessage,
        finalResponseText,
      });
      this.appendRequestEvents(completedRequest, "session.request.completed");
      await this.publishRequestOutcome({
        request: completedRequest,
        task,
        title,
        agentId,
        isChildSession,
        parentSessionId,
        spawnedByRequestId,
      });
    } catch (error) {
      const failedRequest = createFailedSessionRequest({
        request,
        error,
      });
      this.appendRequestEvents(failedRequest, "session.request.failed");
      await this.publishRequestOutcome({
        request: failedRequest,
        task,
        title,
        agentId,
        isChildSession,
        parentSessionId,
        spawnedByRequestId,
      });
    }
  };

  private handleRequestEvent = (
    request: SessionRequestRecord,
    event: NcpEndpointEvent,
  ): void => {
    if (event.type === NcpEventType.MessageAccepted) {
      const acceptedRequest: SessionRequestRecord = {
        ...request,
        targetMessageId: event.payload.messageId,
      };
      this.appendRequestEvent(request.sourceSessionId, "session.request.accepted", acceptedRequest);
      this.appendRequestEvent(request.targetSessionId, "session.request.accepted", acceptedRequest);
    }
  };

  private appendRequestEvent = (
    sessionId: string,
    type: string,
    request: SessionRequestRecord,
  ): void => {
    const session = this.sessionManager.getOrCreate(sessionId);
    this.sessionManager.appendEvent(session, {
      type,
      data: {
        request: structuredClone(request),
      },
    });
    this.sessionManager.save(session);
    this.onSessionUpdated?.(sessionId);
  };
}
