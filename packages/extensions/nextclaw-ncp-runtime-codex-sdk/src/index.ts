import { createRequire } from "node:module";
import type { Codex as CodexClient, CodexOptions, Thread, ThreadOptions } from "@openai/codex-sdk";
import {
  type NcpAgentConversationStateManager,
  type NcpAgentRunInput,
  type NcpAgentRunOptions,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";
import { buildCompletedAssistantMessage } from "./completed-assistant-message.utils.js";
import {
  type ItemTextSnapshot,
  mapCodexItemEvent,
  type ToolSnapshot,
} from "./utils/codex-sdk-ncp-event-mapper.utils.js";
import { buildCodexCliEnv } from "./codex-cli-env.js";
import {
  buildCodexTurnInputFromRunInput,
  type CodexAssetContentPathResolver,
  type CodexThreadInput,
} from "./codex-input.utils.js";
export { buildCodexInputBuilder } from "./codex-input.utils.js";
export type { CodexAssetContentPathResolver } from "./codex-input.utils.js";

type CodexCtor = new (options: CodexOptions) => CodexClient;

type CodexLoader = {
  loadCodexConstructor: () => Promise<CodexCtor>;
};

const require = createRequire(import.meta.url);
const codexLoader = require("../codex-sdk-loader.cjs") as CodexLoader;

export type CodexSdkNcpAgentRuntimeConfig = {
  sessionId: string;
  apiKey: string;
  apiBase?: string;
  model?: string;
  threadId?: string | null;
  codexPathOverride?: string;
  env?: Record<string, string>;
  cliConfig?: CodexOptions["config"];
  threadOptions?: ThreadOptions;
  sessionMetadata?: Record<string, unknown>;
  setSessionMetadata?: (nextMetadata: Record<string, unknown>) => void;
  inputBuilder?: (input: NcpAgentRunInput) => Promise<CodexThreadInput> | CodexThreadInput;
  resolveAssetContentPath?: CodexAssetContentPathResolver;
  stateManager?: NcpAgentConversationStateManager;
};

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function toAbortError(reason: unknown): Error {
  if (reason instanceof Error) {
    return reason;
  }
  const message = typeof reason === "string" && reason.trim() ? reason.trim() : "operation aborted";
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function normalizeThreadOptions(
  options: ThreadOptions | undefined,
  model: string | undefined,
): ThreadOptions {
  return {
    ...options,
    skipGitRepoCheck: options?.skipGitRepoCheck ?? true,
    ...(model ? { model } : {}),
  };
}

function isItemLifecycleEvent(
  event: Parameters<typeof mapCodexItemEvent>[0]["event"] | { type: string },
): event is Parameters<typeof mapCodexItemEvent>[0]["event"] {
  return event.type === "item.started" || event.type === "item.updated" || event.type === "item.completed";
}

export class CodexSdkNcpAgentRuntime implements NcpAgentRuntime {
  private codexPromise: Promise<CodexClient> | null = null;
  private thread: Thread | null = null;
  private threadId: string | null;
  private readonly sessionMetadata: Record<string, unknown>;

  constructor(private readonly config: CodexSdkNcpAgentRuntimeConfig) {
    this.threadId = config.threadId?.trim() || null;
    this.sessionMetadata = {
      ...(config.sessionMetadata ? structuredClone(config.sessionMetadata) : {}),
    };
  }

  run = async function* (
    this: CodexSdkNcpAgentRuntime,
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const messageId = createId("codex-message");
    const runId = createId("codex-run");
    const itemTextById = new Map<string, ItemTextSnapshot>();
    const toolStateById = new Map<string, ToolSnapshot>();

    yield* this.emitRunStarted(input.sessionId, messageId, runId);
    yield* this.emitReadyMetadata(input.sessionId, messageId, runId);

    const thread = await this.resolveThread();
    const turnInput = await this.buildTurnInput(input);
    const streamed = await thread.runStreamed(turnInput, {
      ...(options?.signal ? { signal: options.signal } : {}),
    });

    try {
      yield* this.streamTurnEvents({
        sessionId: input.sessionId,
        messageId,
        runId,
        streamed,
        signal: options?.signal,
        itemTextById,
        toolStateById,
      });
    } catch (error) {
      if (options?.signal?.aborted) {
        throw toAbortError(options.signal.reason);
      }
      throw error;
    }
  };

  private getCodex = async (): Promise<CodexClient> => {
    if (!this.codexPromise) {
      const env = buildCodexCliEnv(this.config);
      this.codexPromise = codexLoader.loadCodexConstructor().then((Ctor) =>
        new Ctor({
          apiKey: this.config.apiKey,
          baseUrl: this.config.apiBase,
          ...(this.config.codexPathOverride ? { codexPathOverride: this.config.codexPathOverride } : {}),
          ...(env ? { env } : {}),
          ...(this.config.cliConfig ? { config: this.config.cliConfig } : {}),
        }),
      );
    }
    return this.codexPromise;
  };

  private resolveThread = async (): Promise<Thread> => {
    if (this.thread) {
      return this.thread;
    }

    const codex = await this.getCodex();
    const threadOptions = normalizeThreadOptions(this.config.threadOptions, this.config.model);

    this.thread = this.threadId
      ? codex.resumeThread(this.threadId, threadOptions)
      : codex.startThread(threadOptions);
    return this.thread;
  };

  private buildTurnInput = async (input: NcpAgentRunInput): Promise<CodexThreadInput> => {
    if (this.config.inputBuilder) {
      return await this.config.inputBuilder(input);
    }
    return await buildCodexTurnInputFromRunInput(input, {
      resolveAssetContentPath: this.config.resolveAssetContentPath,
    });
  };

  private emitEvent = async function* (
    this: CodexSdkNcpAgentRuntime,
    event: NcpEndpointEvent,
  ): AsyncGenerator<NcpEndpointEvent> {
    await this.config.stateManager?.dispatch(event);
    yield event;
  };

  private emitRunStarted = async function* (
    this: CodexSdkNcpAgentRuntime,
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
  };

  private emitReadyMetadata = async function* (
    this: CodexSdkNcpAgentRuntime,
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
          kind: "ready",
          runId,
          sessionId,
          supportsAbort: true,
        },
      },
    });
  };

  private emitRunError = async function* (
    this: CodexSdkNcpAgentRuntime,
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
  };

  private emitRunCompleted = async function* (
    this: CodexSdkNcpAgentRuntime,
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
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId,
        message: buildCompletedAssistantMessage({
          stateManager: this.config.stateManager,
          sessionId,
          messageId,
        }),
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
  };

  private streamTurnEvents = async function* (
    this: CodexSdkNcpAgentRuntime,
    params: {
      sessionId: string;
      messageId: string;
      runId: string;
      streamed: Awaited<ReturnType<Thread["runStreamed"]>>;
      signal?: AbortSignal;
      itemTextById: Map<string, ItemTextSnapshot>;
      toolStateById: Map<string, ToolSnapshot>;
    },
  ): AsyncGenerator<NcpEndpointEvent> {
    let finished = false;
    for await (const event of params.streamed.events) {
      const shouldFinish = yield* this.handleThreadEvent({
        sessionId: params.sessionId,
        messageId: params.messageId,
        runId: params.runId,
        event,
        signal: params.signal,
        itemTextById: params.itemTextById,
        toolStateById: params.toolStateById,
      });
      if (shouldFinish) {
        finished = true;
        return;
      }
    }

    if (!finished) {
      yield* this.emitRunCompleted(params.sessionId, params.messageId, params.runId);
    }
  };

  private handleThreadEvent = async function* (
    this: CodexSdkNcpAgentRuntime,
    params: {
      sessionId: string;
      messageId: string;
      runId: string;
      event: Awaited<ReturnType<Thread["runStreamed"]>>["events"] extends AsyncGenerator<infer T> ? T : never;
      signal?: AbortSignal;
      itemTextById: Map<string, ItemTextSnapshot>;
      toolStateById: Map<string, ToolSnapshot>;
    },
  ): AsyncGenerator<NcpEndpointEvent, boolean> {
    if (params.signal?.aborted) {
      throw toAbortError(params.signal.reason);
    }

    if (params.event.type === "thread.started") {
      this.updateThreadId(params.event.thread_id);
      return false;
    }

    if (params.event.type === "turn.failed") {
      yield* this.emitRunError(
        params.sessionId,
        params.messageId,
        params.runId,
        params.event.error.message,
      );
      return true;
    }

    if (params.event.type === "error") {
      yield* this.emitRunError(
        params.sessionId,
        params.messageId,
        params.runId,
        params.event.message,
      );
      return true;
    }

    if (isItemLifecycleEvent(params.event)) {
      for await (const mappedEvent of mapCodexItemEvent({
        sessionId: params.sessionId,
        messageId: params.messageId,
        event: params.event,
        itemTextById: params.itemTextById,
        toolStateById: params.toolStateById,
      })) {
        yield* this.emitEvent(mappedEvent);
      }
      return false;
    }

    if (params.event.type === "turn.completed") {
      yield* this.emitRunCompleted(params.sessionId, params.messageId, params.runId);
      return true;
    }

    return false;
  };

  private updateThreadId = (nextThreadId: string): void => {
    const normalizedThreadId = nextThreadId.trim();
    if (!normalizedThreadId || normalizedThreadId === this.threadId) {
      return;
    }
    this.threadId = normalizedThreadId;
    const nextMetadata = {
      ...this.sessionMetadata,
      session_type: "codex",
      codex_thread_id: normalizedThreadId,
    };
    this.sessionMetadata.codex_thread_id = normalizedThreadId;
    this.sessionMetadata.session_type = "codex";
    this.config.setSessionMetadata?.(nextMetadata);
  };
}
