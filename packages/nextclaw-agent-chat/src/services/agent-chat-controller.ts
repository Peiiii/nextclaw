import { BehaviorSubject, Subject, type Observable, type Unsubscribable } from 'rxjs';
import { v4 } from 'uuid';
import { EventType, ToolInvocationStatus, type AgentEvent, type IAgent, type RunMetadataEvent, type ToolExecutor } from '../types/index.js';
import type { Context, ToolCall, ToolDefinition, ToolResult } from '../types/agent.js';
import type {
  ActiveRunContext,
  ResumeRunOptions,
  RunFinalInfo,
  RunLifecycleCallbacks,
  RunMetadataParsers,
  RunReadyInfo,
  SendRunOptions
} from '../types/run-lifecycle.js';
import type { UIMessage } from '../types/ui-message.js';
import { finalizePendingToolInvocations } from '../utils/ui-message.js';
import { buildLocalAssistantMessage, formatSendError, isAbortLikeError } from '../utils/run-utils.js';
import { AgentEventHandler } from './agent-event-handler.js';

export interface IAgentProvider {
  agent: IAgent;
  getToolDefs: () => ToolDefinition[];
  getContexts: () => Context[];
  getToolExecutor: (name: string) => ToolExecutor | undefined;
}

export interface AgentChatControllerOptions {
  initialMessages?: UIMessage[];
  metadataParsers?: RunMetadataParsers;
  callbacks?: RunLifecycleCallbacks;
}

type RunAgentOptions = {
  threadId?: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
  agentId?: string;
  stopCapable?: boolean;
  stopReason?: string;
  sourceMessage?: string;
  restoreDraftOnError?: boolean;
};

export class Disposable {
  private disposables: (() => void)[] = [];

  addDisposable = (disposable: () => void) => {
    this.disposables.push(disposable);
  };

  dispose = () => {
    this.disposables.forEach((disposable) => disposable());
    this.disposables = [];
  };
}

export class AgentChatController extends Disposable {
  _messages$ = new BehaviorSubject<UIMessage[]>([]);

  messages$: Observable<UIMessage[]>;

  threadId$ = new BehaviorSubject<string | null>(null);

  isAgentResponding$ = new BehaviorSubject<boolean>(false);

  activeRun$ = new BehaviorSubject<ActiveRunContext | null>(null);

  lastError$ = new BehaviorSubject<string | null>(null);

  isAwaitingResponse$ = new BehaviorSubject<boolean>(false);

  runCompleted$ = new Subject<{ runId: string }>();

  runError$ = new Subject<{ runId: string; error: unknown; isAbort: boolean }>();

  runMetadata$ = new Subject<{ runId: string; metadata: Record<string, unknown> }>();

  private activeSubscription: Unsubscribable | null = null;

  addMessagesEvent$ = new Subject<{ messages: UIMessage[] }>();

  updateMessageEvent$ = new Subject<{ message: UIMessage }>();

  setMessagesEvent$ = new Subject<{ messages: UIMessage[] }>();

  toolCall$ = new Subject<{ toolCall: ToolCall }>();

  private eventHandler: AgentEventHandler = new AgentEventHandler(this);

  private runIdCounter = 0;
  private metadataParsers: RunMetadataParsers | null;
  private callbacks: RunLifecycleCallbacks;

  constructor(private readonly agentProvider: IAgentProvider | null = null, options?: AgentChatControllerOptions) {
    super();
    const { initialMessages = [], metadataParsers, callbacks = {} } = options || {};
    this.metadataParsers = metadataParsers ?? null;
    this.callbacks = callbacks;
    this._messages$.next(initialMessages);
    this.messages$ = this._messages$.asObservable();
    if (this.agentProvider) {
      this.addDisposable(this.connectToolExecutor());
    }
  }

  getMessages = () => {
    return this._messages$.getValue();
  };

  setMessages = (messages: UIMessage[]): void => {
    this._messages$.next(messages);
    this.setMessagesEvent$.next({ messages });
  };

  handleEvent = (event: AgentEvent) => {
    this.eventHandler.handleEvent(event);
  };

  setCallbacks = (callbacks: RunLifecycleCallbacks) => {
    this.callbacks = callbacks;
  };

  reset = () => {
    this.abortAgentRun();
    this._messages$.next([]);
    this.eventHandler.reset();
    this.threadId$.next(null);
    this.isAgentResponding$.next(false);
    this.activeRun$.next(null);
    this.lastError$.next(null);
    this.isAwaitingResponse$.next(false);
    this.runIdCounter += 1;
  };

  addMessages = (messages: UIMessage[]) => {
    const current = this.getMessages();
    const next = [...current];
    for (const message of messages) {
      const existingIndex = next.findIndex((item) => item.id === message.id);
      if (existingIndex >= 0) {
        next[existingIndex] = message;
      } else {
        next.push(message);
      }
    }
    this._messages$.next(next);
    this.addMessagesEvent$.next({ messages });
    if (this.isAwaitingResponse$.getValue() && messages.some((m) => m.role === 'assistant')) {
      this.isAwaitingResponse$.next(false);
    }
  };

  removeMessages = (messageIds: string[]) => {
    if (messageIds.length === 0) return;
    this._messages$.next(this.getMessages().filter((msg) => !messageIds.includes(msg.id)));
  };

  updateMessage = (message: UIMessage) => {
    this._messages$.next(this.getMessages().map((msg) => (msg.id === message.id ? message : msg)));
    this.updateMessageEvent$.next({ message });
    if (this.isAwaitingResponse$.getValue() && message.role === 'assistant') {
      this.isAwaitingResponse$.next(false);
    }
  };

  addToolResult = (result: ToolResult, _options?: { triggerAgent?: boolean }): void => {
    const targetMessage = this.getMessages().find((msg) =>
      msg.parts.find(
        (part) => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === result.toolCallId
      )
    );
    if (!targetMessage) {
      return;
    }

    const newMessage: UIMessage = {
      ...targetMessage,
      parts: targetMessage.parts.map((part) => {
        if (part.type === 'tool-invocation' && part.toolInvocation.toolCallId === result.toolCallId) {
          return {
            ...part,
            toolInvocation: {
              ...part.toolInvocation,
              result: result.result ?? undefined,
              status: result.status,
              error: result.error ?? undefined,
              cancelled: result.cancelled ?? undefined
            }
          };
        }
        return part;
      })
    };
    this.updateMessage(newMessage);
  };

  send = async (options: SendRunOptions): Promise<void> => {
    if (this.activeRun$.getValue() || this.activeSubscription) {
      this.abortAgentRun();
    }
    this.lastError$.next(null);

    const message = options.message.trim();
    if (!message) return;

    this.addMessages([
      {
        id: v4(),
        role: 'user',
        parts: [{ type: 'text', text: message }]
      }
    ]);

    await this.runAgent({
      metadata: options.metadata,
      sessionId: options.sessionId,
      agentId: options.agentId,
      stopCapable: options.stopCapable,
      stopReason: options.stopReason,
      sourceMessage: message,
      restoreDraftOnError: options.restoreDraftOnError
    });
  };

  resume = async (options: ResumeRunOptions): Promise<void> => {
    const remoteRunId = options.remoteRunId?.trim();
    const sessionId = options.sessionId?.trim();
    if (!remoteRunId) return;

    const currentRun = this.activeRun$.getValue();
    if (currentRun?.remoteRunId === remoteRunId) return;
    if (currentRun) return;

    this.lastError$.next(null);

    await this.runAgent({
      metadata: options.metadata,
      sessionId,
      agentId: options.agentId,
      stopCapable: options.stopCapable,
      stopReason: options.stopReason
    });
  };

  stop = async (): Promise<void> => {
    const activeRun = this.activeRun$.getValue();
    if (!activeRun) return;

    const sourceSessionId = activeRun.sessionId;
    this.abortAgentRun();

    if (sourceSessionId) {
      await this.callbacks.onRunSettled?.({ sourceSessionId });
    }
  };

  handleAgentResponse = (response: Observable<AgentEvent>) => {
    if (this.activeSubscription) {
      this.activeSubscription.unsubscribe();
    }
    this.activeSubscription = response.subscribe((event: AgentEvent) => {
      if (event.type === EventType.RUN_METADATA) {
        const metaEvent = event as RunMetadataEvent;
        const activeRun = this.activeRun$.getValue();
        const runId = metaEvent.runId?.trim() || (activeRun ? `ui-${activeRun.localRunId}` : '');

        if (this.metadataParsers && activeRun && this.isMatchingRun(activeRun, runId)) {
          this.processRunMetadata(activeRun, metaEvent.metadata);
        }

        this.runMetadata$.next({ runId, metadata: metaEvent.metadata });
        return;
      }
      this.handleEvent(event);
      if (event.type === EventType.RUN_FINISHED) {
        this.isAgentResponding$.next(false);
        this.isAwaitingResponse$.next(false);
        this.activeSubscription = null;

        const activeRun = this.activeRun$.getValue();
        const runId = event.runId?.trim() || (activeRun ? `ui-${activeRun.localRunId}` : '');

        // If activeRun was already cleared by final metadata, skip
        if (!activeRun || !this.isMatchingRun(activeRun, runId)) {
          return;
        }

        const sourceSessionId = activeRun.sessionId;
        this.activeRun$.next(null);

        if (sourceSessionId) {
          void this.callbacks.onRunSettled?.({ sourceSessionId });
        }
      } else if (event.type === EventType.RUN_ERROR) {
        this.isAgentResponding$.next(false);
        this.isAwaitingResponse$.next(false);
        this.activeSubscription = null;

        const activeRun = this.activeRun$.getValue();
        const runId = event.runId?.trim() || (activeRun ? `ui-${activeRun.localRunId}` : '');
        const isAbort = isAbortLikeError(event.error);

        this.runError$.next({ runId, error: event.error, isAbort });

        if (!activeRun || !this.isMatchingRun(activeRun, runId)) {
          this.activeRun$.next(null);
          return;
        }

        const sourceSessionId = activeRun.sessionId;

        if (isAbort) {
          this.activeRun$.next(null);
          if (sourceSessionId) {
            void this.callbacks.onRunSettled?.({ sourceSessionId });
          }
          return;
        }

        // Real error
        const sendError = formatSendError(event.error);
        this.lastError$.next(sendError);
        this.activeRun$.next(null);

        if (sourceSessionId) {
          this.addMessages([
            buildLocalAssistantMessage(sendError, {
              sessionKey: sourceSessionId,
              status: 'error'
            })
          ]);
        }

        this.callbacks.onRunError?.({
          error: sendError,
          sourceMessage: activeRun.sourceMessage,
          restoreDraft: activeRun.restoreDraftOnError
        });
      }
    });
  };

  abortAgentRun = () => {
    this.agentProvider?.agent.abortRun?.();
    if (this.activeSubscription) {
      this.activeSubscription.unsubscribe();
      this.activeSubscription = null;
      this.isAgentResponding$.next(false);
      this.isAwaitingResponse$.next(false);
    }
    this.activeRun$.next(null);
  };

  runAgent = async (options?: RunAgentOptions) => {
    if (!this.agentProvider) {
      return;
    }

    // Auto abort if there's an active run or subscription
    if (this.activeRun$.getValue() || this.activeSubscription) {
      this.abortAgentRun();
    }

    const localRunId = ++this.runIdCounter;
    const runId = `ui-${localRunId}`;

    const activeRun: ActiveRunContext = {
      localRunId,
      sessionId: options?.sessionId,
      ...(options?.agentId ? { agentId: options.agentId } : {}),
      remoteStopCapable: Boolean(options?.stopCapable),
      ...(options?.stopReason ? { remoteStopReason: options.stopReason } : {}),
      sourceMessage: options?.sourceMessage,
      restoreDraftOnError: options?.restoreDraftOnError
    };
    this.activeRun$.next(activeRun);

    this.isAgentResponding$.next(true);
    this.isAwaitingResponse$.next(true);
    try {
      const safeMessages = finalizePendingToolInvocations(this.getMessages());
      const threadId =
        typeof options?.threadId === 'string' && options.threadId.trim()
          ? options.threadId
          : (this.threadId$.getValue() ?? '');
      const response = await this.agentProvider.agent.run({
        threadId,
        runId,
        messages: safeMessages,
        tools: this.agentProvider.getToolDefs(),
        context: this.agentProvider.getContexts(),
        ...(options?.metadata ? { metadata: options.metadata } : {})
      });
      this.handleAgentResponse(response as unknown as Observable<AgentEvent>);
    } catch (error) {
      const isAbort = isAbortLikeError(error);
      if (isAbort) {
        console.info('Agent run aborted');
      } else {
        console.error('Error running agent:', error);
      }
      this.isAgentResponding$.next(false);
      this.isAwaitingResponse$.next(false);

      const currentActiveRun = this.activeRun$.getValue();
      this.activeRun$.next(null);
      this.runError$.next({ runId, error, isAbort });

      if (!isAbort && currentActiveRun) {
        const sendError = formatSendError(error);
        this.lastError$.next(sendError);
        if (currentActiveRun.sessionId) {
          this.addMessages([
            buildLocalAssistantMessage(sendError, {
              sessionKey: currentActiveRun.sessionId,
              status: 'error'
            })
          ]);
        }
        this.callbacks.onRunError?.({
          error: sendError,
          sourceMessage: currentActiveRun.sourceMessage,
          restoreDraft: currentActiveRun.restoreDraftOnError
        });
      } else if (isAbort && currentActiveRun?.sessionId) {
        void this.callbacks.onRunSettled?.({ sourceSessionId: currentActiveRun.sessionId });
      }
    }
  };

  private processRunMetadata = (activeRun: ActiveRunContext, metadata: Record<string, unknown>) => {
    if (!this.metadataParsers) return;

    const ready = this.metadataParsers.parseReady(metadata);
    if (ready) {
      this.applyReadyMetadata(activeRun, ready);
      return;
    }

    const final = this.metadataParsers.parseFinal(metadata);
    if (final) {
      this.applyFinalMetadata(activeRun, final);
    }
  };

  private applyReadyMetadata = (activeRun: ActiveRunContext, ready: RunReadyInfo) => {
    const updatedRun = { ...activeRun };
    if (ready.remoteRunId?.trim()) {
      updatedRun.remoteRunId = ready.remoteRunId.trim();
    }
    if (typeof ready.stopCapable === 'boolean') {
      updatedRun.remoteStopCapable = ready.stopCapable;
    }
    if (ready.stopReason?.trim()) {
      updatedRun.remoteStopReason = ready.stopReason.trim();
    }
    if (ready.sessionId?.trim()) {
      updatedRun.sessionId = ready.sessionId.trim();
      this.callbacks.onSessionChanged?.(updatedRun.sessionId);
    }
    this.activeRun$.next(updatedRun);
  };

  private applyFinalMetadata = (activeRun: ActiveRunContext, final: RunFinalInfo) => {
    const sourceSessionId = activeRun.sessionId;
    const resultSessionId = final.sessionId;
    if (resultSessionId && resultSessionId !== sourceSessionId) {
      this.callbacks.onSessionChanged?.(resultSessionId);
    }
    this.activeRun$.next(null);
    if (sourceSessionId) {
      void this.callbacks.onRunSettled?.({ sourceSessionId, resultSessionId });
    }
  };

  private isMatchingRun = (activeRun: ActiveRunContext, runId: string): boolean => {
    if (!runId.trim()) return false;
    return runId === `ui-${activeRun.localRunId}`;
  };

  private connectToolExecutor = () => {
    const sub = this.toolCall$.subscribe(async ({ toolCall }) => {
      const executor = this.agentProvider?.getToolExecutor(toolCall.function.name);
      if (executor) {
        try {
          const toolCallArgs = JSON.parse(toolCall.function.arguments);
          const result = await executor(toolCallArgs);
          this.addToolResult({ toolCallId: toolCall.id, result, status: ToolInvocationStatus.RESULT });
          this.runAgent();
        } catch (err) {
          console.error('[AgentChatController] handleAddToolResult error', err);
          this.addToolResult({
            toolCallId: toolCall.id,
            error: err instanceof Error ? err.message : String(err),
            status: ToolInvocationStatus.ERROR
          });
          this.runAgent();
        }
      }
    });
    return () => sub.unsubscribe();
  };
}
