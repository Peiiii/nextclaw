import { randomUUID } from "node:crypto";
import type { SessionManager } from "@core/features/session/index.js";
import {
  buildSessionRequestToolResult,
  readOptionalString,
  readParentSessionId,
  summarizeSessionRequestTask,
} from "@core/features/session-request/utils/session-request-result.utils.js";
import {
  createCompletedSessionRequest,
  createFailedSessionRequest,
  createRunningSessionRequest,
} from "@core/features/session-request/utils/session-request-record.utils.js";
import type {
  DispatchRequestParams,
  RequestSessionParams,
  SessionRequestDispatcher,
  SessionRequestPayload,
  SessionRequestResultContext,
  SpawnSessionAndRequestParams,
} from "@core/features/session-request/types/session-request-manager.types.js";
import type {
  SessionRequestRecord,
  SessionRequestToolResult,
} from "@core/features/session-request/types/session-request.types.js";

export type SessionRequestManagerOptions = {
  dispatcher: SessionRequestDispatcher;
  onSessionUpdated?: (sessionKey: string) => void;
  sessions: SessionManager;
};

export class SessionRequestManager {
  constructor(private readonly options: SessionRequestManagerOptions) {}

  spawnSessionAndRequest = async (
    params: SpawnSessionAndRequestParams,
  ): Promise<SessionRequestToolResult> => {
    const {
      sourceSessionId,
      sourceToolCallId,
      updateToolCallResult,
      sourceSessionMetadata,
      metadataOverrides,
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
    const createdSession = this.options.sessions.createSession({
      sourceSessionId,
      ...(parentSessionId ? { parentSessionId } : {}),
      task,
      title,
      sourceSessionMetadata,
      ...(metadataOverrides ? { metadataOverrides } : {}),
      agentId,
      model,
      runtime,
      thinkingLevel,
      sessionType,
      projectRoot,
      requestId,
    });
    this.options.onSessionUpdated?.(createdSession.sessionId);

    return this.dispatchRequest({
      requestId,
      sourceSessionId,
      sourceToolCallId,
      updateToolCallResult,
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
      updateToolCallResult,
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
    const targetSession = this.options.sessions.getIfExists(normalizedTargetSessionId);
    if (!targetSession) {
      throw new Error(`Target session not found: ${targetSessionId}`);
    }
    const parentSessionId = readParentSessionId(targetSession.metadata);

    return this.dispatchRequest({
      requestId: randomUUID(),
      sourceSessionId,
      sourceToolCallId,
      updateToolCallResult,
      targetSessionId: normalizedTargetSessionId,
      task,
      title:
        readOptionalString(title) ??
        readOptionalString(targetSession.metadata.label) ??
        summarizeSessionRequestTask(task),
      handoffDepth: handoffDepth ?? 0,
      notify,
      agentId: targetSession.agentId,
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
      updateToolCallResult,
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
    const resultContext: SessionRequestResultContext = {
      task,
      title,
      updateToolCallResult,
      agentId,
      isChildSession,
      parentSessionId,
      spawnedByRequestId,
    };
    const payload = this.toSessionRequestPayload(request, resultContext);

    if (notify === "final_reply") {
      return await this.runRequest(payload);
    }

    void this.runRequestAndUpdateToolCallResult(payload);

    return this.buildToolResult({
      ...payload,
      message: `Session request started. You'll receive the final reply when it finishes.`,
    });
  };

  private toSessionRequestPayload = (
    request: SessionRequestRecord,
    resultContext: SessionRequestResultContext,
  ): SessionRequestPayload => ({
    request,
    resultContext,
  });

  private buildToolResult = (
    payload: SessionRequestPayload & { message?: string },
  ): SessionRequestToolResult => {
    const {
      task,
      title,
      agentId,
      isChildSession,
      parentSessionId,
      spawnedByRequestId,
    } = payload.resultContext;
    return buildSessionRequestToolResult({
      request: payload.request,
      task,
      title,
      isChildSession,
      ...(agentId ? { agentId } : {}),
      ...(parentSessionId ? { parentSessionId } : {}),
      ...(spawnedByRequestId ? { spawnedByRequestId } : {}),
      ...(payload.message ? { message: payload.message } : {}),
    });
  };

  private appendRequestEvents = (
    request: SessionRequestRecord,
    type: string,
  ): void => {
    this.appendRequestEvent(request.sourceSessionId, type, request);
    this.appendRequestEvent(request.targetSessionId, type, request);
  };

  private runRequest = async (
    payload: SessionRequestPayload,
  ): Promise<SessionRequestToolResult> => {
    const { request, resultContext } = payload;
    try {
      const dispatchResult = await this.options.dispatcher.dispatch({
        request,
        task: resultContext.task,
        onAccepted: (messageId) => {
          this.appendAcceptedRequestEvent(request, messageId);
        },
      });
      const completedRequest = createCompletedSessionRequest({
        request,
        finalResponseMessageId: dispatchResult.finalResponseMessageId,
        finalResponseText: dispatchResult.finalResponseText,
      });
      this.appendRequestEvents(completedRequest, "session.request.completed");
      const completedPayload = this.toSessionRequestPayload(completedRequest, resultContext);
      return this.buildToolResult(completedPayload);
    } catch (error) {
      const failedRequest = createFailedSessionRequest({
        request,
        error,
      });
      this.appendRequestEvents(failedRequest, "session.request.failed");
      const failedPayload = this.toSessionRequestPayload(failedRequest, resultContext);
      return this.buildToolResult(failedPayload);
    }
  };

  private runRequestAndUpdateToolCallResult = async (
    payload: SessionRequestPayload,
  ): Promise<void> => {
    try {
      const result = await this.runRequest(payload);
      await payload.resultContext.updateToolCallResult(result);
    } catch (error) {
      console.error(
        `[session-request] Background request ${payload.request.requestId} crashed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  };

  private appendAcceptedRequestEvent = (
    request: SessionRequestRecord,
    messageId: string,
  ): void => {
    const acceptedRequest: SessionRequestRecord = {
      ...request,
      targetMessageId: messageId,
    };
    this.appendRequestEvent(request.sourceSessionId, "session.request.accepted", acceptedRequest);
    this.appendRequestEvent(request.targetSessionId, "session.request.accepted", acceptedRequest);
  };

  private appendRequestEvent = (
    sessionId: string,
    type: string,
    request: SessionRequestRecord,
  ): void => {
    const session = this.options.sessions.getOrCreate(sessionId);
    this.options.sessions.appendEvent(session, {
      type,
      data: {
        request: structuredClone(request),
      },
    });
    this.options.sessions.save(session);
    this.options.onSessionUpdated?.(sessionId);
  };
}
