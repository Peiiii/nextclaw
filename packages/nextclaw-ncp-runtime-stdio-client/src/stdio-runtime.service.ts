import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { Readable, Writable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import type {
  NcpAgentConversationStateManager,
  NcpAgentRunInput,
  NcpAgentRunOptions,
  NcpAgentRuntime,
  NcpEndpointEvent,
  NcpProviderRuntimeRoute,
  OpenAITool,
} from "@nextclaw/ncp";
import { NcpEventType } from "@nextclaw/ncp";
import type { StdioRuntimeResolvedConfig, NarpStdioPromptMeta } from "./stdio-runtime-config.utils.js";
import {
  NARP_STDIO_PROMPT_META_KEY,
  buildStdioRuntimeLaunchEnv,
  readString,
} from "./stdio-runtime-config.utils.js";
import {
  buildSpawnFailureMessage,
  isAbortLikeRuntimeError,
  normalizeRuntimeError,
} from "./stdio-runtime-error.utils.js";
import { resolveToolNameFromAcpUpdate } from "./stdio-runtime-tool-name.utils.js";

type AcpClientUpdate = acp.SessionUpdate;

export type StdioRuntimeNcpAgentRuntimeConfig = StdioRuntimeResolvedConfig & {
  sessionId: string;
  stateManager?: NcpAgentConversationStateManager;
  resolveTools?: (input: NcpAgentRunInput) => ReadonlyArray<OpenAITool> | undefined;
  resolveProviderRoute?: (input: NcpAgentRunInput) => NcpProviderRuntimeRoute | undefined;
};

type AcpToolState = {
  toolName: string;
  args?: string;
  completed: boolean;
};

type PromptExecutionState = { settled: boolean; error: unknown };

class UpdateBuffer {
  private readonly updates: AcpClientUpdate[] = [];
  private waiters = new Set<() => void>();

  push = (update: AcpClientUpdate): void => {
    this.updates.push(update);
    this.flush();
  };

  shift = (): AcpClientUpdate | undefined => this.updates.shift();

  hasItems = (): boolean => this.updates.length > 0;

  waitForChange = async (): Promise<void> => {
    if (this.updates.length > 0) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.add(resolve);
    });
  };

  notify = (): void => {
    this.flush();
  };

  private flush = (): void => {
    if (this.waiters.size === 0) {
      return;
    }
    const waiters = [...this.waiters];
    this.waiters.clear();
    for (const waiter of waiters) {
      waiter();
    }
  };
}

class PromptUpdateCollector {
  private readonly parts: Array<
    | { type: "text"; text: string }
    | { type: "reasoning"; text: string }
    | { type: "tool-invocation"; toolCallId: string; toolName: string; state: "partial-call" | "call"; args: string }
  > = [];
  private readonly toolIndex = new Map<string, number>();

  apply = (event: NcpEndpointEvent): void => {
    switch (event.type) {
      case NcpEventType.MessageTextDelta:
        this.appendPart("text", event.payload.delta);
        return;
      case NcpEventType.MessageReasoningDelta:
        this.appendPart("reasoning", event.payload.delta);
        return;
      case NcpEventType.MessageToolCallStart:
        this.upsertTool({
          toolCallId: event.payload.toolCallId,
          toolName: event.payload.toolName,
          args: "",
          state: "partial-call",
        });
        return;
      case NcpEventType.MessageToolCallArgs:
        this.upsertTool({
          toolCallId: event.payload.toolCallId,
          toolName: this.readToolName(event.payload.toolCallId),
          args: event.payload.args,
          state: "partial-call",
        });
        return;
      case NcpEventType.MessageToolCallArgsDelta:
        this.upsertTool({
          toolCallId: event.payload.toolCallId,
          toolName: this.readToolName(event.payload.toolCallId),
          args: `${this.readToolArgs(event.payload.toolCallId)}${event.payload.delta}`,
          state: "partial-call",
        });
        return;
      case NcpEventType.MessageToolCallEnd:
        this.upsertTool({
          toolCallId: event.payload.toolCallId,
          toolName: this.readToolName(event.payload.toolCallId),
          args: this.readToolArgs(event.payload.toolCallId),
          state: "call",
        });
        return;
      default:
        return;
    }
  };

  hasParts = (): boolean => this.parts.length > 0;

  buildParts = (): Array<Record<string, unknown>> => structuredClone(this.parts);

  private appendPart = (type: "text" | "reasoning", text: string): void => {
    if (!text) {
      return;
    }
    const last = this.parts.at(-1);
    if (last?.type === type) {
      last.text = `${last.text}${text}`;
      return;
    }
    this.parts.push({ type, text });
  };

  private upsertTool = (nextTool: {
    toolCallId: string;
    toolName: string;
    args: string;
    state: "partial-call" | "call";
  }): void => {
    const existingIndex = this.toolIndex.get(nextTool.toolCallId);
    if (typeof existingIndex === "number") {
      const existing = this.parts[existingIndex];
      if (existing?.type !== "tool-invocation") {
        return;
      }
      this.parts[existingIndex] = {
        ...existing,
        ...nextTool,
      };
      return;
    }

    this.toolIndex.set(nextTool.toolCallId, this.parts.length);
    this.parts.push({
      type: "tool-invocation",
      ...nextTool,
    });
  };

  private readToolArgs = (toolCallId: string): string => {
    const part = this.findTool(toolCallId);
    return part?.args ?? "";
  };

  private readToolName = (toolCallId: string): string => {
    const part = this.findTool(toolCallId);
    return part?.toolName ?? "unknown";
  };

  private findTool = (
    toolCallId: string,
  ): Extract<(typeof this.parts)[number], { type: "tool-invocation" }> | null => {
    const index = this.toolIndex.get(toolCallId);
    if (typeof index !== "number") {
      return null;
    }
    const part = this.parts[index];
    return part?.type === "tool-invocation" ? part : null;
  };
}

class StdioRuntimeClientBridge {
  private activeSessionId: string | null = null;
  private updateHandler: ((update: AcpClientUpdate) => void) | null = null;

  attach = (params: {
    sessionId: string;
    onUpdate: (update: AcpClientUpdate) => void;
  }): (() => void) => {
    this.activeSessionId = params.sessionId;
    this.updateHandler = params.onUpdate;
    return () => {
      if (this.activeSessionId !== params.sessionId) {
        return;
      }
      this.activeSessionId = null;
      this.updateHandler = null;
    };
  };

  sessionUpdate = async (params: { sessionId: string; update: AcpClientUpdate }): Promise<void> => {
    if (params.sessionId !== this.activeSessionId) {
      return;
    }
    this.updateHandler?.(params.update);
  };

  requestPermission = async (): Promise<{
    outcome: { outcome: "cancelled" };
  }> => ({
    outcome: { outcome: "cancelled" },
  });

  readTextFile = async (): Promise<{ content: string }> => ({ content: "" });

  writeTextFile = async (): Promise<Record<string, never>> => ({});
}

class StdioRuntimeSession {
  private child: ChildProcessWithoutNullStreams | null = null;
  private connection: acp.ClientSideConnection | null = null;
  private promptInFlight = false;
  private remoteSessionId: string | null = null;
  private readonly clientBridge = new StdioRuntimeClientBridge();
  private stderr = "";
  private pendingProviderRoute: NcpProviderRuntimeRoute | undefined;

  constructor(
    private readonly config: StdioRuntimeResolvedConfig,
    private readonly sessionId: string,
  ) {}

  ensureStarted = async (params?: {
    providerRoute?: NcpProviderRuntimeRoute;
  }): Promise<void> => {
    this.pendingProviderRoute = params?.providerRoute;
    if (this.connection && this.remoteSessionId) {
      return;
    }

    const env = buildStdioRuntimeLaunchEnv({
      configEnv: this.config.env,
      providerRoute: this.pendingProviderRoute,
    });

    this.child = spawn(this.config.command, this.config.args, {
      cwd: this.config.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const spawnErrorPromise = new Promise<never>((_, reject) => {
      this.child?.once("error", (error) => {
        reject(
          new Error(
            buildSpawnFailureMessage({
              command: this.config.command,
              cwd: this.config.cwd,
              error,
            }),
          ),
        );
      });
    });
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      this.stderr = `${this.stderr}${chunk}`.slice(-4000);
    });

    const stream = acp.ndJsonStream(
      Writable.toWeb(this.child.stdin),
      Readable.toWeb(this.child.stdout),
    );
    this.connection = new acp.ClientSideConnection(() => this.clientBridge, stream);

    const session = await Promise.race([
      (async () => {
        await withTimeout(
          this.connection?.initialize({
            protocolVersion: acp.PROTOCOL_VERSION,
            clientCapabilities: {},
          }) ?? Promise.reject(new Error("[narp-stdio] stdio runtime connection not started")),
          this.config.startupTimeoutMs,
          `[narp-stdio] timed out initializing stdio runtime for session ${this.sessionId}`,
        );

        return withTimeout(
          this.connection?.newSession({
            cwd: this.config.cwd ?? process.cwd(),
            mcpServers: [],
          }) ?? Promise.reject(new Error("[narp-stdio] stdio runtime connection not started")),
          this.config.startupTimeoutMs,
          `[narp-stdio] timed out creating remote session for ${this.sessionId}`,
        );
      })(),
      spawnErrorPromise,
    ]);
    this.remoteSessionId = session.sessionId;
  };

  runPrompt = async (params: {
    text: string;
    meta: NarpStdioPromptMeta;
    modelId?: string;
    signal?: AbortSignal;
    onUpdate: (update: AcpClientUpdate) => void;
  }): Promise<acp.PromptResponse> => {
    const { meta, modelId, onUpdate, signal, text } = params;
    if (!this.connection || !this.remoteSessionId) {
      throw new Error("[narp-stdio] stdio runtime connection not started");
    }
    if (this.promptInFlight) {
      throw new Error("[narp-stdio] concurrent prompt is not supported for one stdio session");
    }

    this.promptInFlight = true;
    const detach = this.clientBridge.attach({
      sessionId: this.remoteSessionId,
      onUpdate,
    });
    const releaseAbort = this.bindAbortSignal(signal);

    try {
      if (modelId) {
        try {
          await this.connection.unstable_setSessionModel({
            sessionId: this.remoteSessionId,
            modelId,
          });
        } catch {
          // Not all ACP agents implement unstable session model switching.
        }
      }

      return await withTimeout(
        this.connection.prompt({
          sessionId: this.remoteSessionId,
          prompt: [{ type: "text", text }],
          _meta: {
            [NARP_STDIO_PROMPT_META_KEY]: meta,
          },
        }),
        this.config.requestTimeoutMs,
        `[narp-stdio] prompt timed out for session ${this.sessionId}`,
      );
    } finally {
      releaseAbort();
      detach();
      this.promptInFlight = false;
    }
  };

  cancel = async (): Promise<void> => {
    if (!this.connection || !this.remoteSessionId) {
      return;
    }
    try {
      await this.connection.cancel({
        sessionId: this.remoteSessionId,
      });
    } catch {
      // Best effort.
    }
  };

  private bindAbortSignal = (signal?: AbortSignal): (() => void) => {
    if (!signal) {
      return () => undefined;
    }

    const onAbort = (): void => {
      void this.cancel();
    };

    if (signal.aborted) {
      onAbort();
      return () => undefined;
    }

    signal.addEventListener("abort", onAbort, { once: true });
    return () => {
      signal.removeEventListener("abort", onAbort);
    };
  };

  readStderr = (): string => this.stderr;
}

class StdioRuntimeRunController {
  private readonly buffer = new UpdateBuffer();
  private readonly collector = new PromptUpdateCollector();
  private readonly toolStates = new Map<string, AcpToolState>();
  private textStarted = false;
  private reasoningStarted = false;
  private readonly resolvedTools: ReadonlyArray<OpenAITool>;
  private readonly resolvedProviderRoute: NcpProviderRuntimeRoute | undefined;

  constructor(
    private readonly session: StdioRuntimeSession,
    private readonly input: NcpAgentRunInput,
    private readonly stateManager?: NcpAgentConversationStateManager,
    private readonly resolveTools?: (input: NcpAgentRunInput) => ReadonlyArray<OpenAITool> | undefined,
    private readonly resolveProviderRoute?: (input: NcpAgentRunInput) => NcpProviderRuntimeRoute | undefined,
  ) {
    this.resolvedTools = resolveTools?.(input) ?? [];
    this.resolvedProviderRoute = resolveProviderRoute?.(input);
  }
  execute = async function* (
    this: StdioRuntimeRunController,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const requestMessage = this.input.messages.at(-1);
    if (!requestMessage) {
      throw new Error("[narp-stdio] runtime.run requires at least one input message");
    }

    const assistantMessageId = createAssistantMessageId(requestMessage.id);
    const promptPromise = this.session.runPrompt({
      text: extractPromptText(requestMessage),
      meta: {
        ...(this.input.correlationId ? { correlationId: this.input.correlationId } : {}),
        ...(this.resolvedProviderRoute ? { providerRoute: this.resolvedProviderRoute } : {}),
        ...(this.input.metadata ? { sessionMetadata: this.input.metadata } : {}),
        ...(this.resolvedTools.length > 0 ? { tools: this.resolvedTools } : {}),
      },
      modelId: resolveModelId({
        providerRoute: this.resolvedProviderRoute,
        metadata: this.input.metadata,
      }),
      signal: options?.signal,
      onUpdate: (update) => this.buffer.push(update),
    });
    const promptState = this.trackPromptState(promptPromise);

    yield* this.emitRunStartedEvents(assistantMessageId);

    try {
      yield* this.drainPromptUpdates(assistantMessageId, promptState);
      if (this.shouldExitForAbort(options, promptState.error)) {
        return;
      }
      yield* this.emitCompletionEvents(assistantMessageId);
    } catch (error) {
      if (this.shouldExitForAbort(options, error)) {
        return;
      }
      yield* this.emitFailureEvents(assistantMessageId, error);
    }
  };
  private trackPromptState = (
    promptPromise: Promise<acp.PromptResponse>,
  ): PromptExecutionState => {
    const promptState: PromptExecutionState = {
      settled: false,
      error: null,
    };

    promptPromise
      .then(() => {
        promptState.settled = true;
        this.buffer.notify();
      })
      .catch((error) => {
        promptState.settled = true;
        promptState.error = error;
        this.buffer.notify();
      });

    return promptState;
  };
  private emitRunStartedEvents = async function* (
    this: StdioRuntimeRunController,
    assistantMessageId: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    yield* this.emitEvent({
      type: NcpEventType.MessageAccepted,
      payload: {
        messageId: assistantMessageId,
        ...(this.input.correlationId ? { correlationId: this.input.correlationId } : {}),
      },
    });
    yield* this.emitEvent({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: this.input.sessionId,
        messageId: assistantMessageId,
        runId: `narp-stdio:${this.input.sessionId}:${Date.now()}`,
      },
    });
  };
  private drainPromptUpdates = async function* (
    this: StdioRuntimeRunController,
    assistantMessageId: string,
    promptState: PromptExecutionState,
  ): AsyncGenerator<NcpEndpointEvent> {
    while (!promptState.settled || this.buffer.hasItems()) {
      const update = this.buffer.shift();
      if (!update) {
        await this.buffer.waitForChange();
        continue;
      }
      for (const event of this.translateUpdate(update, assistantMessageId)) {
        yield* this.emitEvent(event);
      }
    }
  };
  private shouldExitForAbort = (
    options: NcpAgentRunOptions | undefined,
    error: unknown,
  ): boolean => options?.signal?.aborted === true || isAbortLikeRuntimeError(error);
  private emitCompletionEvents = async function* (
    this: StdioRuntimeRunController,
    assistantMessageId: string,
  ): AsyncGenerator<NcpEndpointEvent> {
    for (const terminalEvent of this.createTerminalEvents(assistantMessageId)) {
      yield* this.emitEvent(terminalEvent);
    }

    if (!this.collector.hasParts()) {
      throw new Error(
        `[narp-stdio] ACP prompt completed without any assistant content for session ${this.input.sessionId}. stderr=${this.session.readStderr()}`,
      );
    }

    yield* this.emitEvent({
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId: this.input.sessionId,
        correlationId: this.input.correlationId,
        message: {
          id: assistantMessageId,
          sessionId: this.input.sessionId,
          role: "assistant",
          status: "final",
          parts: this.collector.buildParts() as never,
          timestamp: new Date().toISOString(),
        },
      },
    });
    yield* this.emitEvent({
      type: NcpEventType.RunFinished,
      payload: {
        sessionId: this.input.sessionId,
        messageId: assistantMessageId,
        runId: `narp-stdio:${this.input.sessionId}`,
      },
    });
  };
  private emitFailureEvents = async function* (
    this: StdioRuntimeRunController,
    assistantMessageId: string,
    error: unknown,
  ): AsyncGenerator<NcpEndpointEvent> {
    const ncpError = normalizeRuntimeError(error);
    yield* this.emitEvent({
      type: NcpEventType.MessageFailed,
      payload: {
        sessionId: this.input.sessionId,
        messageId: assistantMessageId,
        correlationId: this.input.correlationId,
        error: ncpError,
      },
    });
    yield* this.emitEvent({
      type: NcpEventType.RunError,
      payload: {
        sessionId: this.input.sessionId,
        messageId: assistantMessageId,
        runId: `narp-stdio:${this.input.sessionId}`,
        error: ncpError.message,
      },
    });
  };
  private emitEvent = async function* (
    this: StdioRuntimeRunController,
    event: NcpEndpointEvent,
  ): AsyncGenerator<NcpEndpointEvent> {
    this.collector.apply(event);
    await this.stateManager?.dispatch(event);
    yield event;
  };

  private translateUpdate = (
    update: AcpClientUpdate,
    messageId: string,
  ): NcpEndpointEvent[] => {
    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        return this.emitTextDelta(update.content, messageId);
      case "agent_thought_chunk":
        return this.emitReasoningDelta(update.content, messageId);
      case "tool_call":
        return this.emitToolCallStart(update, messageId);
      case "tool_call_update":
        return this.emitToolCallUpdate(update);
      default:
        return [];
    }
  };

  private emitTextDelta = (
    content: { type: string; text?: string },
    messageId: string,
  ): NcpEndpointEvent[] => {
    if (content.type !== "text" || !content.text) {
      return [];
    }
    const events: NcpEndpointEvent[] = [];
    if (!this.textStarted) {
      this.textStarted = true;
      events.push({
        type: NcpEventType.MessageTextStart,
        payload: {
          sessionId: this.input.sessionId,
          messageId,
        },
      });
    }
    events.push({
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId: this.input.sessionId,
        messageId,
        delta: content.text,
      },
    });
    return events;
  };

  private emitReasoningDelta = (
    content: { type: string; text?: string },
    messageId: string,
  ): NcpEndpointEvent[] => {
    if (content.type !== "text" || !content.text) {
      return [];
    }
    const events: NcpEndpointEvent[] = [];
    if (!this.reasoningStarted) {
      this.reasoningStarted = true;
      events.push({
        type: NcpEventType.MessageReasoningStart,
        payload: {
          sessionId: this.input.sessionId,
          messageId,
        },
      });
    }
    events.push({
      type: NcpEventType.MessageReasoningDelta,
      payload: {
        sessionId: this.input.sessionId,
        messageId,
        delta: content.text,
      },
    });
    return events;
  };

  private emitToolCallStart = (
    update: Extract<AcpClientUpdate, { sessionUpdate: "tool_call" }>,
    messageId: string,
  ): NcpEndpointEvent[] => {
    const toolName = resolveToolName(update);
    const args = serializeToolArgs(update.rawInput);
    this.toolStates.set(update.toolCallId, {
      toolName,
      args,
      completed: false,
    });
    return [
      {
        type: NcpEventType.MessageToolCallStart,
        payload: {
          sessionId: this.input.sessionId,
          messageId,
          toolCallId: update.toolCallId,
          toolName,
        },
      },
      {
        type: NcpEventType.MessageToolCallArgs,
        payload: {
          sessionId: this.input.sessionId,
          toolCallId: update.toolCallId,
          args,
        },
      },
    ];
  };

  private emitToolCallUpdate = (
    update: Extract<AcpClientUpdate, { sessionUpdate: "tool_call_update" }>,
  ): NcpEndpointEvent[] => {
    const existing = this.toolStates.get(update.toolCallId);
    if (!existing) {
      return [];
    }

    const nextArgs = serializeToolArgs(update.rawInput);
    const argsChanged = typeof update.rawInput !== "undefined" && nextArgs !== existing.args;
    const events: NcpEndpointEvent[] = [];
    if (argsChanged) {
      existing.args = nextArgs;
      events.push({
        type: NcpEventType.MessageToolCallArgs,
        payload: {
          sessionId: this.input.sessionId,
          toolCallId: update.toolCallId,
          args: nextArgs,
        },
      });
    }

    if (update.status === "completed" || update.status === "failed") {
      if (!existing.completed) {
        existing.completed = true;
        events.push({
          type: NcpEventType.MessageToolCallEnd,
          payload: {
            sessionId: this.input.sessionId,
            toolCallId: update.toolCallId,
          },
        });
      }
      if (typeof update.rawOutput !== "undefined") {
        events.push({
          type: NcpEventType.MessageToolCallResult,
          payload: {
            sessionId: this.input.sessionId,
            toolCallId: update.toolCallId,
            content: update.rawOutput,
          },
        });
      }
    }
    return events;
  };

  private createTerminalEvents = (messageId: string): NcpEndpointEvent[] => {
    const events: NcpEndpointEvent[] = [];
    if (this.textStarted) {
      events.push({
        type: NcpEventType.MessageTextEnd,
        payload: {
          sessionId: this.input.sessionId,
          messageId,
        },
      });
      this.textStarted = false;
    }
    if (this.reasoningStarted) {
      events.push({
        type: NcpEventType.MessageReasoningEnd,
        payload: {
          sessionId: this.input.sessionId,
          messageId,
        },
      });
      this.reasoningStarted = false;
    }
    for (const [toolCallId, state] of this.toolStates.entries()) {
      if (state.completed) {
        continue;
      }
      events.push({
        type: NcpEventType.MessageToolCallEnd,
        payload: {
          sessionId: this.input.sessionId,
          toolCallId,
        },
      });
      state.completed = true;
    }
    return events;
  };
}

export class StdioRuntimeNcpAgentRuntime implements NcpAgentRuntime {
  private readonly session: StdioRuntimeSession;

  constructor(private readonly config: StdioRuntimeNcpAgentRuntimeConfig) {
    this.session = new StdioRuntimeSession(config, config.sessionId);
  }

  run = async function* (
    this: StdioRuntimeNcpAgentRuntime,
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    await this.session.ensureStarted({
      providerRoute: this.config.resolveProviderRoute?.(input),
    });
    const controller = new StdioRuntimeRunController(
      this.session,
      input,
      this.config.stateManager,
      this.config.resolveTools,
      this.config.resolveProviderRoute,
    );
    yield* controller.execute(options);
  };
}

function extractPromptText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  const text = (message.parts ?? [])
    .map((part) => {
      if (part.type === "text" || part.type === "reasoning" || part.type === "rich-text") {
        return part.text ?? "";
      }
      return "";
    })
    .join("\n")
    .trim();
  return text.length > 0 ? text : "[empty message]";
}

function resolveModelId(params: {
  providerRoute?: NcpProviderRuntimeRoute;
  metadata?: Record<string, unknown>;
}): string | undefined {
  const { metadata, providerRoute } = params;
  return (
    providerRoute?.model ??
    readString(metadata?.preferred_model) ??
    readString(metadata?.preferredModel) ??
    readString(metadata?.model)
  );
}

function resolveToolName(
  update: Extract<AcpClientUpdate, { sessionUpdate: "tool_call" }>,
): string {
  return resolveToolNameFromAcpUpdate(update);
}

function createAssistantMessageId(requestMessageId: string): string {
  const normalizedRequestId = requestMessageId.trim() || "request";
  return `assistant:${normalizedRequestId}:${randomUUID()}`;
}

function serializeToolArgs(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "undefined") {
    return "{}";
  }
  return JSON.stringify(value);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(message));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
