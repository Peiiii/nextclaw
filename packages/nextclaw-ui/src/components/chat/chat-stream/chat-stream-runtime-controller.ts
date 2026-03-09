import { BehaviorSubject } from 'rxjs';
import type { ChatRunView, SessionEventView } from '@/api/types';
import { ChatStreamFlowController } from './chat-stream-flow-controller';
import type {
  ActiveRunState,
  PendingChatMessage,
  QueueSetState,
  RunContext,
  RunSend,
  SendMessageParams,
  StopCurrentRun,
  StreamSetters,
  UseChatStreamControllerParams,
} from './types';
import type { SetStateAction } from 'react';

type ChatStreamRuntimeState = {
  optimisticUserEvent: SessionEventView | null;
  streamingSessionEvents: SessionEventView[];
  streamingAssistantText: string;
  streamingAssistantTimestamp: string | null;
  activeBackendRunId: string | null;
  isSending: boolean;
  isAwaitingAssistantOutput: boolean;
  queuedMessages: PendingChatMessage[];
  canStopCurrentRun: boolean;
  stopDisabledReason: string | null;
  lastSendError: string | null;
};

const INITIAL_STATE: ChatStreamRuntimeState = {
  optimisticUserEvent: null,
  streamingSessionEvents: [],
  streamingAssistantText: '',
  streamingAssistantTimestamp: null,
  activeBackendRunId: null,
  isSending: false,
  isAwaitingAssistantOutput: false,
  queuedMessages: [],
  canStopCurrentRun: false,
  stopDisabledReason: null,
  lastSendError: null
};

function resolveSetStateValue<T>(prev: T, next: SetStateAction<T>): T {
  if (typeof next === 'function') {
    return (next as (value: T) => T)(prev);
  }
  return next;
}

export class ChatStreamRuntimeController {
  readonly state$ = new BehaviorSubject<ChatStreamRuntimeState>(INITIAL_STATE);
  private readonly flowController: ChatStreamFlowController;

  private readonly runIdRef = { current: 0 };
  private readonly queueIdRef = { current: 0 };
  private readonly activeRunRef = { current: null as ActiveRunState | null };

  private queuePumpRunning = false;
  private disposed = false;

  private params: UseChatStreamControllerParams;

  constructor(params: UseChatStreamControllerParams) {
    this.params = params;
    this.flowController = new ChatStreamFlowController({
      getContext: this.resolveContext,
      getIsSending: () => this.getSnapshot().isSending,
      queueIdRef: this.queueIdRef,
      activeRunRef: this.activeRunRef,
      setQueuedMessages: this.setQueuedMessages,
      runSend: this.runSend,
      stopCurrentRun: this.stopCurrentRun,
      setCanStopCurrentRun: this.setters.setCanStopCurrentRun,
      setLastSendError: this.setters.setLastSendError,
      setters: this.setters
    });
  }

  updateParams = (next: UseChatStreamControllerParams) => {
    this.params = next;
  };

  getSnapshot = (): ChatStreamRuntimeState => this.state$.getValue();

  subscribe = (onStoreChange: () => void) => {
    const subscription = this.state$.subscribe(() => onStoreChange());
    return () => subscription.unsubscribe();
  };

  destroy = () => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.runIdRef.current += 1;
    this.queuePumpRunning = false;
    this.activeRunRef.current?.requestAbortController.abort();
    this.activeRunRef.current = null;
    this.state$.complete();
  };

  sendMessage = async (payload: SendMessageParams) => {
    this.reconcileActiveRunRef();
    await this.flowController.executeSendMessagePolicy(payload);
    this.drainQueue();
  };

  resumeRun = async (run: ChatRunView) => {
    this.reconcileActiveRunRef();
    await this.flowController.executeResumePendingRun(run);
    this.drainQueue();
  };

  stopCurrentRun: StopCurrentRun = async (options) => {
    this.reconcileActiveRunRef();
    await this.flowController.executeStopActiveRun(options);
    this.drainQueue();
  };

  removeQueuedMessage = (id: number) => {
    this.setQueuedMessages((prev) => prev.filter((item) => item.id !== id));
  };

  promoteQueuedMessage = (id: number) => {
    this.setQueuedMessages((prev) => this.flowController.reorderQueuedMessageToFront(id, prev));
  };

  resetStreamState = () => {
    this.runIdRef.current += 1;
    this.queuePumpRunning = false;
    this.setQueuedMessages([]);
    this.activeRunRef.current?.requestAbortController.abort();
    this.activeRunRef.current = null;
    this.flowController.resetStreamingState();
  };

  private readonly runSend: RunSend = async (item, options) => {
    try {
      await this.flowController.executeSendPendingMessage(item, options);
    } finally {
      this.drainQueue();
    }
  };

  private readonly setQueuedMessages: QueueSetState = (next) => {
    this.updateField('queuedMessages', next);
    this.drainQueue();
  };

  private readonly setters: StreamSetters = {
    setOptimisticUserEvent: (next) => this.updateField('optimisticUserEvent', next),
    setStreamingSessionEvents: (next) => this.updateField('streamingSessionEvents', next),
    setStreamingAssistantText: (next) => this.updateField('streamingAssistantText', next),
    setStreamingAssistantTimestamp: (next) => this.updateField('streamingAssistantTimestamp', next),
    setActiveBackendRunId: (next) => this.updateField('activeBackendRunId', next),
    setIsSending: (next) => this.updateField('isSending', next),
    setIsAwaitingAssistantOutput: (next) => this.updateField('isAwaitingAssistantOutput', next),
    setCanStopCurrentRun: (next) => this.updateField('canStopCurrentRun', next),
    setStopDisabledReason: (next) => this.updateField('stopDisabledReason', next),
    setLastSendError: (next) => this.updateField('lastSendError', next)
  };

  private readonly resolveContext = (): RunContext => {
    return {
      params: this.params,
      runIdRef: this.runIdRef,
      activeRunRef: this.activeRunRef,
      setters: this.setters
    };
  };

  private readonly updateState = (updater: (prev: ChatStreamRuntimeState) => ChatStreamRuntimeState) => {
    if (this.disposed) {
      return;
    }
    this.state$.next(updater(this.state$.getValue()));
  };

  private readonly updateField = <K extends keyof ChatStreamRuntimeState>(
    key: K,
    next: SetStateAction<ChatStreamRuntimeState[K]>
  ) => {
    this.updateState((prev) => ({
      ...prev,
      [key]: resolveSetStateValue(prev[key], next)
    }));
  };

  private readonly drainQueue = () => {
    if (this.disposed || this.queuePumpRunning) {
      return;
    }
    this.reconcileActiveRunRef();
    const state = this.getSnapshot();
    if (state.isSending || this.activeRunRef.current || state.queuedMessages.length === 0) {
      return;
    }

    const [next, ...rest] = state.queuedMessages;
    this.queuePumpRunning = true;
    this.updateField('queuedMessages', rest);

    void this.runSend(next, { restoreDraftOnError: true }).finally(() => {
      this.queuePumpRunning = false;
      this.drainQueue();
    });
  };

  private readonly reconcileActiveRunRef = () => {
    const snapshot = this.getSnapshot();
    if (!this.activeRunRef.current) {
      return;
    }
    if (snapshot.isSending || snapshot.activeBackendRunId) {
      return;
    }
    this.activeRunRef.current = null;
    this.updateState((prev) => ({
      ...prev,
      canStopCurrentRun: false,
      stopDisabledReason: null
    }));
  };
}
