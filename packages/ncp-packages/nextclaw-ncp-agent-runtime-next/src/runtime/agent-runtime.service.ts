import { randomUUID } from "node:crypto";
import {
  defaultToolResultContentManager,
  DefaultNcpStreamEncoder,
  MODEL_ROUND_PART_OFFSETS,
  type ToolResultContentManager,
} from "@nextclaw/ncp-agent-runtime";
import {
  createNcpEndpointEvent as createRuntimeEvent,
  NcpEventType,
  type NcpAssistantReasoningNormalizationMode,
  type NcpEndpointEvent,
  type NcpError,
  type NcpLLMApi,
  type NcpMessage,
  type NcpStreamEncoder,
  type NcpTool,
} from "@nextclaw/ncp";
import type {
  AgentModelInputBuilder,
  DefaultNcpAgentRunSpec,
} from "./types/agent-model-input.types.js";
import type {
  RuntimeToolCallExecutor,
  RuntimeQueuedEvent,
} from "./runtime-tool-call-executor.service.js";
import { runModelRoundWithRecovery } from "./runtime-model-round-recovery.manager.js";
import { AgentRunExecutionManager } from "./agent-run-execution.manager.js";
import { RuntimeToolCallExecutionService } from "./runtime-tool-call-execution.service.js";
import { ActionFusionService } from "./action-fusion/service.js";
import type { ActionFusionConfig, ActionFusionContext } from "./action-fusion/types.js";
import { ObservationPackToolResultContentManager } from "./observation-pack/observation-pack-content-manager.config.js";
import { ObservationStore } from "./observation-pack/observation-pack-store.config.js";

export type AgentRuntimeSessionStateSnapshot = {
  messages: readonly NcpMessage[];
};

export type AgentRuntimeSessionState = {
  readonly sessionId: string;
  getSnapshot(): AgentRuntimeSessionStateSnapshot;
  applyEvents(events: readonly NcpEndpointEvent[]): Promise<void>;
  claimNextStepRequests?(runId: string): readonly {
    id: string;
    request: { message: NcpMessage };
  }[];
  acknowledgeNextStepRequests?(requestIds: readonly string[]): void;
};

export type AgentRunPreflightPhase = "pre-run" | "mid-run";

export type DefaultNcpAgentRuntimeRunOptions = {
  sessionRun: AgentRuntimeSessionState;
  contextBlocks: readonly string[];
  initialMessages?: readonly NcpMessage[];
  tools: readonly NcpTool[];
  signal?: AbortSignal;
};

export type AgentRunPreflight = (input: {
  contextBlocks: readonly string[];
  phase: AgentRunPreflightPhase;
  signal?: AbortSignal;
  spec: DefaultNcpAgentRunSpec;
  sessionRun: AgentRuntimeSessionState;
  tools: readonly NcpTool[];
}) => AsyncIterable<NcpEndpointEvent>;

export type DefaultNcpAgentRuntimeConfig = {
  llmApi: NcpLLMApi;
  modelInputBuilder: AgentModelInputBuilder;
  runPreflight?: AgentRunPreflight;
  reasoningNormalizationMode?: NcpAssistantReasoningNormalizationMode;
  streamEncoder?: NcpStreamEncoder;
  toolResultContentManager?: ToolResultContentManager;
  actionFusion?: ActionFusionConfig;
  observationPack?: {
    enabled: boolean;
    thresholdChars?: number;
  };
};

type RuntimeDrainReady =
  | { kind: "source"; result: IteratorResult<NcpEndpointEvent> }
  | { kind: "tool"; item: RuntimeQueuedEvent };

type RuntimeSourceApplyResult = {
  event?: NcpEndpointEvent;
  sourceDone: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createDefaultAbortReason(): NcpError {
  return {
    code: "abort-error",
    message: "The run was cancelled before a complete response was produced.",
    details: { source: "runtime" },
  };
}

function readAbortSignalReason(signal?: AbortSignal): NcpError {
  const reason = (signal as (AbortSignal & { reason?: unknown }) | undefined)
    ?.reason;
  if (
    isRecord(reason) &&
    reason.code === "abort-error" &&
    typeof reason.message === "string"
  ) {
    return reason as NcpError;
  }
  if (reason instanceof Error && reason.name === "AbortError") {
    return createDefaultAbortReason();
  }
  if (reason instanceof Error && reason.message.trim()) {
    return {
      code: "abort-error",
      message: reason.message,
      details: { source: "runtime" },
    };
  }
  if (typeof reason === "string" && reason.trim()) {
    return {
      code: "abort-error",
      message: reason.trim(),
      details: { source: "runtime" },
    };
  }
  return createDefaultAbortReason();
}

class RuntimeDrainCursor {
  private sourceNext: Promise<IteratorResult<NcpEndpointEvent>> | null = null;
  private toolNext: Promise<RuntimeQueuedEvent> | null = null;

  createCandidates = (input: {
    iterator: AsyncIterator<NcpEndpointEvent>;
    sourceDone: boolean;
    toolExecutor: RuntimeToolCallExecutor;
  }): Promise<RuntimeDrainReady>[] => {
    const candidates: Promise<RuntimeDrainReady>[] = [];
    if (!input.sourceDone) {
      this.sourceNext ??= input.iterator.next();
      candidates.push(
        this.sourceNext.then((result) => ({
          kind: "source" as const,
          result,
        })),
      );
    }
    if (input.toolExecutor.hasPendingEvents()) {
      this.toolNext ??= input.toolExecutor.nextEvent();
      candidates.push(
        this.toolNext.then((item) => ({
          kind: "tool" as const,
          item,
        })),
      );
    }
    return candidates;
  };

  clearSource = (): void => {
    this.sourceNext = null;
  };

  clearTool = (): void => {
    this.toolNext = null;
  };
}

export class DefaultNcpAgentRuntime {
  private readonly llmApi: NcpLLMApi;
  private readonly modelInputBuilder: AgentModelInputBuilder;
  private readonly runPreflight?: AgentRunPreflight;
  private readonly reasoningNormalizationMode: NcpAssistantReasoningNormalizationMode;
  private readonly streamEncoder: NcpStreamEncoder;
  private readonly toolCallExecution: RuntimeToolCallExecutionService;
  private readonly actionFusion: ActionFusionService | null;
  private readonly observationStore: ObservationStore | null;

  constructor(config: DefaultNcpAgentRuntimeConfig) {
    const {
      llmApi,
      modelInputBuilder,
      runPreflight,
      reasoningNormalizationMode,
      streamEncoder,
      toolResultContentManager,
      actionFusion,
      observationPack,
    } = config;
    this.llmApi = llmApi;
    this.modelInputBuilder = modelInputBuilder;
    this.runPreflight = runPreflight;
    this.reasoningNormalizationMode =
      reasoningNormalizationMode ?? "think-tags";
    this.streamEncoder =
      streamEncoder ??
      new DefaultNcpStreamEncoder({
        reasoningNormalizationMode: this.reasoningNormalizationMode,
        toolCallEndMode: "sequential-index",
      });
    this.toolCallExecution = new RuntimeToolCallExecutionService(
      (observationPack?.enabled
        ? new ObservationPackToolResultContentManager({
            delegate: toolResultContentManager ?? defaultToolResultContentManager,
            store: new ObservationStore(),
            thresholdChars: observationPack.thresholdChars,
          })
        : toolResultContentManager ?? defaultToolResultContentManager) as ToolResultContentManager,
    );
    this.actionFusion = actionFusion ? new ActionFusionService(actionFusion) : null;
    this.observationStore = observationPack?.enabled ? new ObservationStore() : null;
  }

  // eslint-disable-next-line max-statements
  async *run(
    spec: DefaultNcpAgentRunSpec,
    options: DefaultNcpAgentRuntimeRunOptions,
  ): AsyncIterable<NcpEndpointEvent> {
    const { contextBlocks, sessionRun, signal, tools } = options;
    const sessionId = sessionRun.sessionId;
    let messageId = `assistant-message-${randomUUID()}`;
    const executionManager = new AgentRunExecutionManager({
      spec,
      sessionId,
      messageId,
    });
    let runStartedAt: string | undefined;

    try {
      for (const event of this.toMessageSentEvents(
        options.initialMessages ?? [],
        sessionRun,
        spec,
      )) {
        if (this.isAbortRequested(signal)) {
          break;
        }
        yield await this.applyEvent(sessionRun, event);
      }
      yield* this.runPreflightPhase(
        { contextBlocks, phase: "pre-run", sessionRun, spec, tools },
        signal,
      );
      runStartedAt = new Date().toISOString();
      yield await this.applyEvent(
        sessionRun,
        executionManager.createStartedEvent(runStartedAt),
      );
      if (this.isAbortRequested(signal)) {
        yield* this.abortRun(options, spec, executionManager, messageId);
        return;
      }

      while (!this.isAbortRequested(signal)) {
        const modelInput = yield* this.prepareModelRound(options, messageId, spec);
        if (this.isAbortRequested(signal)) {
          break;
        }

        const roundMessageId = messageId;
        const toolExecutor = yield* runModelRoundWithRecovery({
          applyEvent: this.applyEvent,
          drainRuntimeEvents: (encoded, toolExecutor) =>
            this.drainRuntimeEvents(sessionRun, encoded, toolExecutor, signal),
          executeToolCall: async (toolCall, publishToolEvent) => {
            if (this.actionFusion) {
              const context: ActionFusionContext = {
                sessionId,
                messageId: roundMessageId,
                correlationId: spec.correlationId,
                publishToolEvent,
                originalExecuteToolCall: async (tc, pe) =>
                  this.toolCallExecution.execute({
                    tools,
                    sessionId,
                    messageId: roundMessageId,
                    spec,
                    toolCall: tc,
                    publishToolEvent: pe,
                    signal,
                  }),
                activeFusion: undefined,
              };
              const result = await this.actionFusion.detectAndFuse(context, toolCall);
              if (result.fused && result.result !== undefined) {
                // 融合序列已真实执行完毕；最后调用的结果事件已由规则返回，
                // 直接上抛，不再重复执行当前调用。
                return result.result as NcpEndpointEvent;
              }
            }
            return this.toolCallExecution.execute({
              tools,
              sessionId,
              messageId: roundMessageId,
              spec,
              toolCall,
              publishToolEvent,
              signal,
            });
          },
          supportsParallelToolCalls: (toolCall) =>
            tools.find((tool) => tool.name === toolCall.toolName)
              ?.supportsParallelToolCalls === true,
          executionManager,
          llmApi: this.llmApi,
          messageId: roundMessageId,
          modelInput,
          runStartedAt,
          sessionId,
          sessionRun,
          signal,
          spec,
          streamEncoder: this.streamEncoder,
          toRunErrorEvent: (error, startedAt) =>
            this.toRunErrorEvent(sessionId, spec, error, startedAt),
        });
        if (this.isAbortRequested(signal)) {
          break;
        }

        const nextStep = await this.consumeNextStepInputs(
          sessionRun,
          roundMessageId,
          spec,
        );
        if (nextStep.completedAssistantEvent)
          yield nextStep.completedAssistantEvent;
        for (const event of nextStep.messageSentEvents) yield event;
        if (nextStep.consumed) messageId = `assistant-message-${randomUUID()}`;
        if (this.isAbortRequested(signal)) {
          break;
        }
        if (toolExecutor.hasStartedToolCalls() || nextStep.consumed) {
          yield* this.runPreflightPhase(
            { contextBlocks, phase: "mid-run", sessionRun, spec, tools },
            signal,
          );
          continue;
        }

        const endedAt = new Date().toISOString();
        yield await this.applyEvent(
          sessionRun,
          executionManager.createMetadataEvent({
            outcome: "completed",
            occurredAt: endedAt,
            messageId,
          }),
        );
        yield await this.completeAssistantStep(sessionRun, messageId, spec);
        yield await this.applyEvent(
          sessionRun,
          createRuntimeEvent(
            {
              type: NcpEventType.RunFinished,
              payload: {
                messageId,
                runId: spec.runId,
                sessionId,
                correlationId: spec.correlationId,
                startedAt: runStartedAt,
                endedAt,
              },
            },
            endedAt,
          ),
        );
        this.observationStore?.clear();
        return;
      }

      yield* this.abortRun(options, spec, executionManager, messageId);
    } catch (error) {
      if (this.isAbortRequested(signal)) {
        yield* this.abortRun(options, spec, executionManager, messageId);
        return;
      }
      const endedAt = new Date().toISOString();
      yield await this.applyEvent(
        sessionRun,
        executionManager.createMetadataEvent({
          outcome: "failed",
          occurredAt: endedAt,
          messageId,
        }),
      );
      yield await this.applyEvent(
        sessionRun,
        this.toRunErrorEvent(sessionId, spec, error, runStartedAt, endedAt),
      );
    }
  }

  private async *abortRun(
    { sessionRun, signal }: DefaultNcpAgentRuntimeRunOptions,
    spec: DefaultNcpAgentRunSpec,
    executionManager: AgentRunExecutionManager,
    messageId: string,
  ): AsyncIterable<NcpEndpointEvent> {
    yield await this.applyEvent(
      sessionRun,
      executionManager.createMetadataEvent({ outcome: "aborted", messageId }),
    );
    yield await this.applyEvent(
      sessionRun,
      this.toAbortEvent(sessionRun.sessionId, messageId, spec, signal),
    );
  }

  private async *runPreflightPhase(
    input: Parameters<AgentRunPreflight>[0],
    signal?: AbortSignal,
  ): AsyncIterable<NcpEndpointEvent> {
    if (!this.runPreflight) {
      return;
    }
    for await (const event of this.runPreflight({ ...input, signal })) {
      yield await this.applyEvent(input.sessionRun, event);
    }
  }

  private async *drainRuntimeEvents(
    sessionRun: AgentRuntimeSessionState,
    encoded: AsyncIterable<NcpEndpointEvent>,
    toolExecutor: RuntimeToolCallExecutor,
    signal?: AbortSignal,
  ): AsyncIterable<NcpEndpointEvent> {
    const iterator = encoded[Symbol.asyncIterator]();
    let sourceDone = false;
    const cursor = new RuntimeDrainCursor();

    try {
      while (
        (!sourceDone || toolExecutor.hasPendingEvents()) &&
        !this.isAbortRequested(signal)
      ) {
        const candidates = cursor.createCandidates({
          iterator,
          sourceDone,
          toolExecutor,
        });
        if (candidates.length === 0) {
          break;
        }

        const ready = await this.waitForDrainReady(candidates, signal);
        if (!ready) {
          break;
        }
        if (ready.kind === "source") {
          cursor.clearSource();
          const result = await this.applySourceRuntimeEvent(
            sessionRun,
            toolExecutor,
            ready.result,
          );
          sourceDone = result.sourceDone;
          if (result.event) yield result.event;
          continue;
        }

        cursor.clearTool();
        yield await this.applyQueuedRuntimeEvent(sessionRun, ready.item);
      }
    } finally {
      if (this.isAbortRequested(signal)) {
        toolExecutor.cancel(new Error("Agent run aborted."));
        await iterator.return?.();
      }
    }
  }

  private waitForDrainReady = async (
    candidates: Promise<RuntimeDrainReady>[],
    signal?: AbortSignal,
  ): Promise<RuntimeDrainReady | null> => {
    if (!signal) {
      return await Promise.race(candidates);
    }
    if (signal.aborted) {
      return null;
    }
    let cleanup = (): void => {};
    const abortReady = new Promise<null>((resolve) => {
      const onAbort = (): void => resolve(null);
      cleanup = (): void => signal.removeEventListener("abort", onAbort);
      signal.addEventListener("abort", onAbort, { once: true });
    });
    try {
      return await Promise.race([...candidates, abortReady]);
    } finally {
      cleanup();
    }
  };

  private applySourceRuntimeEvent = async (
    sessionRun: AgentRuntimeSessionState,
    toolExecutor: RuntimeToolCallExecutor,
    result: IteratorResult<NcpEndpointEvent>,
  ): Promise<RuntimeSourceApplyResult> => {
    if (result.done) {
      return { sourceDone: true };
    }
    const event = await this.applyEvent(sessionRun, result.value);
    toolExecutor.acceptEvent(event);
    return {
      event,
      sourceDone: false,
    };
  };

  private applyQueuedRuntimeEvent = async (
    sessionRun: AgentRuntimeSessionState,
    item: RuntimeQueuedEvent,
  ): Promise<NcpEndpointEvent> => {
    try {
      const event = await this.applyEvent(sessionRun, item.event);
      item.resolveApplied();
      return event;
    } catch (error) {
      item.rejectApplied(error);
      throw error;
    }
  };

  private toMessageSentEvents = (
    messages: readonly NcpMessage[],
    sessionRun: AgentRuntimeSessionState,
    spec: DefaultNcpAgentRunSpec,
  ): NcpEndpointEvent[] =>
    messages.map((message) => ({
      occurredAt: new Date().toISOString(),
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: sessionRun.sessionId,
        message,
        correlationId: spec.correlationId,
      },
    }));

  private consumeNextStepInputs = async (
    sessionRun: AgentRuntimeSessionState,
    messageId: string,
    spec: DefaultNcpAgentRunSpec,
  ): Promise<{
    completedAssistantEvent: NcpEndpointEvent | null;
    consumed: boolean;
    messageSentEvents: NcpEndpointEvent[];
  }> => {
    const claimedInputs = sessionRun.claimNextStepRequests?.(spec.runId) ?? [];
    if (claimedInputs.length === 0) {
      return {
        completedAssistantEvent: null,
        consumed: false,
        messageSentEvents: [],
      };
    }
    const completedAssistantEvent = await this.completeAssistantStep(
      sessionRun,
      messageId,
      spec,
    );
    const messageSentEvents = this.toMessageSentEvents(
      claimedInputs.map(({ request }) => request.message),
      sessionRun,
      spec,
    );
    await sessionRun.applyEvents(messageSentEvents);
    sessionRun.acknowledgeNextStepRequests?.(claimedInputs.map(({ id }) => id));
    return { completedAssistantEvent, consumed: true, messageSentEvents };
  };

  private async *prepareModelRound(
    options: DefaultNcpAgentRuntimeRunOptions,
    messageId: string,
    spec: DefaultNcpAgentRunSpec,
  ): AsyncGenerator<NcpEndpointEvent, Awaited<ReturnType<AgentModelInputBuilder["build"]>>> {
    const { sessionRun, contextBlocks, tools, signal } = options;
    const sessionId = sessionRun.sessionId;
    const previousRound = sessionRun.getSnapshot().messages.find((message) => message.id === messageId);
    if (previousRound && previousRound.parts.length > 0) {
      const offsets = (previousRound.metadata?.[MODEL_ROUND_PART_OFFSETS] ?? []) as number[];
      if (offsets.at(-1) !== previousRound.parts.length) {
        yield await this.applyEvent(sessionRun, createRuntimeEvent({
          type: NcpEventType.MessageSent,
          payload: {
            sessionId,
            correlationId: spec.correlationId,
            message: {
              ...previousRound,
              metadata: {
                ...previousRound.metadata,
                [MODEL_ROUND_PART_OFFSETS]: [...offsets, previousRound.parts.length],
              },
            },
          },
        }));
      }
    }
    return await this.modelInputBuilder.build({
      spec, sessionId, messages: sessionRun.getSnapshot().messages, contextBlocks, tools, signal,
    });
  }

  private completeAssistantStep = async (
    sessionRun: AgentRuntimeSessionState,
    messageId: string,
    spec: DefaultNcpAgentRunSpec,
  ): Promise<NcpEndpointEvent> => {
    const message = sessionRun
      .getSnapshot()
      .messages.find((candidate) => candidate.id === messageId);
    if (!message) {
      throw new Error(`Assistant step completed without message ${messageId}.`);
    }
    return await this.applyEvent(
      sessionRun,
      createRuntimeEvent({
        type: NcpEventType.MessageCompleted,
        payload: {
          sessionId: sessionRun.sessionId,
          correlationId: spec.correlationId,
          message: { ...message, status: "final" },
        },
      }),
    );
  };

  private isAbortRequested = (signal?: AbortSignal): boolean =>
    signal?.aborted ?? false;

  private toAbortEvent = (
    sessionId: string,
    messageId: string,
    spec: DefaultNcpAgentRunSpec,
    signal?: AbortSignal,
  ): NcpEndpointEvent =>
    createRuntimeEvent({
      type: NcpEventType.MessageAbort,
      payload: {
        messageId,
        runId: spec.runId,
        sessionId,
        correlationId: spec.correlationId,
        reason: readAbortSignalReason(signal),
      },
    });

  private toRunErrorEvent = (
    sessionId: string,
    spec: DefaultNcpAgentRunSpec,
    error: unknown,
    startedAt?: string,
    endedAt = new Date().toISOString(),
  ): NcpEndpointEvent => {
    return createRuntimeEvent(
      {
        type: NcpEventType.RunError,
        payload: {
          sessionId,
          runId: spec.runId,
          correlationId: spec.correlationId,
          error: error instanceof Error ? error.message : String(error),
          startedAt,
          endedAt,
        },
      },
      endedAt,
    );
  };

  private applyEvent = async (
    sessionRun: AgentRuntimeSessionState,
    event: NcpEndpointEvent,
  ): Promise<NcpEndpointEvent> => {
    await sessionRun.applyEvents([event]);
    return event;
  };
}
