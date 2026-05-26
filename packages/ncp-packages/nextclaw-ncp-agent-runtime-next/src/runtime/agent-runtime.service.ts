import { randomUUID } from "node:crypto";
import {
  defaultToolResultContentManager,
  DefaultNcpRoundCollector,
  DefaultNcpStreamEncoder,
  executeCollectedToolCall,
  type CollectedToolCall,
  type ToolResultContentManager,
} from "@nextclaw/ncp-agent-runtime";
import {
  NcpEventType,
  type NcpAssistantReasoningNormalizationMode,
  type NcpEndpointEvent,
  type NcpLLMApi,
  type NcpMessage,
  type NcpStreamEncoder,
  type NcpTool,
  type OpenAIChatChunk,
} from "@nextclaw/ncp";
import type {
  AgentModelInputBuilder,
  DefaultNcpAgentRunSpec,
} from "./types/agent-model-input.types.js";

export type AgentRuntimeSessionStateSnapshot = {
  messages: readonly NcpMessage[];
};

export type AgentRuntimeSessionState = {
  readonly sessionId: string;
  readonly inbox: {
    drain(): NcpMessage[];
    isEmpty(): boolean;
  };
  getSnapshot(): AgentRuntimeSessionStateSnapshot;
  applyEvents(events: readonly NcpEndpointEvent[]): Promise<void>;
  applyAndPublishEvents?(
    events: readonly NcpEndpointEvent[],
    meta: { source: string; emittedAt?: string },
  ): Promise<void>;
};

export type DefaultNcpAgentRuntimeRunOptions = {
  sessionRun: AgentRuntimeSessionState;
  contextBlocks: readonly string[];
  tools: readonly NcpTool[];
  signal?: AbortSignal;
};

export type AgentRunPreflight = (input: {
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
    this.reasoningNormalizationMode = reasoningNormalizationMode ?? "off";
    this.streamEncoder =
      streamEncoder ??
      new DefaultNcpStreamEncoder({
        reasoningNormalizationMode: this.reasoningNormalizationMode,
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

    try {
      for (const event of this.drainInbox(sessionRun, spec).events) {
        if (this.isAbortRequested(signal)) {
          break;
        }
        yield await this.applyEvent(sessionRun, event);
      }
      const preflightEvents = this.runPreflight
        ? await this.runPreflight({ spec, sessionRun })
        : [];
      for (const event of preflightEvents) {
        if (this.isAbortRequested(signal)) {
          break;
        }
        yield await this.applyEvent(sessionRun, event);
      }
      yield await this.applyEvent(sessionRun, {
        type: NcpEventType.RunStarted,
        payload: {
          messageId,
          runId: spec.runId,
          sessionId,
          correlationId: spec.correlationId,
        },
      });
      if (this.isAbortRequested(signal)) {
        yield await this.applyEvent(sessionRun, this.toAbortEvent(sessionId, messageId, spec));
        return;
      }

      while (!this.isAbortRequested(signal)) {
        const round = new DefaultNcpRoundCollector(this.reasoningNormalizationMode);
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

        const encoded = this.streamEncoder.encode(
          this.tapRuntimeStream(
            this.llmApi.generate(modelInput, { signal }),
            (chunk) => round.consumeChunk(chunk),
            signal,
          ),
          {
            sessionId,
            messageId,
            runId: spec.runId,
            correlationId: spec.correlationId,
          },
        );
        for await (const event of encoded) {
          if (this.isAbortRequested(signal)) {
            break;
          }
          yield await this.applyEvent(sessionRun, event);
        }
        if (this.isAbortRequested(signal)) {
          break;
        }

        const toolCalls = round.getToolCalls();
        for (const toolCall of toolCalls) {
          if (this.isAbortRequested(signal)) {
            break;
          }
          const toolResultEvent = await this.executeToolCall(tools, sessionRun, spec, toolCall);
          if (this.isAbortRequested(signal)) {
            break;
          }
          yield await this.applyEvent(sessionRun, toolResultEvent);
        }
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
        if (toolCalls.length > 0 || drainedInbox.drained) {
          continue;
        }

        yield await this.applyEvent(sessionRun, {
          type: NcpEventType.RunFinished,
          payload: {
            messageId,
            runId: spec.runId,
            sessionId,
            correlationId: spec.correlationId,
          },
        });
        return;
      }

      yield await this.applyEvent(sessionRun, this.toAbortEvent(sessionId, messageId, spec));
    } catch (error) {
      if (this.isAbortRequested(signal)) {
        yield await this.applyEvent(sessionRun, this.toAbortEvent(sessionId, messageId, spec));
        return;
      }
      yield await this.applyEvent(sessionRun, {
        type: NcpEventType.RunError,
        payload: {
          sessionId,
          runId: spec.runId,
          correlationId: spec.correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private async *tapRuntimeStream(
    stream: AsyncIterable<OpenAIChatChunk>,
    consumeChunk: (chunk: OpenAIChatChunk) => void,
    signal?: AbortSignal,
  ): AsyncIterable<OpenAIChatChunk> {
    for await (const chunk of stream) {
      if (signal?.aborted) {
        break;
      }
      consumeChunk(chunk);
      yield chunk;
      if (signal?.aborted) {
        break;
      }
    }
  }

  private drainInbox = (
    sessionRun: AgentRuntimeSessionState,
    spec: DefaultNcpAgentRunSpec,
  ): InboxDrainResult => {
    const messages = sessionRun.inbox.drain();
    return {
      drained: messages.length > 0,
      events: messages.map((message) => ({
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
  ): NcpEndpointEvent => ({
    type: NcpEventType.MessageAbort,
    payload: {
      messageId,
      sessionId,
      correlationId: spec.correlationId,
    },
  });

  private applyEvent = async (
    sessionRun: AgentRuntimeSessionState,
    event: NcpEndpointEvent,
  ): Promise<NcpEndpointEvent> => {
    await sessionRun.applyEvents([event]);
    return event;
  };

  private executeToolCall = async (
    tools: readonly NcpTool[],
    sessionRun: AgentRuntimeSessionState,
    spec: DefaultNcpAgentRunSpec,
    toolCall: CollectedToolCall,
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
            const event: NcpEndpointEvent = {
              type: NcpEventType.MessageToolCallResult,
              payload: {
                sessionId: sessionRun.sessionId,
                toolCallId: toolCall.toolCallId,
                correlationId: spec.correlationId,
                content: normalized.result,
                contentItems: normalized.contentItems,
              },
            };
            if (sessionRun.applyAndPublishEvents) {
              await sessionRun.applyAndPublishEvents([event], {
                source: "agent-runtime-tool-call-update",
              });
              return;
            }
            await sessionRun.applyEvents([event]);
          };
          return availableTool.execute(args, {
            toolCallId: toolCall.toolCallId,
            updateToolCallResult,
          });
        },
      }),
    );
    return {
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: sessionRun.sessionId,
        toolCallId: toolCall.toolCallId,
        correlationId: spec.correlationId,
        content: result.result,
        contentItems: result.contentItems,
      },
    };
  };
}
