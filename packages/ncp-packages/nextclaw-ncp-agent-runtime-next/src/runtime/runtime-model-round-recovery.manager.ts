import {
  createNcpRuntimeStreamAttemptState,
  createNcpRuntimeStreamRetryEvents,
  getNcpRuntimeStreamRetryDelayMs,
  observeNcpRuntimeStreamAttemptEvent,
  shouldRetryNcpRuntimeStreamAttempt,
  type CollectedToolCall,
  type NcpRuntimeStreamAttemptState,
} from "@nextclaw/ncp-agent-runtime";
import type {
  NcpEndpointEvent,
  NcpLLMApi,
  NcpStreamEncoder,
  OpenAIChatChunk,
} from "@nextclaw/ncp";
import type {
  AgentRuntimeSessionState,
} from "./agent-runtime.service.js";
import {
  RuntimeToolCallExecutor,
} from "./runtime-tool-call-executor.service.js";
import type { AgentRunExecutionManager } from "./agent-run-execution.manager.js";
import type {
  AgentModelInputBuilder,
  DefaultNcpAgentRunSpec,
} from "./types/agent-model-input.types.js";

export type RuntimeModelRoundRecoveryManagerInput = {
  applyEvent: (
    sessionRun: AgentRuntimeSessionState,
    event: NcpEndpointEvent,
  ) => Promise<NcpEndpointEvent>;
  drainRuntimeEvents: (
    encoded: AsyncIterable<NcpEndpointEvent>,
    toolExecutor: RuntimeToolCallExecutor,
  ) => AsyncIterable<NcpEndpointEvent>;
  executeToolCall: (
    toolCall: CollectedToolCall,
    publishToolResult: (event: NcpEndpointEvent) => Promise<void>,
  ) => Promise<NcpEndpointEvent>;
  hasAttemptedTool?: () => boolean;
  recoverContextOverflow?: () => AsyncGenerator<NcpEndpointEvent, RuntimeModelRoundRecoveryManagerInput["modelInput"]>;
  supportsParallelToolCalls: (toolCall: CollectedToolCall) => boolean;
  executionManager: AgentRunExecutionManager;
  llmApi: NcpLLMApi;
  messageId: string;
  modelInput: Awaited<ReturnType<AgentModelInputBuilder["build"]>>;
  runStartedAt?: string;
  sessionId: string;
  sessionRun: AgentRuntimeSessionState;
  signal?: AbortSignal;
  spec: DefaultNcpAgentRunSpec;
  streamEncoder: NcpStreamEncoder;
  toRunErrorEvent: (error: unknown, startedAt?: string) => NcpEndpointEvent;
};

export async function* runModelRoundWithRecovery(
  input: RuntimeModelRoundRecoveryManagerInput,
): AsyncGenerator<NcpEndpointEvent, RuntimeToolCallExecutor> {
  let modelInput = input.modelInput;
  let overflowRetried = false;
  for (let attempt = 1; ; attempt += 1) {
    let attemptState: NcpRuntimeStreamAttemptState = {
      ...createNcpRuntimeStreamAttemptState(),
      messageId: input.messageId,
    };
    const toolExecutor = new RuntimeToolCallExecutor({
      executeToolCall: input.executeToolCall,
      supportsParallelToolCalls: input.supportsParallelToolCalls,
      toRunErrorEvent: (error) => input.toRunErrorEvent(error, input.runStartedAt),
      toolCallBudget: input.executionManager.toolCallBudget,
    });
    try {
      const encoded = input.streamEncoder.encode(
        abortableRuntimeStream(
          input.executionManager.observeModelCall(
            input.llmApi.generate(modelInput, {
              signal: input.signal,
              sessionId: input.sessionId,
              requestId: input.messageId,
            }),
          ),
          input.signal,
        ),
        {
          sessionId: input.sessionId,
          messageId: input.messageId,
          runId: input.spec.runId,
          correlationId: input.spec.correlationId,
        },
      );
      for await (const event of input.drainRuntimeEvents(encoded, toolExecutor)) {
        attemptState = observeNcpRuntimeStreamAttemptEvent(attemptState, event);
        yield event;
      }
      return toolExecutor;
    } catch (error) {
      if (!overflowRetried && !input.hasAttemptedTool?.() && input.recoverContextOverflow && isContextOverflow(error)) {
        overflowRetried = true;
        const previousBytes = JSON.stringify(modelInput).length;
        let installed = false;
        const recovery = input.recoverContextOverflow();
        let next = await recovery.next();
        while (!next.done) {
          const event = next.value;
          if (event.type === "message.sent" && event.payload.message.metadata?.nextclaw_timeline_kind === "context_compaction"
            && (event.payload.message.metadata.checkpoint as { status?: string } | undefined)?.status === "compressed") installed = true;
          yield event;
          next = await recovery.next();
        }
        if (!installed || JSON.stringify(next.value).length >= previousBytes) throw error;
        modelInput = next.value;
        continue;
      }
      const failure = { events: [], error };
      if (attempt >= 3 || input.hasAttemptedTool?.() || !shouldRetryNcpRuntimeStreamAttempt({
        failure,
        signal: input.signal,
      })) {
        throw error;
      }
      for (const event of createNcpRuntimeStreamRetryEvents({
        attempt,
        correlationId: input.spec.correlationId,
        failure,
        runId: input.spec.runId,
        sessionId: input.sessionId,
        state: attemptState,
      })) {
        yield await input.applyEvent(input.sessionRun, event);
      }
      await sleep(getNcpRuntimeStreamRetryDelayMs(attempt), input.signal);
      if (input.signal?.aborted) {
        return toolExecutor;
      }
    }
  }
}

function isContextOverflow(error: unknown): boolean {
  const value = error as { code?: unknown; message?: unknown } | null;
  return value?.code === "context_length_exceeded" || value?.code === "MODEL_INPUT_OVERFLOW"
    || (typeof value?.message === "string" && /maximum context length|context(?:_|\s)*(?:length|window).*(?:exceed|overflow)|too many tokens/i.test(value.message));
}

function sleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, delayMs);
    if (!signal) {
      return;
    }
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

async function* abortableRuntimeStream(
  stream: AsyncIterable<OpenAIChatChunk>,
  signal?: AbortSignal,
): AsyncIterable<OpenAIChatChunk> {
  for await (const chunk of stream) {
    if (signal?.aborted) {
      break;
    }
    yield chunk;
    if (signal?.aborted) {
      break;
    }
  }
}
