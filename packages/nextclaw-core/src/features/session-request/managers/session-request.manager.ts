import { randomUUID } from "node:crypto";
import type { SessionManager } from "../../session/managers/session.manager.js";
import {
  buildSessionRequestToolResult,
  readOptionalString,
  readParentSessionId,
  summarizeSessionRequestTask,
} from "../utils/session-request-result.utils.js";
import {
  createCompletedSessionRequest,
  createFailedSessionRequest,
  createRunningSessionRequest,
} from "../utils/session-request-record.utils.js";
import type {
  DispatchRequestParams,
  PublishRequestOutcomeParams,
  RequestSessionParams,
  SessionRequestDispatcher,
  SessionRequestExecutionParams,
  SpawnSessionAndRequestParams,
} from "../types/session-request-manager.types.js";
import type {
  SessionRequestRecord,
  SessionRequestToolResult,
} from "../types/session-request.types.js";

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
    const targetSummary = await this.options.dispatcher.getSession(normalizedTargetSessionId);
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
      spawnedByRequestId,
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
    await this.options.dispatcher.publishOutcome({
      request,
      result,
    });
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
      const dispatchResult = await this.options.dispatcher.dispatch({
        request,
        task,
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
