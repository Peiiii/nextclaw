import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";
import type { SessionStore } from "@anthropic-ai/claude-agent-sdk";
import {
  createNcpEndpointEvent,
  type NcpAgentRunInput,
  type NcpAgentRunOptions,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";
import { buildCompletedAssistantMessage } from "./completed-assistant-message.utils.js";
import {
  type ClaudeCodeLoader,
  type ClaudeCodeMessage,
  type ClaudeCodeSdkModule,
  type ClaudeCodeSdkNcpAgentRuntimeConfig,
} from "./types/claude-code-sdk.types.js";
import {
  createClaudeSdkEventMapperState,
  flushClaudeSdkMessageEventState,
  mapClaudeMessageEvent,
  type ClaudeSdkEventMapperState,
} from "@claude-code-sdk/utils/claude-sdk-ncp-event-mapper.utils.js";
import {
  createId,
  extractFailureMessage,
  readUserText,
  toAbortError,
} from "@claude-code-sdk/utils/claude-code-runtime.utils.js";
import {
  buildClaudeQueryOptions,
  MAX_CLAUDE_QUERY_ATTEMPTS,
  createAbortBridge,
  createRequestTimeout,
  disposeClaudeQueryRun,
  prepareClaudeGatewayAccess,
  shouldRetryClaudeQuery,
  type ClaudePreparedGatewayAccess,
} from "@claude-code-sdk/utils/claude-code-query-runtime.utils.js";
import {
  resolveBundledClaudeAgentSdkCliPath,
  resolveCurrentProcessExecutable,
} from "./claude-code-process-resolution.js";
import { createClaudeCodeSessionStore } from "./stores/claude-code-session.store.js";

const require = createRequire(import.meta.url);
const claudeCodeLoader = require("../claude-code-loader.cjs") as ClaudeCodeLoader;

export type { ClaudeCodeSdkNcpAgentRuntimeConfig } from "./types/claude-code-sdk.types.js";
export {
  loadAndProbeClaudeCodeSdkCapability,
  probeClaudeCodeSdkCapability,
  type ClaudeCodeSdkCapabilityProbeConfig,
  type ClaudeCodeSdkCapabilityProbeResult,
} from "@claude-code-sdk/utils/claude-code-capability-probe.utils.js";
export { DEFAULT_CLAUDE_EXECUTION_PROBE_TIMEOUT_MS } from "@claude-code-sdk/utils/claude-code-runtime.utils.js";

export class ClaudeCodeSdkNcpAgentRuntime implements NcpAgentRuntime {
  private sdkModulePromise: Promise<ClaudeCodeSdkModule> | null = null;
  private preparedAccessPromise: Promise<ClaudePreparedGatewayAccess> | null = null;
  private sessionRuntimeId: string | null;
  private readonly sessionStore: SessionStore;
  private readonly sessionMetadata: Record<string, unknown>;
  private readonly bundledCliPath = resolveBundledClaudeAgentSdkCliPath();
  private readonly currentProcessExecutable = resolveCurrentProcessExecutable();
  private readonly runStartedAtByRunId = new Map<string, string>();

  constructor(private readonly config: ClaudeCodeSdkNcpAgentRuntimeConfig) {
    this.sessionRuntimeId = config.sessionRuntimeId?.trim() || null;
    this.sessionStore = config.sessionStore ?? createClaudeCodeSessionStore(config);
    this.sessionMetadata = {
      ...(config.sessionMetadata ? structuredClone(config.sessionMetadata) : {}),
    };
  }

  async *run(
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const messageId = createId("claude-message");
    const runId = (input as NcpAgentRunInput & { runId?: string }).runId ?? createId("claude-run");
    yield* this.emitReadyEvents(input.sessionId, messageId, runId);
    for (let attempt = 1; attempt <= MAX_CLAUDE_QUERY_ATTEMPTS; attempt += 1) {
      const eventState = createClaudeSdkEventMapperState();
      let finished = false;
      let retry = false;
      const { query, abortBridge, abortController, timeout } = await this.createQueryRun(input, options);

      try {
        for await (const message of query) {
          if (abortController.signal.aborted) {
            throw toAbortError(abortController.signal.reason);
          }
          if (shouldRetryClaudeQuery(attempt, message, eventState.hasVisibleOutput())) {
            retry = true;
            break;
          }
          const shouldStop = yield* this.processMessage({
            sessionId: input.sessionId,
            messageId,
            runId,
            message,
            eventState,
          });
          if (shouldStop) {
            finished = true;
            return;
          }
        }

        if (!retry) {
          yield* this.emitFinalEvents(input.sessionId, messageId, runId, eventState);
          finished = true;
          return;
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          throw toAbortError(abortController.signal.reason);
        }
        throw error;
      } finally {
        disposeClaudeQueryRun({ abortBridge, query, timeout });
        if (!finished) {
          yield* this.emitClaudeFlushEvents(input.sessionId, messageId, eventState);
        }
      }

      await sleep(500 * attempt);
    }
  }

  private getSdkModule = async (): Promise<ClaudeCodeSdkModule> => {
    if (!this.sdkModulePromise) {
      this.sdkModulePromise = claudeCodeLoader.loadClaudeCodeSdkModule();
    }
    return this.sdkModulePromise;
  };

  private getPreparedAccess = async (): Promise<ClaudePreparedGatewayAccess> => {
    if (!this.preparedAccessPromise) {
      this.preparedAccessPromise = prepareClaudeGatewayAccess(this.config);
    }
    return await this.preparedAccessPromise;
  };

  private createQueryRun = async (input: NcpAgentRunInput, options?: NcpAgentRunOptions): Promise<{
    query: ReturnType<ClaudeCodeSdkModule["query"]>;
    abortBridge: ReturnType<typeof createAbortBridge>;
    abortController: AbortController;
    timeout: ReturnType<typeof setTimeout> | null;
  }> => {
    const sdk = await this.getSdkModule();
    const preparedAccess = await this.getPreparedAccess();
    const abortBridge = createAbortBridge(options);

    return {
      query: sdk.query({
        prompt: await this.buildTurnInput(input),
        options: buildClaudeQueryOptions({
          config: this.config,
          abortController: abortBridge.abortController,
          preparedAccess,
          bundledCliPath: this.bundledCliPath,
          currentProcessExecutable: this.currentProcessExecutable,
          sessionRuntimeId: this.sessionRuntimeId,
          sessionStore: this.sessionStore,
        }),
      }),
      abortBridge,
      abortController: abortBridge.abortController,
      timeout: createRequestTimeout(this.config.requestTimeoutMs, abortBridge.abortController),
    };
  };

  private buildTurnInput = async (input: NcpAgentRunInput): Promise<string> => {
    if (this.config.inputBuilder) {
      return await this.config.inputBuilder(input);
    }
    return readUserText(input);
  };

  private async *emitEvent(event: NcpEndpointEvent): AsyncGenerator<NcpEndpointEvent> {
    await this.config.stateManager?.dispatch(event);
    yield event;
  }

  private async *processMessage(params: {
    sessionId: string;
    messageId: string;
    runId: string;
    message: ClaudeCodeMessage;
    eventState: ClaudeSdkEventMapperState;
  }): AsyncGenerator<NcpEndpointEvent, boolean> {
    const { sessionId, messageId, runId, message, eventState } = params;

    if (typeof message.session_id === "string" && message.session_id.trim()) {
      await this.updateSessionRuntimeId(message.session_id);
    }

    const failure = extractFailureMessage(message);
    if (failure) {
      yield* this.emitRunError(sessionId, messageId, runId, failure);
      return true;
    }

    for await (const event of mapClaudeMessageEvent({
      sessionId,
      messageId,
      message,
      state: eventState,
    })) {
      yield* this.emitEvent(event);
    }

    return false;
  }

  private async *emitReadyEvents(
    sessionId: string,
    messageId: string,
    runId: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    const startedAt = new Date().toISOString();
    this.runStartedAtByRunId.set(runId, startedAt);
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId,
        messageId,
        runId,
        startedAt,
      },
    }, startedAt));
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId,
        messageId,
        runId,
        metadata: {
          kind: "ready",
          runId,
          sessionId,
          supportsAbort: true,
        },
      },
    }));
  }

  private async *emitRunError(
    sessionId: string,
    messageId: string,
    runId: string,
    error: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    const endedAt = new Date().toISOString();
    const startedAt = this.runStartedAtByRunId.get(runId);
    this.runStartedAtByRunId.delete(runId);
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.RunError,
      payload: {
        sessionId,
        messageId,
        runId,
        error,
        startedAt,
        endedAt,
      },
    }, endedAt));
  }

  private async *emitTextDelta(
    sessionId: string,
    messageId: string,
    state: ClaudeSdkEventMapperState,
    delta: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    if (!delta) {
      return;
    }

    if (!state.textStarted) {
      yield* this.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageTextStart,
        payload: {
          sessionId,
          messageId,
        },
      }));
      state.textStarted = true;
    }

    state.emittedText += delta;
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId,
        messageId,
        delta,
      },
    }));
  }

  private async *emitTextEnd(
    sessionId: string,
    messageId: string,
    state: ClaudeSdkEventMapperState,
  ): AsyncGenerator<NcpEndpointEvent> {
    if (!state.textStarted) {
      return;
    }

    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.MessageTextEnd,
      payload: {
        sessionId,
        messageId,
      },
    }));
    state.textStarted = false;
  }

  private async *emitClaudeFlushEvents(
    sessionId: string,
    messageId: string,
    state: ClaudeSdkEventMapperState,
  ): AsyncGenerator<NcpEndpointEvent> {
    const events = flushClaudeSdkMessageEventState({
      sessionId,
      messageId,
      state,
    });

    for (const event of events) {
      yield* this.emitEvent(event);
    }
    yield* this.emitTextEnd(sessionId, messageId, state);
  }

  private async *emitFinalEvents(
    sessionId: string,
    messageId: string,
    runId: string,
    state: ClaudeSdkEventMapperState,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.emitTextEnd(sessionId, messageId, state);
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.RunMetadata,
      payload: {
        sessionId,
        messageId,
        runId,
        metadata: {
          kind: "final",
          sessionId,
        },
      },
    }));
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId,
        message: buildCompletedAssistantMessage({
          stateManager: this.config.stateManager,
          sessionId,
          messageId,
        }),
      },
    }));
    const endedAt = new Date().toISOString();
    const startedAt = this.runStartedAtByRunId.get(runId);
    this.runStartedAtByRunId.delete(runId);
    yield* this.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId,
        messageId,
        runId,
        startedAt,
        endedAt,
      },
    }, endedAt));
  }

  private updateSessionRuntimeId = async (nextSessionId: string): Promise<void> => {
    const normalizedSessionId = nextSessionId.trim();
    if (!normalizedSessionId || normalizedSessionId === this.sessionRuntimeId) {
      return;
    }

    this.sessionRuntimeId = normalizedSessionId;
    this.sessionMetadata.session_type = "claude";
    this.sessionMetadata.claude_session_id = normalizedSessionId;
    await this.config.setSessionMetadata?.({ ...this.sessionMetadata });
  };
}
