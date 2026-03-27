import { createRequire } from "node:module";
import {
  type NcpAgentRunInput,
  type NcpAgentRunOptions,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";
import {
  type ClaudeCodeLoader,
  type ClaudeCodeMessage,
  type ClaudeCodeSdkModule,
  type ClaudeCodeSdkNcpAgentRuntimeConfig,
} from "./claude-code-sdk-types.js";
import {
  createClaudeSdkEventMapperState,
  flushClaudeSdkMessageEventState,
  mapClaudeMessageEvent,
  type ClaudeSdkEventMapperState,
} from "./claude-sdk-ncp-event-mapper.js";
import {
  createId,
  extractFailureMessage,
  readUserText,
  toAbortError,
} from "./claude-code-runtime-utils.js";
import {
  buildClaudeQueryOptions,
  createAbortBridge,
  createRequestTimeout,
  prepareClaudeGatewayAccess,
  type ClaudePreparedGatewayAccess,
} from "./claude-code-query-runtime.js";
import {
  resolveBundledClaudeAgentSdkCliPath,
  resolveCurrentProcessExecutable,
} from "./claude-code-process-resolution.js";

const require = createRequire(import.meta.url);
const claudeCodeLoader = require("../claude-code-loader.cjs") as ClaudeCodeLoader;

export type { ClaudeCodeSdkNcpAgentRuntimeConfig } from "./claude-code-sdk-types.js";
export {
  loadAndProbeClaudeCodeSdkCapability,
  probeClaudeCodeSdkCapability,
  type ClaudeCodeSdkCapabilityProbeConfig,
  type ClaudeCodeSdkCapabilityProbeResult,
} from "./claude-code-capability-probe.js";
export { DEFAULT_CLAUDE_EXECUTION_PROBE_TIMEOUT_MS } from "./claude-code-runtime-utils.js";

export class ClaudeCodeSdkNcpAgentRuntime implements NcpAgentRuntime {
  private sdkModulePromise: Promise<ClaudeCodeSdkModule> | null = null;
  private preparedAccessPromise: Promise<ClaudePreparedGatewayAccess> | null = null;
  private sessionRuntimeId: string | null;
  private readonly sessionMetadata: Record<string, unknown>;
  private readonly bundledCliPath = resolveBundledClaudeAgentSdkCliPath();
  private readonly currentProcessExecutable = resolveCurrentProcessExecutable();

  constructor(private readonly config: ClaudeCodeSdkNcpAgentRuntimeConfig) {
    this.sessionRuntimeId = config.sessionRuntimeId?.trim() || null;
    this.sessionMetadata = {
      ...(config.sessionMetadata ? structuredClone(config.sessionMetadata) : {}),
    };
  }

  async *run(
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const messageId = createId("claude-message");
    const runId = createId("claude-run");
    const eventState = createClaudeSdkEventMapperState();
    let finished = false;

    yield* this.emitReadyEvents(input.sessionId, messageId, runId);

    const { query, abortBridge, abortController, timeout } = await this.createQueryRun(input, options);

    try {
      for await (const message of query) {
        if (abortController.signal.aborted) {
          throw toAbortError(abortController.signal.reason);
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

      yield* this.emitTextEnd(input.sessionId, messageId, eventState);
      yield* this.emitFinalEvents(input.sessionId, messageId, runId);
      finished = true;
    } catch (error) {
      if (abortController.signal.aborted) {
        throw toAbortError(abortController.signal.reason);
      }
      throw error;
    } finally {
      abortBridge.dispose();
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      query.close?.();

      if (!finished) {
        yield* this.emitClaudeFlushEvents(input.sessionId, messageId, eventState);
        yield* this.emitTextEnd(input.sessionId, messageId, eventState);
      }
    }
  }

  private async getSdkModule(): Promise<ClaudeCodeSdkModule> {
    if (!this.sdkModulePromise) {
      this.sdkModulePromise = claudeCodeLoader.loadClaudeCodeSdkModule();
    }
    return this.sdkModulePromise;
  }

  private async getPreparedAccess(): Promise<ClaudePreparedGatewayAccess> {
    if (!this.preparedAccessPromise) {
      this.preparedAccessPromise = prepareClaudeGatewayAccess(this.config);
    }
    return await this.preparedAccessPromise;
  }

  private async createQueryRun(input: NcpAgentRunInput, options?: NcpAgentRunOptions): Promise<{
    query: ReturnType<ClaudeCodeSdkModule["query"]>;
    abortBridge: ReturnType<typeof createAbortBridge>;
    abortController: AbortController;
    timeout: ReturnType<typeof setTimeout> | null;
  }> {
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
        }),
      }),
      abortBridge,
      abortController: abortBridge.abortController,
      timeout: createRequestTimeout(this.config.requestTimeoutMs, abortBridge.abortController),
    };
  }

  private async buildTurnInput(input: NcpAgentRunInput): Promise<string> {
    if (this.config.inputBuilder) {
      return await this.config.inputBuilder(input);
    }
    return readUserText(input);
  }

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
      this.updateSessionRuntimeId(message.session_id);
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
    yield* this.emitEvent({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId,
        messageId,
        runId,
      },
    });
    yield* this.emitEvent({
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
    });
  }

  private async *emitRunError(
    sessionId: string,
    messageId: string,
    runId: string,
    error: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.emitEvent({
      type: NcpEventType.RunError,
      payload: {
        sessionId,
        messageId,
        runId,
        error,
      },
    });
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
      yield* this.emitEvent({
        type: NcpEventType.MessageTextStart,
        payload: {
          sessionId,
          messageId,
        },
      });
      state.textStarted = true;
    }

    state.emittedText += delta;
    yield* this.emitEvent({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId,
        messageId,
        delta,
      },
    });
  }

  private async *emitTextEnd(
    sessionId: string,
    messageId: string,
    state: ClaudeSdkEventMapperState,
  ): AsyncGenerator<NcpEndpointEvent> {
    if (!state.textStarted) {
      return;
    }

    yield* this.emitEvent({
      type: NcpEventType.MessageTextEnd,
      payload: {
        sessionId,
        messageId,
      },
    });
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
  }

  private async *emitFinalEvents(
    sessionId: string,
    messageId: string,
    runId: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.emitEvent({
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
    });
    yield* this.emitEvent({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId,
        messageId,
        runId,
      },
    });
  }

  private updateSessionRuntimeId(nextSessionId: string): void {
    const normalizedSessionId = nextSessionId.trim();
    if (!normalizedSessionId || normalizedSessionId === this.sessionRuntimeId) {
      return;
    }

    this.sessionRuntimeId = normalizedSessionId;
    const nextMetadata = {
      ...this.sessionMetadata,
      session_type: "claude",
      claude_session_id: normalizedSessionId,
    };
    this.sessionMetadata.session_type = "claude";
    this.sessionMetadata.claude_session_id = normalizedSessionId;
    this.config.setSessionMetadata?.(nextMetadata);
  }
}
