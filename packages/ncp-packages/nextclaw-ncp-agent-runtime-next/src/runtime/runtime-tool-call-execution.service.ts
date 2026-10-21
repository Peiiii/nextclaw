import {
  executeCollectedToolCall,
  type CollectedToolCall,
  type ToolResultContentManager,
} from "@nextclaw/ncp-agent-runtime";
import {
  createNcpEndpointEvent,
  NcpEventType,
  type NcpEndpointEvent,
  type NcpTool,
} from "@nextclaw/ncp";
import type { DefaultNcpAgentRunSpec } from "./types/agent-model-input.types.js";

type RuntimeToolCallExecutionInput = {
  tools: readonly NcpTool[];
  sessionId: string;
  messageId: string;
  spec: DefaultNcpAgentRunSpec;
  toolCall: CollectedToolCall;
  publishToolEvent: (event: NcpEndpointEvent) => Promise<void>;
  signal?: AbortSignal;
  recovery?: { required: boolean; readCount: number; cursors: Set<string> };
};

export class RuntimeToolCallExecutionService {
  constructor(private readonly contentManager: ToolResultContentManager) {}

  execute = async (input: RuntimeToolCallExecutionInput): Promise<NcpEndpointEvent> => {
    const {
      messageId,
      publishToolEvent,
      sessionId,
      signal,
      spec,
      toolCall,
      tools,
    } = input;
    const tool = tools.find((candidate) => candidate.name === toolCall.toolName);
    let executionStartedAt: string | undefined;
    let executionStartedMonotonic: number | undefined;
    let executionStartedEventApplied: Promise<void> | undefined;
    let executionStartedEventError: unknown;
    const result = this.contentManager.normalizeToolCallResult(
      await executeCollectedToolCall({
        toolCall,
        tool,
        execute: (availableTool, args) => {
          if (!availableTool) {
            throw new Error("Tool is not available in this run.");
          }
          if (input.recovery?.required) {
            const parameters = typeof args === "object" && args !== null ? args as Record<string, unknown> : {};
            const clarification = availableTool.name === "request_user_input_async";
            if (!clarification && (availableTool.name !== "sessions_history" || parameters.sessionKey !== sessionId)) {
              throw new Error("Unresolved archived context: only exact current-session history reads are permitted. Ask a specific business clarification before any action.");
            }
            const cursor = JSON.stringify([availableTool.name, parameters.messageId ?? null, parameters.part ?? null, parameters.cursor ?? null]);
            if (!clarification && (input.recovery.readCount >= 8 || input.recovery.cursors.has(cursor))) {
              throw new Error("History recovery has reached its progress budget. Ask a specific business clarification; do not repeat this read or any action.");
            }
            if (!clarification) {
              input.recovery.readCount += 1;
              input.recovery.cursors.add(cursor);
            }
          }
          const reportExecutionStarted = (): void => {
            if (executionStartedAt) return;
            executionStartedAt = new Date().toISOString();
            executionStartedMonotonic = performance.now();
            executionStartedEventApplied = publishToolEvent(createNcpEndpointEvent({
              type: NcpEventType.MessageToolExecutionStarted,
              payload: {
                sessionId,
                messageId,
                toolCallId: toolCall.toolCallId,
                correlationId: spec.correlationId,
              },
            }, executionStartedAt)).catch((error: unknown) => {
              executionStartedEventError = error;
            });
          };
          const updateToolCallResult = async (updatedResult: unknown): Promise<void> => {
            const normalized = this.contentManager.normalizeToolCallResult({
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: typeof args === "object" && args !== null && !Array.isArray(args)
                ? args as Record<string, unknown>
                : null,
              rawArgsText: toolCall.args,
              result: updatedResult,
            });
            await publishToolEvent(createNcpEndpointEvent({
              type: NcpEventType.MessageToolCallResult,
              payload: {
                sessionId,
                toolCallId: toolCall.toolCallId,
                correlationId: spec.correlationId,
                content: normalized.result,
                contentItems: normalized.contentItems,
                final: false,
              },
            }));
          };
          return availableTool.execute(args, {
            abortSignal: signal,
            toolCallId: toolCall.toolCallId,
            reportExecutionStarted,
            updateToolCallResult,
          });
        },
      }),
    );
    const endedAt = new Date().toISOString();
    const durationMs = executionStartedMonotonic !== undefined
      ? Math.max(0, performance.now() - executionStartedMonotonic)
      : undefined;
    await executionStartedEventApplied;
    if (executionStartedEventError) throw executionStartedEventError;
    return createNcpEndpointEvent({
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId,
        toolCallId: toolCall.toolCallId,
        correlationId: spec.correlationId,
        content: result.result,
        contentItems: result.contentItems,
        final: true,
        ...(executionStartedAt && durationMs !== undefined
          ? {
              execution: {
                startedAt: executionStartedAt,
                endedAt,
                durationMs,
              },
            }
          : {}),
      },
    }, endedAt);
  };
}
