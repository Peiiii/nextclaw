import {
  createNcpEndpointEvent,
  type NcpAgentRunInput,
  type NcpAgentRunOptions,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";
import {
  buildCodexTurnInputFromRunInput,
  type CodexThreadInput,
} from "@/codex-input.utils.js";
import {
  isAppServerToolLikeItem,
  readAppServerReasoningText,
  readAppServerToolArgs,
  readAppServerToolName,
  readAppServerToolResult,
  stringifyAppServerToolArgs,
} from "@/utils/codex-app-server-item-mapper.utils.js";
import {
  compactObject,
  normalizeSandbox,
  splitModelRoute,
  toAppServerInput,
} from "@/utils/codex-app-server-request.utils.js";
import { CodexAppServerClient } from "./codex-app-server-client.service.js";
import type {
  AppServerNotification,
  AppServerThreadItem,
  CodexAppServerNcpAgentRuntimeConfig,
  JsonObject,
} from "@/types/codex-app-server-runtime.types.js";
import { CodexNcpRunEventEmitter } from "./codex-ncp-run-event-emitter.service.js";
import {
  CodexDesktopThreadIndexSyncService,
  type CodexDesktopThreadIndexSync,
} from "./codex-desktop-thread-index-sync.service.js";

export class CodexAppServerNcpAgentRuntime implements NcpAgentRuntime {
  private readonly eventEmitter: CodexNcpRunEventEmitter;
  private readonly sessionMetadata: Record<string, unknown>;
  private readonly desktopThreadIndexSync: CodexDesktopThreadIndexSync | null;
  private clientPromise: Promise<CodexAppServerClient> | null = null;
  private threadId: string | null;

  constructor(private readonly config: CodexAppServerNcpAgentRuntimeConfig) {
    this.eventEmitter = new CodexNcpRunEventEmitter(config.stateManager);
    this.desktopThreadIndexSync = resolveDesktopThreadIndexSync(config);
    this.threadId = config.threadId?.trim() || null;
    this.sessionMetadata = {
      ...(config.sessionMetadata ? structuredClone(config.sessionMetadata) : {}),
    };
  }

  run = async function* (
    this: CodexAppServerNcpAgentRuntime,
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const signal = options?.signal;
    const messageId = createId("codex-message");
    const runId = (input as NcpAgentRunInput & { runId?: string }).runId ?? createId("codex-run");
    const textState = new Set<string>();
    const textDeltaState = new Set<string>();
    const reasoningState = new Set<string>();
    const reasoningDeltaState = new Set<string>();
    const toolState = new Set<string>();

    yield* this.eventEmitter.emitRunStarted(input.sessionId, messageId, runId);
    yield* this.eventEmitter.emitReadyMetadata(input.sessionId, messageId, runId);

    const client = await this.resolveClient();
    await this.resolveThread(client);
    const turnInput = await this.buildTurnInput(input);
    const turn = await client.request<{ turn?: { id?: string } }>("turn/start", {
      threadId: this.threadId ?? "",
      input: toAppServerInput(turnInput),
      ...this.buildTurnOverrides(),
    });
    const turnId = readString(turn.turn?.id);
    const abortListener = (): void => {
      if (turnId && this.threadId) {
        void client.request("turn/interrupt", { threadId: this.threadId, turnId }, 5000).catch(() => undefined);
      }
      client.dispose();
      this.clientPromise = null;
    };
    signal?.addEventListener("abort", abortListener, { once: true });
    try {
      while (true) {
        const next = await client.nextNotification();
        if (signal?.aborted) {
          yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
            type: NcpEventType.MessageAbort,
            payload: { sessionId: input.sessionId, messageId, correlationId: input.correlationId },
          }));
          return;
        }
        if (next.done) {
          return;
        }
        const shouldFinish = yield* this.handleNotification({
          notification: next.value,
          sessionId: input.sessionId,
          messageId,
          runId,
          textState,
          textDeltaState,
          reasoningState,
          reasoningDeltaState,
          toolState,
        });
        if (shouldFinish) {
          return;
        }
      }
    } finally {
      signal?.removeEventListener("abort", abortListener);
    }
  };

  private resolveClient = async (): Promise<CodexAppServerClient> => {
    if (!this.clientPromise) {
      const client = new CodexAppServerClient(this.config);
      this.clientPromise = client.initialize().then(() => client);
    }
    return this.clientPromise;
  };

  private resolveThread = async (client: CodexAppServerClient): Promise<void> => {
    if (this.threadId) {
      const response = await client.request<{ thread?: { id?: string } }>("thread/resume", {
        threadId: this.threadId,
        ...this.buildThreadOverrides(),
      });
      await this.updateThreadId(readString(response.thread?.id) ?? this.threadId);
      return;
    }
    const response = await client.request<{ thread?: { id?: string } }>("thread/start", {
      ...this.buildThreadOverrides(),
    });
    const nextThreadId = readString(response.thread?.id);
    if (nextThreadId) {
      await this.updateThreadId(nextThreadId);
    }
  };

  private buildThreadOverrides = (): JsonObject => {
    const threadOptions = this.config.threadOptions;
    const route = splitModelRoute(threadOptions?.model ?? this.config.model);
    return compactObject({
      cwd: threadOptions?.workingDirectory,
      model: route.model,
      modelProvider: route.modelProvider,
      approvalPolicy: threadOptions?.approvalPolicy,
      sandbox: normalizeSandbox(threadOptions?.sandboxMode),
      config: this.config.cliConfig,
    });
  };

  private buildTurnOverrides = (): JsonObject => {
    const threadOptions = this.config.threadOptions;
    const route = splitModelRoute(threadOptions?.model ?? this.config.model);
    return compactObject({
      cwd: threadOptions?.workingDirectory,
      model: route.model,
      effort: threadOptions?.modelReasoningEffort,
      sandboxPolicy: normalizeSandbox(threadOptions?.sandboxMode),
      approvalPolicy: threadOptions?.approvalPolicy,
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

  private handleNotification = async function* (
    this: CodexAppServerNcpAgentRuntime,
    params: {
      notification: AppServerNotification;
      sessionId: string;
      messageId: string;
      runId: string;
      textState: Set<string>;
      textDeltaState: Set<string>;
      reasoningState: Set<string>;
      reasoningDeltaState: Set<string>;
      toolState: Set<string>;
    },
  ): AsyncGenerator<NcpEndpointEvent, boolean> {
    const {
      messageId,
      notification,
      reasoningDeltaState,
      reasoningState,
      runId,
      sessionId,
      textDeltaState,
      textState,
      toolState,
    } = params;
    if (notification.method === "thread/started") {
      await this.handleThreadStarted(notification.params);
      return false;
    }
    if (notification.method === "item/agentMessage/delta") {
      yield* this.emitTextDelta({
        messageId,
        params: notification.params,
        sessionId,
        textDeltaState,
        textState,
      });
      return false;
    }
    if (
      notification.method === "item/reasoning/textDelta" ||
      notification.method === "item/reasoning/summaryTextDelta"
    ) {
      yield* this.emitReasoningDelta({
        messageId,
        params: notification.params,
        reasoningDeltaState,
        reasoningState,
        sessionId,
      });
      return false;
    }
    if (notification.method === "item/started" || notification.method === "item/completed") {
      const item = notification.params.item as AppServerThreadItem | undefined;
      if (item) {
        yield* this.handleItemLifecycle({
          item,
          eventType: notification.method,
          sessionId,
          messageId,
          reasoningDeltaState,
          textState,
          textDeltaState,
          reasoningState,
          toolState,
        });
      }
      return false;
    }
    if (notification.method === "turn/completed") {
      yield* this.eventEmitter.emitRunCompleted(sessionId, messageId, runId);
      await this.syncDesktopThreadIndex();
      return true;
    }
    if (notification.method === "turn/failed") {
      yield* this.eventEmitter.emitRunError(
        sessionId,
        messageId,
        runId,
        readString(notification.params.error) ?? "Codex turn failed.",
      );
      return true;
    }
    return false;
  };

  private handleThreadStarted = async (params: JsonObject): Promise<void> => {
    const threadId = readString((params.thread as JsonObject | undefined)?.id);
    if (threadId) {
      await this.updateThreadId(threadId);
    }
  };

  private emitTextDelta = async function* (
    this: CodexAppServerNcpAgentRuntime,
    params: {
      params: JsonObject;
      sessionId: string;
      messageId: string;
      textState: Set<string>;
      textDeltaState: Set<string>;
    },
  ): AsyncGenerator<NcpEndpointEvent> {
    const { messageId, sessionId, textDeltaState, textState } = params;
    const itemId = readString(params.params.itemId) ?? "agent-message";
    if (!textState.has(itemId)) {
      textState.add(itemId);
      yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageTextStart,
        payload: { sessionId, messageId },
      }));
    }
    textDeltaState.add(itemId);
    yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.MessageTextDelta,
      payload: { sessionId, messageId, delta: readRawString(params.params.delta) ?? "" },
    }));
  };

  private emitReasoningDelta = async function* (
    this: CodexAppServerNcpAgentRuntime,
    params: {
      params: JsonObject;
      sessionId: string;
      messageId: string;
      reasoningState: Set<string>;
      reasoningDeltaState: Set<string>;
    },
  ): AsyncGenerator<NcpEndpointEvent> {
    const { messageId, reasoningDeltaState, reasoningState, sessionId } = params;
    const itemId = readString(params.params.itemId) ?? "reasoning";
    if (!reasoningState.has(itemId)) {
      reasoningState.add(itemId);
      yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageReasoningStart,
        payload: { sessionId, messageId },
      }));
    }
    reasoningDeltaState.add(itemId);
    yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
      type: NcpEventType.MessageReasoningDelta,
      payload: { sessionId, messageId, delta: readRawString(params.params.delta) ?? "" },
    }));
  };

  private handleItemLifecycle = async function* (
    this: CodexAppServerNcpAgentRuntime,
    params: {
      item: AppServerThreadItem;
      eventType: "item/started" | "item/completed";
      sessionId: string;
      messageId: string;
      textState: Set<string>;
      textDeltaState: Set<string>;
      reasoningState: Set<string>;
      reasoningDeltaState: Set<string>;
      toolState: Set<string>;
    },
  ): AsyncGenerator<NcpEndpointEvent> {
    const {
      eventType,
      item,
      messageId,
      reasoningDeltaState,
      reasoningState,
      sessionId,
      textDeltaState,
      textState,
      toolState,
    } = params;
    const itemId = readString(item.id) ?? createId("codex-item");
    if (item.type === "agentMessage") {
      yield* this.handleAgentMessageItem({
        eventType,
        item,
        itemId,
        messageId,
        sessionId,
        textDeltaState,
        textState,
      });
      return;
    }
    if (item.type === "reasoning") {
      yield* this.handleReasoningItem({
        eventType,
        item,
        itemId,
        messageId,
        reasoningDeltaState,
        reasoningState,
        sessionId,
      });
      return;
    }
    if (!isAppServerToolLikeItem(item.type)) {
      return;
    }
    yield* this.handleToolItem({ eventType, item, itemId, messageId, sessionId, toolState });
  };

  private handleAgentMessageItem = async function* (
    this: CodexAppServerNcpAgentRuntime,
    params: {
      item: AppServerThreadItem;
      itemId: string;
      eventType: "item/started" | "item/completed";
      sessionId: string;
      messageId: string;
      textState: Set<string>;
      textDeltaState: Set<string>;
    },
  ): AsyncGenerator<NcpEndpointEvent> {
    const { eventType, item, itemId, messageId, sessionId, textDeltaState, textState } = params;
    if (!textState.has(itemId)) {
      textState.add(itemId);
      yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageTextStart,
        payload: { sessionId, messageId },
      }));
    }
    const text = readRawString(item.text);
    if (text && !textDeltaState.has(itemId)) {
      yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageTextDelta,
        payload: { sessionId, messageId, delta: text },
      }));
    }
    if (eventType === "item/completed") {
      yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageTextEnd,
        payload: { sessionId, messageId },
      }));
    }
  };

  private handleReasoningItem = async function* (
    this: CodexAppServerNcpAgentRuntime,
    params: {
      item: AppServerThreadItem;
      itemId: string;
      eventType: "item/started" | "item/completed";
      sessionId: string;
      messageId: string;
      reasoningState: Set<string>;
      reasoningDeltaState: Set<string>;
    },
  ): AsyncGenerator<NcpEndpointEvent> {
    const { eventType, item, itemId, messageId, reasoningDeltaState, reasoningState, sessionId } =
      params;
    const reasoningText = readAppServerReasoningText(item);
    const alreadyStarted = reasoningState.has(itemId);
    if (!alreadyStarted && (eventType === "item/started" || reasoningText)) {
      reasoningState.add(itemId);
      yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageReasoningStart,
        payload: { sessionId, messageId },
      }));
    }
    if (!reasoningDeltaState.has(itemId) && reasoningText) {
      yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageReasoningDelta,
        payload: { sessionId, messageId, delta: reasoningText },
      }));
    }
    if (eventType === "item/completed" && reasoningState.has(itemId)) {
      yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageReasoningEnd,
        payload: { sessionId, messageId },
      }));
    }
  };

  private handleToolItem = async function* (
    this: CodexAppServerNcpAgentRuntime,
    params: {
      item: AppServerThreadItem;
      itemId: string;
      eventType: "item/started" | "item/completed";
      sessionId: string;
      messageId: string;
      toolState: Set<string>;
    },
  ): AsyncGenerator<NcpEndpointEvent> {
    const { eventType, item, itemId, messageId, sessionId, toolState } = params;
    if (!toolState.has(itemId)) {
      toolState.add(itemId);
      yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageToolCallStart,
        payload: { sessionId, messageId, toolCallId: itemId, toolName: readAppServerToolName(item) },
      }));
      yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageToolCallArgs,
        payload: {
          sessionId,
          toolCallId: itemId,
          args: stringifyAppServerToolArgs(readAppServerToolArgs(item)),
        },
      }));
      yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageToolCallEnd,
        payload: { sessionId, toolCallId: itemId },
      }));
    }
    if (eventType === "item/completed") {
      yield* this.eventEmitter.emitEvent(createNcpEndpointEvent({
        type: NcpEventType.MessageToolCallResult,
        payload: { sessionId, toolCallId: itemId, content: readAppServerToolResult(item) },
      }));
    }
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

  private syncDesktopThreadIndex = async (): Promise<void> => {
    try {
      await this.desktopThreadIndexSync?.syncThread({ threadId: this.threadId });
    } catch (error) {
      console.error(
        `[nextclaw-codex-app-server] failed to run Codex Desktop thread index sync: ${formatError(error)}`,
      );
    }
  };
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveDesktopThreadIndexSync(
  config: CodexAppServerNcpAgentRuntimeConfig,
): CodexDesktopThreadIndexSync | null {
  if (config.desktopThreadIndexSync === false) {
    return null;
  }
  return config.desktopThreadIndexSync ?? new CodexDesktopThreadIndexSyncService({
    env: { ...process.env, ...config.env },
  });
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readRawString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
