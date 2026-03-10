import { EventType, type AgentEvent, type IAgent, type RunAgentInput } from '@nextclaw/agent-chat';
import { Observable, type Subscribable } from 'rxjs';
import {
  buildDeltaEvents,
  buildDeltaMessageId,
  buildSessionEventEvents,
  isAssistantSessionEvent,
  shouldCloseDeltaOnSessionEvent
} from './stream-event-adapter';
import { openResumeRunStream, openSendTurnStream, requestStopRun } from './transport';
import type {
  ActiveRunState,
  NextbotAgentRunMetadata,
  StreamDeltaEvent,
  StreamReadyEvent,
  StreamSessionEvent
} from './types';
import { isAbortLikeError } from '@/lib/chat-runtime-utils';

type SendRunMetadata = Extract<NextbotAgentRunMetadata, { mode: 'send' }>;
type ResumeRunMetadata = Extract<NextbotAgentRunMetadata, { mode: 'resume' }>;
type StreamResult = { sessionKey: string; reply: string };
type EmitEvent = (event: AgentEvent) => void;
type StreamRuntimeState = {
  deltaMessageId: string;
  deltaStarted: boolean;
  deltaClosed: boolean;
  hasAssistantSessionEvent: boolean;
  hasAssistantOutput: boolean;
};
type RunObservableParams = {
  metadata: NextbotAgentRunMetadata;
  clientRunId: string;
  abortController: AbortController;
  runState: ActiveRunState;
};

function createBackendRunId(): string {
  const now = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `run-${now}-${rand}`;
}

export type NextbotRunMetadataPayload =
  | {
      driver: 'nextbot-stream';
      kind: 'ready';
      sessionKey?: string;
      backendRunId?: string;
      stopSupported?: boolean;
      stopReason?: string;
      requestedAt?: string;
    }
  | {
      driver: 'nextbot-stream';
      kind: 'final';
      sessionKey: string;
      reply: string;
      hasAssistantSessionEvent: boolean;
    };

function readRunMetadata(input: RunAgentInput): NextbotAgentRunMetadata | null {
  const raw = input.metadata;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (record.driver !== 'nextbot-stream') {
    return null;
  }
  const mode = record.mode;
  if (mode === 'send') {
    const payload = record.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    const requestedSkills = Array.isArray(record.requestedSkills)
      ? record.requestedSkills.filter((item): item is string => typeof item === 'string')
      : [];
    return {
      driver: 'nextbot-stream',
      mode: 'send',
      payload: payload as SendRunMetadata['payload'],
      requestedSkills
    };
  }
  if (mode === 'resume') {
    const runId = typeof record.runId === 'string' ? record.runId.trim() : '';
    if (!runId) {
      return null;
    }
    const fromEventIndex =
      typeof record.fromEventIndex === 'number' && Number.isFinite(record.fromEventIndex)
        ? Math.max(0, Math.trunc(record.fromEventIndex))
        : undefined;
    const sessionKey = typeof record.sessionKey === 'string' ? record.sessionKey.trim() : '';
    const agentId = typeof record.agentId === 'string' ? record.agentId.trim() : '';
    const stopSupported = typeof record.stopSupported === 'boolean' ? record.stopSupported : undefined;
    const stopReason = typeof record.stopReason === 'string' ? record.stopReason.trim() : '';
    return {
      driver: 'nextbot-stream',
      mode: 'resume',
      runId,
      ...(typeof fromEventIndex === 'number' ? { fromEventIndex } : {}),
      ...(sessionKey ? { sessionKey } : {}),
      ...(agentId ? { agentId } : {}),
      ...(typeof stopSupported === 'boolean' ? { stopSupported } : {}),
      ...(stopReason ? { stopReason } : {})
    };
  }
  return null;
}

function buildInitialRunState(metadata: NextbotAgentRunMetadata): ActiveRunState {
  if (metadata.mode === 'send') {
    const backendRunId = metadata.payload.runId?.trim() || '';
    return {
      localRunId: 0,
      sessionKey: metadata.payload.sessionKey,
      ...(metadata.payload.agentId ? { agentId: metadata.payload.agentId } : {}),
      ...(backendRunId ? { backendRunId } : {}),
      backendStopSupported: Boolean(metadata.payload.stopSupported),
      ...(metadata.payload.stopReason ? { backendStopReason: metadata.payload.stopReason } : {})
    };
  }
  return {
    localRunId: 0,
    sessionKey: metadata.sessionKey ?? '',
    ...(metadata.agentId ? { agentId: metadata.agentId } : {}),
    backendRunId: metadata.runId,
    backendStopSupported: Boolean(metadata.stopSupported),
    ...(metadata.stopReason ? { backendStopReason: metadata.stopReason } : {})
  };
}

function withEnsuredSendRunId(metadata: NextbotAgentRunMetadata): NextbotAgentRunMetadata {
  if (metadata.mode !== 'send') {
    return metadata;
  }
  const runId = metadata.payload.runId?.trim();
  if (runId) {
    return metadata;
  }
  return {
    ...metadata,
    payload: {
      ...metadata.payload,
      runId: createBackendRunId()
    }
  };
}

function updateRunStateFromReady(runState: ActiveRunState, event: {
  sessionKey?: string;
  runId?: string;
  stopSupported?: boolean;
  stopReason?: string;
}) {
  runState.backendRunId = event.runId?.trim() || runState.backendRunId;
  runState.backendStopSupported =
    typeof event.stopSupported === 'boolean' ? event.stopSupported : runState.backendStopSupported;
  if (event.stopReason?.trim()) {
    runState.backendStopReason = event.stopReason.trim();
  }
  if (event.sessionKey?.trim()) {
    runState.sessionKey = event.sessionKey.trim();
  }
}

function createStreamRuntimeState(): StreamRuntimeState {
  return {
    deltaMessageId: buildDeltaMessageId(),
    deltaStarted: false,
    deltaClosed: false,
    hasAssistantSessionEvent: false,
    hasAssistantOutput: false
  };
}

function buildReadyMetadata(event: StreamReadyEvent): NextbotRunMetadataPayload {
  return {
    driver: 'nextbot-stream',
    kind: 'ready',
    ...(event.sessionKey?.trim() ? { sessionKey: event.sessionKey.trim() } : {}),
    ...(event.runId?.trim() ? { backendRunId: event.runId.trim() } : {}),
    ...(typeof event.stopSupported === 'boolean' ? { stopSupported: event.stopSupported } : {}),
    ...(event.stopReason?.trim() ? { stopReason: event.stopReason.trim() } : {}),
    ...(event.requestedAt ? { requestedAt: event.requestedAt } : {})
  };
}

function buildFinalMetadata(result: StreamResult, hasAssistantSessionEvent: boolean): NextbotRunMetadataPayload {
  return {
    driver: 'nextbot-stream',
    kind: 'final',
    sessionKey: result.sessionKey,
    reply: result.reply,
    hasAssistantSessionEvent
  };
}

function emitRunMetadata(emit: EmitEvent, clientRunId: string, metadata: NextbotRunMetadataPayload) {
  emit({
    type: EventType.RUN_METADATA,
    runId: clientRunId,
    metadata
  });
}

function closeDelta(runtime: StreamRuntimeState, emit: EmitEvent) {
  if (!runtime.deltaStarted || runtime.deltaClosed) {
    return;
  }
  emit({ type: EventType.TEXT_END, messageId: runtime.deltaMessageId });
  runtime.deltaClosed = true;
}

function handleDelta(runtime: StreamRuntimeState, emit: EmitEvent, event: StreamDeltaEvent) {
  const events = buildDeltaEvents({
    messageId: runtime.deltaMessageId,
    delta: event.delta,
    started: runtime.deltaStarted
  });
  if (events.length > 0) {
    runtime.deltaStarted = true;
    runtime.deltaClosed = false;
    runtime.hasAssistantOutput = true;
  }
  for (const streamEvent of events) {
    emit(streamEvent);
  }
}

function handleSession(runtime: StreamRuntimeState, emit: EmitEvent, event: StreamSessionEvent) {
  if (shouldCloseDeltaOnSessionEvent(event.data)) {
    closeDelta(runtime, emit);
    runtime.deltaMessageId = buildDeltaMessageId();
    runtime.deltaStarted = false;
    runtime.deltaClosed = false;
  }
  if (isAssistantSessionEvent(event.data)) {
    runtime.hasAssistantSessionEvent = true;
  }
  for (const streamEvent of buildSessionEventEvents({
    event: event.data,
    messageId: runtime.deltaMessageId
  })) {
    emit(streamEvent);
  }
}

function emitFallbackReplyIfNeeded(runtime: StreamRuntimeState, emit: EmitEvent, reply: string) {
  const fallbackText = reply.trim();
  if (runtime.hasAssistantOutput || !fallbackText) {
    return;
  }
  const fallbackMessageId = buildDeltaMessageId();
  emit({ type: EventType.TEXT_START, messageId: fallbackMessageId });
  emit({ type: EventType.TEXT_DELTA, messageId: fallbackMessageId, delta: fallbackText });
  emit({ type: EventType.TEXT_END, messageId: fallbackMessageId });
}

export class NextbotRuntimeAgent implements IAgent {
  private activeAbortController: AbortController | null = null;
  private activeRunState: ActiveRunState | null = null;

  private buildMissingMetadataObservable = (clientRunId: string): Observable<AgentEvent> =>
    new Observable<AgentEvent>((subscriber) => {
      subscriber.next({
        type: EventType.RUN_ERROR,
        runId: clientRunId,
        error: 'nextbot runtime metadata is required'
      });
      subscriber.complete();
    });

  private openRunStream = (params: {
    metadata: NextbotAgentRunMetadata;
    signal: AbortSignal;
    onReady: (event: StreamReadyEvent) => void;
    onDelta: (event: StreamDeltaEvent) => void;
    onSessionEvent: (event: StreamSessionEvent) => void;
  }): Promise<StreamResult> => {
    const { metadata, signal, onReady, onDelta, onSessionEvent } = params;
    if (metadata.mode === 'send') {
      return openSendTurnStream({
        item: metadata.payload,
        requestedSkills: metadata.requestedSkills,
        signal,
        onReady,
        onDelta,
        onSessionEvent
      });
    }
    return openResumeRunStream({
      runId: (metadata as ResumeRunMetadata).runId,
      fromEventIndex: (metadata as ResumeRunMetadata).fromEventIndex,
      signal,
      onReady,
      onDelta,
      onSessionEvent
    });
  };

  private finalizeRunState = (abortController: AbortController, runState: ActiveRunState) => {
    if (this.activeAbortController === abortController) {
      this.activeAbortController = null;
    }
    if (this.activeRunState === runState) {
      this.activeRunState = null;
    }
  };

  private createRunObservable = ({
    metadata,
    clientRunId,
    abortController,
    runState
  }: RunObservableParams): Observable<AgentEvent> =>
    new Observable<AgentEvent>((subscriber) => {
      const runtime = createStreamRuntimeState();
      let disposed = false;
      const emit: EmitEvent = (event) => {
        if (!disposed) {
          subscriber.next(event);
        }
      };

      emit({ type: EventType.RUN_STARTED, runId: clientRunId });

      const streamTask = this.openRunStream({
        metadata,
        signal: abortController.signal,
        onReady: (event) => {
          if (this.activeRunState) {
            updateRunStateFromReady(this.activeRunState, event);
          }
          emitRunMetadata(emit, clientRunId, buildReadyMetadata(event));
        },
        onDelta: (event) => {
          handleDelta(runtime, emit, event);
        },
        onSessionEvent: (event) => {
          handleSession(runtime, emit, event);
        }
      });

      void streamTask
        .then((result) => {
          closeDelta(runtime, emit);
          emitFallbackReplyIfNeeded(runtime, emit, result.reply);
          emitRunMetadata(emit, clientRunId, buildFinalMetadata(result, runtime.hasAssistantSessionEvent));
          emit({
            type: EventType.RUN_FINISHED,
            runId: clientRunId
          });
          subscriber.complete();
        })
        .catch((error) => {
          closeDelta(runtime, emit);
          if (!isAbortLikeError(error)) {
            emit({
              type: EventType.RUN_ERROR,
              runId: clientRunId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          subscriber.complete();
        })
        .finally(() => {
          this.finalizeRunState(abortController, runState);
        });

      return () => {
        disposed = true;
        abortController.abort();
        if (this.activeAbortController === abortController) {
          this.activeAbortController = null;
        }
      };
    });

  abortRun = () => {
    const activeRunState = this.activeRunState;
    if (activeRunState?.backendStopSupported) {
      void requestStopRun(activeRunState);
    }
    this.activeAbortController?.abort();
    this.activeAbortController = null;
    this.activeRunState = null;
  };

  run = (input: RunAgentInput): Subscribable<AgentEvent> => {
    const metadata = readRunMetadata(input);
    const clientRunId = typeof input.runId === 'string' && input.runId.trim() ? input.runId : `run-${Date.now()}`;
    if (!metadata) {
      return this.buildMissingMetadataObservable(clientRunId);
    }

    const normalizedMetadata = withEnsuredSendRunId(metadata);
    this.abortRun();
    const abortController = new AbortController();
    this.activeAbortController = abortController;
    const runState = buildInitialRunState(normalizedMetadata);
    this.activeRunState = runState;
    return this.createRunObservable({
      metadata: normalizedMetadata,
      clientRunId,
      abortController,
      runState
    });
  };
}
