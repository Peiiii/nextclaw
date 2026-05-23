import { randomUUID } from "node:crypto";
import {
  buildSessionRequestToolResult,
  readOptionalString,
  readParentSessionId,
  summarizeSessionRequestTask,
  createCompletedSessionRequest,
  createFailedSessionRequest,
  createRunningSessionRequest,
  type DispatchRequestParams,
  type RequestSessionParams,
  type SessionRequestDispatcher,
  type SessionRequestPayload,
  type SessionRequestRecord,
  type SessionRequestResultContext,
  type SessionRequestToolResult,
  type SpawnSessionAndRequestParams,
} from "@nextclaw/core";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import type { NcpSessionManager } from "@kernel/managers/ncp-session.manager.js";
import {
  NCP_SESSION_REQUEST_ACCEPTED_EVENT_TYPE,
  NCP_SESSION_REQUEST_COMPLETED_EVENT_TYPE,
  NCP_SESSION_REQUEST_FAILED_EVENT_TYPE,
  type NcpSessionRequestJournalEvent,
  type NcpSessionRequestJournalEventType,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";

export type SessionRequestManagerOptions = {
  dispatcher: SessionRequestDispatcher;
  ncpSessionManager: NcpSessionManager;
};

function readRecordLabel(record: AgentSessionRecord): string | undefined {
  return readOptionalString(record.metadata?.label) ?? undefined;
}

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
    const createdSession = await this.options.ncpSessionManager.createSession({
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
    const targetSession = await this.options.ncpSessionManager.getSessionRecord(normalizedTargetSessionId);
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
        readRecordLabel(targetSession) ??
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

  private appendRequestEvents = async (
    request: SessionRequestRecord,
    type: NcpSessionRequestJournalEventType,
  ): Promise<void> => {
    await this.appendRequestEvent(request.sourceSessionId, type, request);
    await this.appendRequestEvent(request.targetSessionId, type, request);
  };

  private runRequest = async (
    payload: SessionRequestPayload,
  ): Promise<SessionRequestToolResult> => {
    const { request, resultContext } = payload;
    const acceptedWrites: Promise<void>[] = [];
    try {
      const dispatchResult = await this.options.dispatcher.dispatch({
        request,
        task: resultContext.task,
        onAccepted: (messageId) => {
          acceptedWrites.push(this.appendAcceptedRequestEvent(request, messageId));
        },
      });
      await Promise.all(acceptedWrites);
      const completedRequest = createCompletedSessionRequest({
        request,
        finalResponseMessageId: dispatchResult.finalResponseMessageId,
        finalResponseText: dispatchResult.finalResponseText,
      });
      await this.appendRequestEvents(completedRequest, NCP_SESSION_REQUEST_COMPLETED_EVENT_TYPE);
      return this.buildToolResult(this.toSessionRequestPayload(completedRequest, resultContext));
    } catch (error) {
      await Promise.all(acceptedWrites);
      const failedRequest = createFailedSessionRequest({
        request,
        error,
      });
      await this.appendRequestEvents(failedRequest, NCP_SESSION_REQUEST_FAILED_EVENT_TYPE);
      return this.buildToolResult(this.toSessionRequestPayload(failedRequest, resultContext));
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

  private appendAcceptedRequestEvent = async (
    request: SessionRequestRecord,
    messageId: string,
  ): Promise<void> => {
    const acceptedRequest: SessionRequestRecord = {
      ...request,
      targetMessageId: messageId,
    };
    await this.appendRequestEvent(request.sourceSessionId, NCP_SESSION_REQUEST_ACCEPTED_EVENT_TYPE, acceptedRequest);
    await this.appendRequestEvent(request.targetSessionId, NCP_SESSION_REQUEST_ACCEPTED_EVENT_TYPE, acceptedRequest);
  };

  private appendRequestEvent = async (
    sessionId: string,
    type: NcpSessionRequestJournalEventType,
    request: SessionRequestRecord,
  ): Promise<void> => {
    const record = await this.options.ncpSessionManager.getSessionRecord(sessionId);
    const now = new Date().toISOString();
    const event: NcpSessionRequestJournalEvent = {
      type,
      payload: {
        sessionId,
        request: structuredClone(request),
      },
    };
    await this.options.ncpSessionManager.appendSessionEvent({
      session: {
        sessionId,
        ...(record?.agentId ? { agentId: record.agentId } : {}),
        createdAt: record?.createdAt ?? now,
        updatedAt: now,
        metadata: structuredClone(record?.metadata ?? {}),
      },
      event,
      updatedAt: now,
    });
  };
}
