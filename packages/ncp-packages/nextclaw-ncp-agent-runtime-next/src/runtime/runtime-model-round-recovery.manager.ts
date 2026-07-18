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
  for (let attempt = 1; ; attempt += 1) {
    let attemptState: NcpRuntimeStreamAttemptState = {
      ...createNcpRuntimeStreamAttemptState(),
      messageId: input.messageId,
    };
    const toolExecutor = new RuntimeToolCallExecutor({
      executeToolCall: input.executeToolCall,
      toRunErrorEvent: (error) => input.toRunErrorEvent(error, input.runStartedAt),
    });
    try {
      const encoded = input.streamEncoder.encode(
        abortableRuntimeStream(
          input.executionManager.observeModelCall(
            input.llmApi.generate(input.modelInput, { signal: input.signal }),
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
      const failure = { events: [], error };
      if (!shouldRetryNcpRuntimeStreamAttempt({
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
