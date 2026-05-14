import {
  type NcpAgentConversationStateManager,
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";
import { buildCompletedAssistantMessage } from "@/completed-assistant-message.utils.js";

export class CodexNcpRunEventEmitter {
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
    yield* this.emitEvent({
      type: NcpEventType.RunStarted,
      payload: { sessionId, messageId, runId },
    });
  };

  emitReadyMetadata = async function* (
    this: CodexNcpRunEventEmitter,
    sessionId: string,
    messageId: string,
    runId: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.emitEvent({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId,
        messageId,
        runId,
        metadata: { kind: "ready", runId, sessionId, supportsAbort: true },
      },
    });
  };

  emitRunError = async function* (
    this: CodexNcpRunEventEmitter,
    sessionId: string,
    messageId: string,
    runId: string,
    error: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.emitEvent({
      type: NcpEventType.RunError,
      payload: { sessionId, messageId, runId, error },
    });
  };

  emitRunCompleted = async function* (
    this: CodexNcpRunEventEmitter,
    sessionId: string,
    messageId: string,
    runId: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.emitEvent({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId,
        messageId,
        runId,
        metadata: { kind: "final", sessionId },
      },
    });
    yield* this.emitEvent({
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId,
        message: buildCompletedAssistantMessage({
          stateManager: this.stateManager,
          sessionId,
          messageId,
        }),
      },
    });
    yield* this.emitEvent({
      type: NcpEventType.RunFinished,
      payload: { sessionId, messageId, runId },
    });
  };
}
