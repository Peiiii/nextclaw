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
  type SessionRequestSourceNotifier,
  type SpawnSessionAndRequestParams,
} from "@nextclaw/core";
import type { AgentSessionRecord } from "@nextclaw/ncp-toolkit";
import { NcpEventType, type NcpRunTriggerInput } from "@nextclaw/ncp";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import {
  NCP_SESSION_REQUEST_ACCEPTED_EVENT_TYPE,
  NCP_SESSION_REQUEST_COMPLETED_EVENT_TYPE,
  NCP_SESSION_REQUEST_FAILED_EVENT_TYPE,
  type NcpSessionRequestJournalEvent,
  type NcpSessionRequestJournalEventType,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";

export type SessionRequestManagerOptions = {
  dispatcher: SessionRequestDispatcher;
  notifySourceSession?: SessionRequestSourceNotifier;
  sessionManager: SessionManager;
};

function readRecordLabel(record: AgentSessionRecord): string | undefined {
  return readOptionalString(record.metadata?.label) ?? undefined;
}

function resolveRequestTrigger(params: {
  trigger?: NcpRunTriggerInput;
  sourceSessionId: string;
  requestId: string;
}): NcpRunTriggerInput {
  return {
    ...(params.trigger ?? {
      actor: "system",
      source: "session-request",
      triggeredAt: new Date().toISOString(),
      sourceSessionId: params.sourceSessionId,
    }),
    sourceRequestId: params.requestId,
  };
}

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
      contextInheritance,
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
      wait,
      trigger: requestedTrigger,
    } = params;
    const requestId = randomUUID();
    const trigger = resolveRequestTrigger({
      trigger: requestedTrigger,
      sourceSessionId,
      requestId,
    });
    const createdSession = await this.options.sessionManager.createSession({
      sourceSessionId,
      ...(parentSessionId ? { parentSessionId } : {}),
      task,
      title,
      sourceSessionMetadata,
      metadataOverrides: {
        ...(metadataOverrides ?? {}),
        session_creation_trigger: structuredClone(trigger),
      },
      contextInheritance,
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
      wait,
      agentId: createdSession.agentId,
      isChildSession: Boolean(parentSessionId),
      ...(parentSessionId ? { parentSessionId } : {}),
      spawnedByRequestId: requestId,
      trigger,
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
      wait,
      handoffDepth,
      trigger: requestedTrigger,
    } = params;
    const normalizedTargetSessionId = targetSessionId.trim();

    if (normalizedTargetSessionId === sourceSessionId.trim()) {
      throw new Error("sessions_request cannot target the current session.");
    }
    const targetSession = await this.options.sessionManager.getSessionRecord(
      normalizedTargetSessionId,
    );
    if (!targetSession) {
      throw new Error(`Target session not found: ${targetSessionId}`);
    }
    const parentSessionId = readParentSessionId(targetSession.metadata);
    const requestId = randomUUID();
    const trigger = resolveRequestTrigger({
      trigger: requestedTrigger,
      sourceSessionId,
      requestId,
    });

    return this.dispatchRequest({
      requestId,
      sourceSessionId,
      sourceToolCallId,
      targetSessionId: normalizedTargetSessionId,
      task,
      title:
        readOptionalString(title) ??
        readRecordLabel(targetSession) ??
        summarizeSessionRequestTask(task),
      handoffDepth: handoffDepth ?? 0,
      notify,
      wait,
      agentId: targetSession.agentId,
      isChildSession: Boolean(parentSessionId),
      parentSessionId: parentSessionId ?? undefined,
      spawnedByRequestId: undefined,
      trigger,
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
      wait,
      agentId,
      isChildSession,
      parentSessionId,
      spawnedByRequestId,
      trigger,
    } = params;
    const request = createRunningSessionRequest({
      requestId,
      sourceSessionId,
      targetSessionId,
      sourceToolCallId,
      handoffDepth,
      notify,
      wait,
      title,
      task,
      isChildSession,
      parentSessionId,
      trigger,
    });
    const resultContext: SessionRequestResultContext = {
      task,
      title,
      agentId,
      isChildSession,
      parentSessionId,
      spawnedByRequestId,
    };
    const payload = this.toSessionRequestPayload(request, resultContext);

    if (wait === "final_reply") {
      return await this.runRequest(payload);
    }

    void this.runRequestAndDeliverOutcome(payload);

    return this.buildToolResult({
      ...payload,
      message:
        notify === "final_reply"
          ? "Session request started. This session will be notified when it finishes."
          : "Session request started and will run independently.",
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
          acceptedWrites.push(
            this.appendAcceptedRequestEvent(request, messageId),
          );
        },
      });
      await Promise.all(acceptedWrites);
      const completedRequest = createCompletedSessionRequest({
        request,
        finalResponseMessageId: dispatchResult.finalResponseMessageId,
        finalResponseText: dispatchResult.finalResponseText,
      });
      await this.appendRequestEvents(
        completedRequest,
        NCP_SESSION_REQUEST_COMPLETED_EVENT_TYPE,
      );
      return this.buildToolResult(
        this.toSessionRequestPayload(completedRequest, resultContext),
      );
    } catch (error) {
      await Promise.all(acceptedWrites);
      const failedRequest = createFailedSessionRequest({
        request,
        error,
      });
      await this.appendRequestEvents(
        failedRequest,
        NCP_SESSION_REQUEST_FAILED_EVENT_TYPE,
      );
      return this.buildToolResult(
        this.toSessionRequestPayload(failedRequest, resultContext),
      );
    }
  };

  private runRequestAndDeliverOutcome = async (
    payload: SessionRequestPayload,
  ): Promise<void> => {
    let result: SessionRequestToolResult;
    try {
      result = await this.runRequest(payload);
    } catch (error) {
      console.error(
        `[session-request] Background request ${payload.request.requestId} crashed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    try {
      await this.updateSourceToolResult(payload.request, result);
    } catch (error) {
      console.error(
        `[session-request] Failed to update tool result for ${payload.request.requestId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    if (payload.request.notify === "final_reply") {
      try {
        await this.options.notifySourceSession?.({
          request: payload.request,
          result,
        });
      } catch (error) {
        console.error(
          `[session-request] Failed to notify source session for ${payload.request.requestId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  };

  private updateSourceToolResult = async (
    request: SessionRequestRecord,
    result: SessionRequestToolResult,
  ): Promise<void> => {
    if (!request.sourceToolCallId) {
      return;
    }
    await this.options.sessionManager.publishSessionEvent({
      sessionId: request.sourceSessionId,
      synchronizeMessageProjection: true,
      source: "session-request-completion",
      event: {
        type: NcpEventType.MessageToolCallResult,
        payload: {
          sessionId: request.sourceSessionId,
          toolCallId: request.sourceToolCallId,
          content: result,
          contentItems: [{ type: "input_text", text: JSON.stringify(result) }],
          final: true,
        },
      },
    });
  };

  private appendAcceptedRequestEvent = async (
    request: SessionRequestRecord,
    messageId: string,
  ): Promise<void> => {
    const acceptedRequest: SessionRequestRecord = {
      ...request,
      targetMessageId: messageId,
    };
    await this.appendRequestEvent(
      request.sourceSessionId,
      NCP_SESSION_REQUEST_ACCEPTED_EVENT_TYPE,
      acceptedRequest,
    );
    await this.appendRequestEvent(
      request.targetSessionId,
      NCP_SESSION_REQUEST_ACCEPTED_EVENT_TYPE,
      acceptedRequest,
    );
  };

  private appendRequestEvent = async (
    sessionId: string,
    type: NcpSessionRequestJournalEventType,
    request: SessionRequestRecord,
  ): Promise<void> => {
    const event: NcpSessionRequestJournalEvent = {
      type,
      payload: {
        sessionId,
        request: structuredClone(request),
      },
    };
    await this.options.sessionManager.appendSessionEvent({
      sessionId,
      event,
    });
  };
}
