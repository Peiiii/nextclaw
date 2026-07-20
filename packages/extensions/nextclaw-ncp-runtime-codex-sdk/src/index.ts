import { createRequire } from "node:module";
import type { Codex as CodexClient, CodexOptions, Thread, ThreadOptions } from "@openai/codex-sdk";
import {
  type NcpAgentConversationStateManager,
  type NcpAgentRunInput,
  type NcpAgentRunOptions,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
} from "@nextclaw/ncp";
import type {
  CodexLiveOutputChannel,
  CodexLiveOutputStream,
} from "./services/codex-live-output-stream.service.js";
import { CodexLiveOutputEventMergeService } from "./services/codex-live-output-event-merge.service.js";
import { CodexNcpRunEventEmitter } from "./services/codex-ncp-run-event-emitter.service.js";
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
export { buildCodexBridgeModelProviderId } from "./codex-model-provider.js";
export { ensureCodexOpenAiResponsesBridge } from "./utils/codex-openai-responses-bridge.utils.js";
export type { CodexOpenAiResponsesBridgeRuntimeConfig } from "./utils/codex-openai-responses-bridge.utils.js";
export type { CodexOpenAiResponsesBridgeResult } from "./codex-openai-responses-bridge-shared.utils.js";
export { CodexLiveOutputStream } from "./services/codex-live-output-stream.service.js";
export {
  CodexAppServerNcpAgentRuntime,
} from "./services/codex-app-server-ncp-agent-runtime.service.js";
export {
  CodexDesktopThreadIndexSyncService,
} from "./services/codex-desktop-thread-index-sync.service.js";
export type { CodexAppServerNcpAgentRuntimeConfig } from "./types/codex-app-server-runtime.types.js";
export type {
  CodexDesktopThreadIndexSync,
  CodexDesktopThreadIndexSyncServiceOptions,
} from "./services/codex-desktop-thread-index-sync.service.js";
export type {
  CodexLiveOutputChannel,
  CodexLiveOutputEvent,
} from "./services/codex-live-output-stream.service.js";

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
  setSessionMetadata?: (nextMetadata: Record<string, unknown>) => void | Promise<void>;
  inputBuilder?: (input: NcpAgentRunInput) => Promise<CodexThreadInput> | CodexThreadInput;
  liveOutputStream?: CodexLiveOutputStream;
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
  private readonly eventEmitter: CodexNcpRunEventEmitter;
  private readonly liveOutputEventMergeService = new CodexLiveOutputEventMergeService();
  private thread: Thread | null = null;
  private threadId: string | null;
  private readonly sessionMetadata: Record<string, unknown>;

  constructor(private readonly config: CodexSdkNcpAgentRuntimeConfig) {
    this.eventEmitter = new CodexNcpRunEventEmitter(config.stateManager);
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
    const signal = options?.signal;
    const messageId = createId("codex-message");
    const runId = (input as NcpAgentRunInput & { runId?: string }).runId ?? createId("codex-run");
    const itemTextById = new Map<string, ItemTextSnapshot>();
    const toolStateById = new Map<string, ToolSnapshot>();

    yield* this.eventEmitter.emitRunStarted(input.sessionId, messageId, runId);
    yield* this.eventEmitter.emitReadyMetadata(input.sessionId, messageId, runId);

    const turnInput = await this.buildTurnInput(input);
    const streamed = await this.runStreamedWithCurrentThread(turnInput, signal);

    try {
      yield* this.streamTurnEvents({
        sessionId: input.sessionId,
        messageId,
        runId,
        streamed,
        signal,
        itemTextById,
        toolStateById,
      });
    } catch (error) {
      if (signal?.aborted) {
        throw toAbortError(signal.reason);
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

  private runStreamedWithCurrentThread = async (
    turnInput: CodexThreadInput,
    signal?: AbortSignal,
  ): ReturnType<Thread["runStreamed"]> => {
    const thread = await this.resolveThread();
    this.config.liveOutputStream?.reset();
    return await thread.runStreamed(turnInput, {
      ...(signal ? { signal } : {}),
    });
  };

  private buildTurnInput = async (input: NcpAgentRunInput): Promise<CodexThreadInput> => {
    if (this.config.inputBuilder) {
      return await this.config.inputBuilder(input);
    }
    return await buildCodexTurnInputFromRunInput(input, {
      resolveAssetContentPath: this.config.resolveAssetContentPath,
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
    const {
      itemTextById,
      messageId,
      runId,
      sessionId,
      signal,
      streamed,
      toolStateById,
    } =
      params;
    const liveOutputStream = this.config.liveOutputStream;
    if (liveOutputStream) {
      yield* this.liveOutputEventMergeService.stream({
        ...params,
        liveOutputStream,
        emitEvent: (event) => this.eventEmitter.emitEvent(event),
        emitRunCompleted: (sessionId, messageId, runId) =>
          this.eventEmitter.emitRunCompleted(sessionId, messageId, runId),
        handleThreadEvent: (handlerParams) => this.handleThreadEvent(handlerParams),
      });
      return;
    }

    let finished = false;
    for await (const event of streamed.events) {
      const shouldFinish = yield* this.handleThreadEvent({
        sessionId,
        messageId,
        runId,
        event,
        signal,
        itemTextById,
        toolStateById,
      });
      if (shouldFinish) {
        finished = true;
        return;
      }
    }

    if (!finished) {
      yield* this.eventEmitter.emitRunCompleted(sessionId, messageId, runId);
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
      suppressLiveChannels?: Set<CodexLiveOutputChannel>;
      toolStateById: Map<string, ToolSnapshot>;
    },
  ): AsyncGenerator<NcpEndpointEvent, boolean> {
    const {
      event,
      itemTextById,
      messageId,
      runId,
      sessionId,
      signal,
      suppressLiveChannels,
      toolStateById,
    } = params;
    if (signal?.aborted) {
      throw toAbortError(signal.reason);
    }

    if (event.type === "thread.started") {
      await this.updateThreadId(event.thread_id);
      return false;
    }

    if (event.type === "turn.failed") {
      yield* this.eventEmitter.emitRunError(
        sessionId,
        messageId,
        runId,
        event.error.message,
      );
      return true;
    }

    if (event.type === "error") {
      yield* this.eventEmitter.emitRunError(
        sessionId,
        messageId,
        runId,
        event.message,
      );
      return true;
    }

    if (isItemLifecycleEvent(event)) {
      const suppressedChannel =
        event.item.type === "agent_message"
          ? "text"
          : event.item.type === "reasoning"
            ? "reasoning"
            : null;
      if (suppressedChannel && suppressLiveChannels?.has(suppressedChannel)) {
        return false;
      }
      for await (const mappedEvent of mapCodexItemEvent({
        sessionId,
        messageId,
        event,
        itemTextById,
        toolStateById,
      })) {
        yield* this.eventEmitter.emitEvent(mappedEvent);
      }
      return false;
    }

    if (event.type === "turn.completed") {
      yield* this.eventEmitter.emitRunCompleted(sessionId, messageId, runId);
      return true;
    }

    return false;
  };

  private updateThreadId = async (nextThreadId: string): Promise<void> => {
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
    await this.config.setSessionMetadata?.(nextMetadata);
  };
}
