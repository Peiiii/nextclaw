import {
  createNcpEndpointEvent,
  type NcpAgentConversationStateManager,
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";
import { buildCompletedAssistantMessage } from "@/completed-assistant-message.utils.js";

export class CodexNcpRunEventEmitter {
  private readonly runStartedAtByRunId = new Map<string, string>();

  constructor(private readonly stateManager?: NcpAgentConversationStateManager) {}

  emitEvent = async function* (
    this: CodexNcpRunEventEmitter,
    event: NcpEndpointEvent,
  ): AsyncGenerator<NcpEndpointEvent> {
    await this.stateManager?.dispatch(event);
    yield event;
  };

  emitRunStarted = async function* (
    this: CodexNcpRunEventEmitter,
    sessionId: string,
    messageId: string,
    runId: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    const startedAt = new Date().toISOString();
    this.runStartedAtByRunId.set(runId, startedAt);
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.RunStarted,
      payload: { sessionId, messageId, runId, startedAt },
    }, startedAt));
  };

  emitReadyMetadata = async function* (
    this: CodexNcpRunEventEmitter,
    sessionId: string,
    messageId: string,
    runId: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId,
        messageId,
        runId,
        metadata: { kind: "ready", runId, sessionId, supportsAbort: true },
      },
    }));
  };

  emitRunError = async function* (
    this: CodexNcpRunEventEmitter,
    sessionId: string,
    messageId: string,
    runId: string,
    error: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    const endedAt = new Date().toISOString();
    const startedAt = this.runStartedAtByRunId.get(runId);
    this.runStartedAtByRunId.delete(runId);
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.RunError,
      payload: { sessionId, messageId, runId, error, startedAt, endedAt },
    }, endedAt));
  };

  emitRunCompleted = async function* (
    this: CodexNcpRunEventEmitter,
    sessionId: string,
    messageId: string,
    runId: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId,
        messageId,
        runId,
        metadata: { kind: "final", sessionId },
      },
    }));
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId,
        message: buildCompletedAssistantMessage({
          stateManager: this.stateManager,
          sessionId,
          messageId,
        }),
      },
    }));
    const endedAt = new Date().toISOString();
    const startedAt = this.runStartedAtByRunId.get(runId);
    this.runStartedAtByRunId.delete(runId);
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.RunFinished,
      payload: { sessionId, messageId, runId, startedAt, endedAt },
    }, endedAt));
  };
}
