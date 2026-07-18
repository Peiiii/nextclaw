import { randomUUID } from "node:crypto";
import {
  defaultToolResultContentManager,
  DefaultNcpStreamEncoder,
  executeCollectedToolCall,
  type CollectedToolCall,
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

export type AgentRuntimeSessionStateSnapshot = {
  messages: readonly NcpMessage[];
};

export type AgentRuntimeSessionState = {
  readonly sessionId: string;
  readonly inbox: {
    drain(): NcpMessage[];
  };
  getSnapshot(): AgentRuntimeSessionStateSnapshot;
  applyEvents(events: readonly NcpEndpointEvent[]): Promise<void>;
};

export type DefaultNcpAgentRuntimeRunOptions = {
  sessionRun: AgentRuntimeSessionState;
  contextBlocks: readonly string[];
  tools: readonly NcpTool[];
  signal?: AbortSignal;
};

export type AgentRunPreflight = (input: {
  contextBlocks: readonly string[];
  spec: DefaultNcpAgentRunSpec;
  sessionRun: AgentRuntimeSessionState;
}) => Promise<readonly NcpEndpointEvent[]>;

export type DefaultNcpAgentRuntimeConfig = {
  llmApi: NcpLLMApi;
  modelInputBuilder: AgentModelInputBuilder;
  runPreflight?: AgentRunPreflight;
  reasoningNormalizationMode?: NcpAssistantReasoningNormalizationMode;
  streamEncoder?: NcpStreamEncoder;
  toolResultContentManager?: ToolResultContentManager;
};

type InboxDrainResult = {
  drained: boolean;
  events: NcpEndpointEvent[];
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
  const reason = (signal as (AbortSignal & { reason?: unknown }) | undefined)?.reason;
  if (isRecord(reason) && reason.code === "abort-error" && typeof reason.message === "string") {
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
  private readonly toolResultContentManager: ToolResultContentManager;

  constructor(config: DefaultNcpAgentRuntimeConfig) {
    const {
      llmApi,
      modelInputBuilder,
      runPreflight,
      reasoningNormalizationMode,
      streamEncoder,
      toolResultContentManager,
    } = config;
    this.llmApi = llmApi;
    this.modelInputBuilder = modelInputBuilder;
    this.runPreflight = runPreflight;
    this.reasoningNormalizationMode = reasoningNormalizationMode ?? "think-tags";
    this.streamEncoder =
      streamEncoder ??
      new DefaultNcpStreamEncoder({
        reasoningNormalizationMode: this.reasoningNormalizationMode,
        toolCallEndMode: "sequential-index",
      });
    this.toolResultContentManager =
      toolResultContentManager ?? defaultToolResultContentManager;
  }

  // eslint-disable-next-line max-statements
  async *run(
    spec: DefaultNcpAgentRunSpec,
    options: DefaultNcpAgentRuntimeRunOptions,
  ): AsyncIterable<NcpEndpointEvent> {
    const {
      contextBlocks,
      sessionRun,
      signal,
      tools,
    } = options;
    const sessionId = sessionRun.sessionId;
    const messageId = `assistant-message-${randomUUID()}`;
    const executionManager = new AgentRunExecutionManager({
      spec,
      sessionId,
      messageId,
    });
    let runStartedAt: string | undefined;

    try {
      for (const event of this.drainInbox(sessionRun, spec).events) {
        if (this.isAbortRequested(signal)) {
          break;
        }
        yield await this.applyEvent(sessionRun, event);
      }
      const preflightEvents = this.runPreflight
        ? await this.runPreflight({ contextBlocks, spec, sessionRun })
        : [];
      for (const event of preflightEvents) {
        if (this.isAbortRequested(signal)) {
          break;
        }
        yield await this.applyEvent(sessionRun, event);
      }
      runStartedAt = new Date().toISOString();
      yield await this.applyEvent(sessionRun, createRuntimeEvent({
        type: NcpEventType.RunStarted,
        payload: {
          messageId,
          runId: spec.runId,
          sessionId,
          correlationId: spec.correlationId,
          startedAt: runStartedAt,
        },
      }, runStartedAt));
      if (this.isAbortRequested(signal)) {
        yield await this.applyEvent(sessionRun, executionManager.createMetadataEvent({ outcome: "aborted" }));
        yield await this.applyEvent(sessionRun, this.toAbortEvent(sessionId, messageId, spec, signal));
        return;
      }

      while (!this.isAbortRequested(signal)) {
        const modelInput = await this.modelInputBuilder.build({
          spec,
          sessionId,
          messages: sessionRun.getSnapshot().messages,
          contextBlocks,
          tools,
        });
        if (this.isAbortRequested(signal)) {
          break;
        }

        const toolExecutor = yield* runModelRoundWithRecovery({
          applyEvent: this.applyEvent,
          drainRuntimeEvents: (encoded, toolExecutor) =>
            this.drainRuntimeEvents(sessionRun, encoded, toolExecutor, signal),
          executeToolCall: (toolCall, publishToolResult) =>
            this.executeToolCall(tools, sessionId, spec, toolCall, publishToolResult, signal),
          executionManager,
          llmApi: this.llmApi,
          messageId,
          modelInput,
          runStartedAt,
          sessionId,
          sessionRun,
          signal,
          spec,
          streamEncoder: this.streamEncoder,
          toRunErrorEvent: (error, startedAt) => this.toRunErrorEvent(sessionId, spec, error, startedAt),
        });
        if (this.isAbortRequested(signal)) {
          break;
        }

        const drainedInbox = this.drainInbox(sessionRun, spec);
        for (const event of drainedInbox.events) {
          if (this.isAbortRequested(signal)) {
            break;
          }
          yield await this.applyEvent(sessionRun, event);
        }
        if (this.isAbortRequested(signal)) {
          break;
        }
        if (toolExecutor.hasStartedToolCalls() || drainedInbox.drained) {
          continue;
        }

        const endedAt = new Date().toISOString();
        yield await this.applyEvent(
          sessionRun,
          executionManager.createMetadataEvent({
            outcome: "completed",
            occurredAt: endedAt,
          }),
        );
        yield await this.applyEvent(sessionRun, createRuntimeEvent({
          type: NcpEventType.RunFinished,
          payload: {
            messageId,
            runId: spec.runId,
            sessionId,
            correlationId: spec.correlationId,
            startedAt: runStartedAt,
            endedAt,
          },
        }, endedAt));
        return;
      }

      yield await this.applyEvent(sessionRun, executionManager.createMetadataEvent({ outcome: "aborted" }));
      yield await this.applyEvent(sessionRun, this.toAbortEvent(sessionId, messageId, spec, signal));
    } catch (error) {
      if (this.isAbortRequested(signal)) {
        yield await this.applyEvent(sessionRun, executionManager.createMetadataEvent({ outcome: "aborted" }));
        yield await this.applyEvent(sessionRun, this.toAbortEvent(sessionId, messageId, spec, signal));
        return;
      }
      const endedAt = new Date().toISOString();
      yield await this.applyEvent(
        sessionRun,
        executionManager.createMetadataEvent({
          outcome: "failed",
          occurredAt: endedAt,
        }),
      );
      yield await this.applyEvent(sessionRun, createRuntimeEvent({
        type: NcpEventType.RunError,
        payload: {
          sessionId,
          runId: spec.runId,
          correlationId: spec.correlationId,
          error: error instanceof Error ? error.message : String(error),
          startedAt: runStartedAt,
          endedAt,
        },
      }, endedAt));
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

  private drainInbox = (
    sessionRun: AgentRuntimeSessionState,
    spec: DefaultNcpAgentRunSpec,
  ): InboxDrainResult => {
    const messages = sessionRun.inbox.drain();
    return {
      drained: messages.length > 0,
      events: messages.map((message) => ({
        occurredAt: new Date().toISOString(),
        type: NcpEventType.MessageSent,
        payload: {
          sessionId: sessionRun.sessionId,
          message,
          correlationId: spec.correlationId,
        },
      })),
    };
  };

  private isAbortRequested = (signal?: AbortSignal): boolean => signal?.aborted ?? false;

  private toAbortEvent = (
    sessionId: string,
    messageId: string,
    spec: DefaultNcpAgentRunSpec,
    signal?: AbortSignal,
  ): NcpEndpointEvent => createRuntimeEvent({
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
  ): NcpEndpointEvent => {
    const endedAt = new Date().toISOString();
    return createRuntimeEvent({
      type: NcpEventType.RunError,
      payload: {
        sessionId,
        runId: spec.runId,
        correlationId: spec.correlationId,
        error: error instanceof Error ? error.message : String(error),
        startedAt,
        endedAt,
      },
    }, endedAt);
  };

  private applyEvent = async (
    sessionRun: AgentRuntimeSessionState,
    event: NcpEndpointEvent,
  ): Promise<NcpEndpointEvent> => {
    await sessionRun.applyEvents([event]);
    return event;
  };

  private executeToolCall = async (
    tools: readonly NcpTool[],
    sessionId: string,
    spec: DefaultNcpAgentRunSpec,
    toolCall: CollectedToolCall,
    publishToolResult: (event: NcpEndpointEvent) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<NcpEndpointEvent> => {
    const tool = tools.find((candidate) => candidate.name === toolCall.toolName);
    const result = this.toolResultContentManager.normalizeToolCallResult(
      await executeCollectedToolCall({
        toolCall,
        tool,
        execute: (availableTool, args) => {
          if (!availableTool) {
            throw new Error("Tool is not available in this run.");
          }
          const updateToolCallResult = async (updatedResult: unknown): Promise<void> => {
            const normalized = this.toolResultContentManager.normalizeToolCallResult({
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: typeof args === "object" && args !== null && !Array.isArray(args)
                ? args as Record<string, unknown>
                : null,
              rawArgsText: toolCall.args,
              result: updatedResult,
            });
            const event = createRuntimeEvent({
              type: NcpEventType.MessageToolCallResult,
              payload: {
                sessionId,
                toolCallId: toolCall.toolCallId,
                correlationId: spec.correlationId,
                content: normalized.result,
                contentItems: normalized.contentItems,
              },
            });
            await publishToolResult(event);
          };
          return availableTool.execute(args, {
            abortSignal: signal,
            toolCallId: toolCall.toolCallId,
            updateToolCallResult,
          });
        },
      }),
    );
    return createRuntimeEvent({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId,
        toolCallId: toolCall.toolCallId,
        correlationId: spec.correlationId,
        content: result.result,
        contentItems: result.contentItems,
      },
    });
  };
}
