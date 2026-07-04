import {
  createNcpEndpointEvent,
  NcpEventType,
  type NcpEndpointEvent,
  type NcpError,
  type NcpMessage,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import type { HermesHttpAdapterRun } from "./hermes-http-adapter.types.js";

export function createHermesRunHandle(run: HermesHttpAdapterRun): NcpRunHandle {
  const handle: NcpRunHandle = {
    sessionId: run.envelope.sessionId,
    userMessageId: run.envelope.message.id,
    assistantMessageId: run.messageId,
    runId: run.runId,
  };
  if (run.envelope.correlationId) {
    handle.correlationId = run.envelope.correlationId;
  }
  return handle;
}

export function createHermesMessageAcceptedEvent(run: HermesHttpAdapterRun): NcpEndpointEvent {
  return createNcpEndpointEvent({
    type: NcpEventType.MessageAccepted,
    payload: {
      messageId: run.messageId,
      correlationId: run.envelope.correlationId,
    },
  });
}

export function createHermesRunStartedEvent(params: {
  run: HermesHttpAdapterRun;
  startedAt: string;
}): NcpEndpointEvent {
  const { run, startedAt } = params;
  return createNcpEndpointEvent({
    type: NcpEventType.RunStarted,
    payload: {
      sessionId: run.envelope.sessionId,
      messageId: run.messageId,
      runId: run.runId,
      startedAt,
    },
  }, startedAt);
}

export function createHermesMessageCompletedEvent(params: {
  message: NcpMessage;
  metadata: Record<string, unknown>;
  run: HermesHttpAdapterRun;
}): NcpEndpointEvent {
  const { message, metadata, run } = params;
  return createNcpEndpointEvent({
    type: NcpEventType.MessageCompleted,
    payload: {
      sessionId: run.envelope.sessionId,
      message,
      correlationId: run.envelope.correlationId,
      metadata,
    },
  });
}

export function createHermesRunFinishedEvent(params: {
  endedAt: string;
  run: HermesHttpAdapterRun;
  startedAt: string;
}): NcpEndpointEvent {
  const { endedAt, run, startedAt } = params;
  return createNcpEndpointEvent({
    type: NcpEventType.RunFinished,
    payload: {
      sessionId: run.envelope.sessionId,
      messageId: run.messageId,
      runId: run.runId,
      startedAt,
      endedAt,
    },
  }, endedAt);
}

export function createHermesMessageFailedEvent(params: {
  error: NcpError;
  run: HermesHttpAdapterRun;
}): NcpEndpointEvent {
  const { error, run } = params;
  return createNcpEndpointEvent({
    type: NcpEventType.MessageFailed,
    payload: {
      sessionId: run.envelope.sessionId,
      messageId: run.messageId,
      correlationId: run.envelope.correlationId,
      error,
    },
  });
}

export function createHermesRunErrorEvent(params: {
  endedAt: string;
  error: NcpError;
  run: HermesHttpAdapterRun;
  startedAt: string;
}): NcpEndpointEvent {
  const { endedAt, error, run, startedAt } = params;
  return createNcpEndpointEvent({
    type: NcpEventType.RunError,
    payload: {
      sessionId: run.envelope.sessionId,
      messageId: run.messageId,
      runId: run.runId,
      error: error.message,
      startedAt,
      endedAt,
    },
  }, endedAt);
}
