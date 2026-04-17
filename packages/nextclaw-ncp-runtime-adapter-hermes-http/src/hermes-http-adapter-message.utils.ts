import {
  NcpAssistantTextStreamNormalizer,
  type NcpEndpointEvent,
  type NcpError,
  type NcpMessage,
  type NcpMessagePart,
  type NcpProviderRuntimeRoute,
  type NcpRequestEnvelope,
  type NcpToolInvocationPart,
  NcpEventType,
} from "@nextclaw/ncp";
import type { HermesOpenAIMessage } from "./hermes-http-adapter.types.js";

type HermesInlineToolTrace = {
  toolName: string;
  args: string;
};

const HERMES_INLINE_TOOL_TRACE_PATTERNS: Array<{
  icon: string;
  toolName: string;
  buildArgs: (rawArgs: string) => string;
}> = [
  {
    icon: "🔎",
    toolName: "search_files",
    buildArgs: (rawArgs) => JSON.stringify({ pattern: rawArgs }),
  },
  {
    icon: "💻",
    toolName: "terminal",
    buildArgs: (rawArgs) => JSON.stringify({ command: rawArgs }),
  },
];

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [entryKey, entryValue] of Object.entries(value)) {
    if (typeof entryValue !== "string") {
      continue;
    }
    const normalized = entryValue.trim();
    if (!normalized) {
      continue;
    }
    out[entryKey] = normalized;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export type HermesProviderRoute = {
  model: string;
  apiKey?: string;
  apiBase?: string;
  headers: Record<string, string>;
  apiMode?: "chat_completions" | "codex_responses" | "anthropic_messages";
};

const NARP_API_MODE_HEADER = "x-nextclaw-narp-api-mode";

export function readHermesProviderRoute(
  envelope: NcpRequestEnvelope,
): HermesProviderRoute | undefined {
  const route = envelope.providerRoute;
  if (!route || typeof route !== "object" || Array.isArray(route)) {
    return undefined;
  }
  const routeRecord = route as Record<string, unknown>;

  const model =
    readMetadataString(routeRecord, "model") ??
    readMetadataString(routeRecord, "providerLocalModel");
  if (!model) {
    return undefined;
  }

  return {
    model,
    apiKey: readMetadataString(routeRecord, "apiKey"),
    apiBase: readMetadataString(routeRecord, "apiBase"),
    ...extractRuntimeHeaders(
      readStringRecord(routeRecord.headers) ??
      readStringRecord(routeRecord.extraHeaders) ??
      {},
    ),
  };
}

export function buildHermesMessages(params: {
  envelope: NcpRequestEnvelope;
  systemPrompt?: string;
}): HermesOpenAIMessage[] {
  const { envelope, systemPrompt } = params;
  const messages: HermesOpenAIMessage[] = [];
  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt,
    });
  }
  const content = extractMessageText(envelope.message);
  messages.push({
    role: normalizeRole(envelope.message.role),
    content,
  });
  return messages;
}

export function createAssistantMessage(params: {
  sessionId: string;
  messageId: string;
  text: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}): NcpMessage {
  const { sessionId, messageId, text, timestamp, metadata } = params;
  return {
    id: messageId,
    sessionId,
    role: "assistant",
    status: "final",
    parts: [
      {
        type: "text",
        text,
      },
    ],
    timestamp,
    ...(metadata ? { metadata } : {}),
  };
}

export function createAssistantMessageFromParts(params: {
  sessionId: string;
  messageId: string;
  parts: NcpMessagePart[];
  timestamp: string;
  metadata?: Record<string, unknown>;
}): NcpMessage {
  const { sessionId, messageId, parts, timestamp, metadata } = params;
  return {
    id: messageId,
    sessionId,
    role: "assistant",
    status: "final",
    parts: structuredClone(parts),
    timestamp,
    ...(metadata ? { metadata } : {}),
  };
}

export class HermesAssistantEventCollector {
  private readonly parts: NcpMessagePart[] = [];
  private readonly toolPartIndexByCallId = new Map<string, number>();

  applyEvent = (event: NcpEndpointEvent): void => {
    switch (event.type) {
      case NcpEventType.MessageTextDelta:
        this.appendTextPart(event.payload.delta);
        return;
      case NcpEventType.MessageReasoningDelta:
        this.appendReasoningPart(event.payload.delta);
        return;
      case NcpEventType.MessageToolCallStart:
        this.upsertToolInvocationPart({
          type: "tool-invocation",
          toolCallId: event.payload.toolCallId,
          toolName: event.payload.toolName,
          state: "partial-call",
          args: "",
        });
        return;
      case NcpEventType.MessageToolCallArgsDelta:
        this.applyToolCallArgsDelta(
          event.payload.toolCallId,
          event.payload.delta,
        );
        return;
      case NcpEventType.MessageToolCallArgs:
        this.upsertToolInvocationPart({
          type: "tool-invocation",
          toolCallId: event.payload.toolCallId,
          toolName: this.readToolName(event.payload.toolCallId),
          state: "partial-call",
          args: event.payload.args,
        });
        return;
      case NcpEventType.MessageToolCallEnd:
        this.upsertToolInvocationPart({
          type: "tool-invocation",
          toolCallId: event.payload.toolCallId,
          toolName: this.readToolName(event.payload.toolCallId),
          state: "call",
          args: this.readToolArgs(event.payload.toolCallId),
        });
        return;
      default:
        return;
    }
  };

  hasParts = (): boolean => this.parts.length > 0;

  buildParts = (): NcpMessagePart[] => structuredClone(this.parts);

  private appendTextPart = (delta: string): void => {
    if (!delta) {
      return;
    }
    const lastPart = this.parts.at(-1);
    if (lastPart?.type === "text") {
      lastPart.text = `${lastPart.text}${delta}`;
      return;
    }
    this.parts.push({
      type: "text",
      text: delta,
    });
  };

  private appendReasoningPart = (delta: string): void => {
    if (!delta) {
      return;
    }
    const lastPart = this.parts.at(-1);
    if (lastPart?.type === "reasoning") {
      lastPart.text = `${lastPart.text}${delta}`;
      return;
    }
    this.parts.push({
      type: "reasoning",
      text: delta,
    });
  };

  private applyToolCallArgsDelta = (toolCallId: string, delta: string): void => {
    const currentArgs = this.readToolArgs(toolCallId);
    this.upsertToolInvocationPart({
      type: "tool-invocation",
      toolCallId,
      toolName: this.readToolName(toolCallId),
      state: "partial-call",
      args: `${currentArgs}${delta}`,
    });
  };

  private upsertToolInvocationPart = (
    nextPart: NcpToolInvocationPart,
  ): void => {
    const normalizedToolCallId = nextPart.toolCallId?.trim();
    if (!normalizedToolCallId) {
      this.parts.push({
        ...nextPart,
      });
      return;
    }

    const existingIndex = this.toolPartIndexByCallId.get(normalizedToolCallId);
    if (typeof existingIndex === "number") {
      const existingPart = this.parts[existingIndex];
      if (existingPart?.type !== "tool-invocation") {
        return;
      }
      this.parts[existingIndex] = {
        ...existingPart,
        ...nextPart,
        toolCallId: normalizedToolCallId,
        toolName: nextPart.toolName || existingPart.toolName,
        args: nextPart.args ?? existingPart.args,
      };
      return;
    }

    this.toolPartIndexByCallId.set(normalizedToolCallId, this.parts.length);
    this.parts.push({
      ...nextPart,
      toolCallId: normalizedToolCallId,
    });
  };

  private readToolArgs = (toolCallId: string): string => {
    const part = this.findToolPart(toolCallId);
    if (!part) {
      return "";
    }
    return typeof part.args === "string"
      ? part.args
      : JSON.stringify(part.args ?? "");
  };

  private readToolName = (toolCallId: string): string => {
    const part = this.findToolPart(toolCallId);
    return part?.toolName ?? "unknown";
  };

  private findToolPart = (
    toolCallId: string,
  ): NcpToolInvocationPart | null => {
    const existingIndex = this.toolPartIndexByCallId.get(toolCallId);
    if (typeof existingIndex !== "number") {
      return null;
    }
    const part = this.parts[existingIndex];
    return part?.type === "tool-invocation" ? part : null;
  };
}

export class HermesInlineToolTraceTranslator {
  private pendingTextBuffer = "";
  private sawStructuredToolCall = false;
  private toolCallCount = 0;

  translate = async function* (
    this: HermesInlineToolTraceTranslator,
    events: AsyncIterable<NcpEndpointEvent>,
  ): AsyncGenerator<NcpEndpointEvent> {
    for await (const event of events) {
      if (this.isStructuredToolCallEvent(event)) {
        this.sawStructuredToolCall = true;
        yield* this.flushPendingText({
          sessionId: this.readEventSessionId(event),
          messageId: this.readEventMessageId(event),
          flush: true,
        });
        yield event;
        continue;
      }

      if (
        !this.sawStructuredToolCall &&
        event.type === NcpEventType.MessageTextDelta
      ) {
        this.pendingTextBuffer += event.payload.delta;
        yield* this.flushPendingText({
          sessionId: event.payload.sessionId,
          messageId: event.payload.messageId,
          flush: false,
        });
        continue;
      }

      if (
        !this.sawStructuredToolCall &&
        this.shouldFlushPendingText(event)
      ) {
        yield* this.flushPendingText({
          sessionId: this.readEventSessionId(event),
          messageId: this.readEventMessageId(event),
          flush: true,
        });
      }

      yield event;
    }
  };

  private flushPendingText = function* (
    this: HermesInlineToolTraceTranslator,
    params: {
      sessionId?: string;
      messageId?: string;
      flush: boolean;
    },
  ): Generator<NcpEndpointEvent> {
    if (!this.pendingTextBuffer) {
      return;
    }

    const lastNewlineIndex = this.pendingTextBuffer.lastIndexOf("\n");
    const flushableText =
      params.flush
        ? this.pendingTextBuffer
        : lastNewlineIndex >= 0
          ? this.pendingTextBuffer.slice(0, lastNewlineIndex + 1)
          : this.pendingTextBuffer.includes("`")
            ? ""
            : this.pendingTextBuffer;
    if (!flushableText) {
      return;
    }

    this.pendingTextBuffer = this.pendingTextBuffer.slice(flushableText.length);
    for (const segment of splitIntoLineSegments(flushableText)) {
      const inlineToolTrace = matchHermesInlineToolTrace(segment);
      if (inlineToolTrace && params.sessionId) {
        const toolCallId = `hermes-inline-tool-${++this.toolCallCount}`;
        yield {
          type: NcpEventType.MessageToolCallStart,
          payload: {
            sessionId: params.sessionId,
            ...(params.messageId ? { messageId: params.messageId } : {}),
            toolCallId,
            toolName: inlineToolTrace.toolName,
          },
        };
        yield {
          type: NcpEventType.MessageToolCallArgs,
          payload: {
            sessionId: params.sessionId,
            toolCallId,
            args: inlineToolTrace.args,
          },
        };
        yield {
          type: NcpEventType.MessageToolCallEnd,
          payload: {
            sessionId: params.sessionId,
            toolCallId,
          },
        };
        continue;
      }

      if (!segment || !params.sessionId || !params.messageId) {
        continue;
      }
      yield {
        type: NcpEventType.MessageTextDelta,
        payload: {
          sessionId: params.sessionId,
          messageId: params.messageId,
          delta: segment,
        },
      };
    }
  };

  private shouldFlushPendingText = (event: NcpEndpointEvent): boolean =>
    event.type === NcpEventType.MessageTextEnd ||
    event.type === NcpEventType.MessageCompleted ||
    event.type === NcpEventType.MessageFailed ||
    event.type === NcpEventType.RunFinished ||
    event.type === NcpEventType.RunError;

  private isStructuredToolCallEvent = (event: NcpEndpointEvent): boolean =>
    event.type === NcpEventType.MessageToolCallStart ||
    event.type === NcpEventType.MessageToolCallArgs ||
    event.type === NcpEventType.MessageToolCallArgsDelta ||
    event.type === NcpEventType.MessageToolCallEnd ||
    event.type === NcpEventType.MessageToolCallResult;

  private readEventSessionId = (event: NcpEndpointEvent): string | undefined => {
    if (!("payload" in event) || !event.payload || typeof event.payload !== "object") {
      return undefined;
    }
    return "sessionId" in event.payload && typeof event.payload.sessionId === "string"
      ? event.payload.sessionId
      : undefined;
  };

  private readEventMessageId = (event: NcpEndpointEvent): string | undefined => {
    if (!("payload" in event) || !event.payload || typeof event.payload !== "object") {
      return undefined;
    }
    return "messageId" in event.payload && typeof event.payload.messageId === "string"
      ? event.payload.messageId
      : undefined;
  };
}

export class HermesReasoningDeltaTranslator {
  private readonly normalizer = new NcpAssistantTextStreamNormalizer("think-tags");

  translate = async function* (
    this: HermesReasoningDeltaTranslator,
    events: AsyncIterable<NcpEndpointEvent>,
  ): AsyncGenerator<NcpEndpointEvent> {
    for await (const event of events) {
      if (event.type === NcpEventType.MessageTextDelta) {
        yield* this.emitNormalizedTextDelta(event);
        continue;
      }

      if (this.shouldFlushPendingText(event)) {
        yield* this.flushPendingText(event);
      }

      yield event;
    }

    yield* this.flushSegments();
  };

  private emitNormalizedTextDelta = function* (
    this: HermesReasoningDeltaTranslator,
    event: Extract<NcpEndpointEvent, { type: NcpEventType.MessageTextDelta }>,
  ): Generator<NcpEndpointEvent> {
    const segments = this.normalizer.push(event.payload.delta);
    for (const segment of segments) {
      if (!segment.text) {
        continue;
      }
      if (segment.type === "reasoning") {
        yield {
          type: NcpEventType.MessageReasoningDelta,
          payload: {
            sessionId: event.payload.sessionId,
            messageId: event.payload.messageId,
            delta: segment.text,
          },
        };
        continue;
      }
      yield {
        type: NcpEventType.MessageTextDelta,
        payload: {
          sessionId: event.payload.sessionId,
          messageId: event.payload.messageId,
          delta: segment.text,
        },
      };
    }
  };

  private flushPendingText = function* (
    this: HermesReasoningDeltaTranslator,
    event: NcpEndpointEvent,
  ): Generator<NcpEndpointEvent> {
    const sessionId = this.readEventSessionId(event);
    const messageId = this.readEventMessageId(event);
    if (!sessionId || !messageId) {
      yield* this.flushSegments();
      return;
    }

    const segments = this.normalizer.finish();
    for (const segment of segments) {
      if (!segment.text) {
        continue;
      }
      if (segment.type === "reasoning") {
        yield {
          type: NcpEventType.MessageReasoningDelta,
          payload: {
            sessionId,
            messageId,
            delta: segment.text,
          },
        };
        continue;
      }
      yield {
        type: NcpEventType.MessageTextDelta,
        payload: {
          sessionId,
          messageId,
          delta: segment.text,
        },
      };
    }
  };

  private flushSegments = function* (
    this: HermesReasoningDeltaTranslator,
  ): Generator<NcpEndpointEvent> {
    this.normalizer.finish();
  };

  private shouldFlushPendingText = (event: NcpEndpointEvent): boolean =>
    event.type === NcpEventType.MessageTextEnd ||
    event.type === NcpEventType.MessageCompleted ||
    event.type === NcpEventType.MessageFailed ||
    event.type === NcpEventType.RunFinished ||
    event.type === NcpEventType.RunError;

  private readEventSessionId = (event: NcpEndpointEvent): string | undefined => {
    if (!("payload" in event) || !event.payload || typeof event.payload !== "object") {
      return undefined;
    }
    return "sessionId" in event.payload && typeof event.payload.sessionId === "string"
      ? event.payload.sessionId
      : undefined;
  };

  private readEventMessageId = (event: NcpEndpointEvent): string | undefined => {
    if (!("payload" in event) || !event.payload || typeof event.payload !== "object") {
      return undefined;
    }
    return "messageId" in event.payload && typeof event.payload.messageId === "string"
      ? event.payload.messageId
      : undefined;
  };
}

export function resolveHermesModel(params: {
  envelope: NcpRequestEnvelope;
  fallbackModel: string;
}): string {
  const { envelope, fallbackModel } = params;
  const providerRoute = readHermesProviderRoute(envelope);
  const metadata =
    envelope.metadata &&
    typeof envelope.metadata === "object" &&
    !Array.isArray(envelope.metadata)
      ? (envelope.metadata as Record<string, unknown>)
      : undefined;

  return (
    providerRoute?.model ??
    readMetadataString(metadata, "preferred_model") ??
    readMetadataString(metadata, "preferredModel") ??
    readMetadataString(metadata, "model") ??
    fallbackModel
  );
}

export function normalizeHermesRequestedModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return trimmed;
  }

  const slashIndex = trimmed.indexOf("/");
  if (slashIndex <= 0) {
    return trimmed;
  }

  const suffix = trimmed.slice(slashIndex + 1).trim();
  if (!suffix) {
    return trimmed;
  }

  if (suffix.includes(":")) {
    return suffix;
  }

  return trimmed;
}

export function inferHermesProvider(params: {
  model: string;
  apiBase?: string | null;
  apiMode?: HermesProviderRoute["apiMode"];
}): string | undefined {
  if (params.apiMode === "anthropic_messages") {
    return "anthropic";
  }
  const model = params.model.trim().toLowerCase();
  const hostname = readHostname(params.apiBase);

  if (hostname.includes("anthropic.com") || model.startsWith("claude")) {
    return "anthropic";
  }
  return "openai";
}

export function toNcpError(
  error: unknown,
  code: NcpError["code"],
): NcpError {
  return {
    code,
    message: error instanceof Error ? error.message : String(error),
  };
}

export function toNcpSseFrame(event: NcpEndpointEvent): string {
  return `event: ncp-event\ndata: ${JSON.stringify(event)}\n\n`;
}

export function toErrorSseFrame(error: { code: string; message: string }): string {
  return `event: error\ndata: ${JSON.stringify(error)}\n\n`;
}

function readHostname(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  try {
    return new URL(value).hostname.trim().toLowerCase();
  } catch {
    return "";
  }
}

function extractRuntimeHeaders(
  headers: Record<string, string>,
): Pick<HermesProviderRoute, "headers" | "apiMode"> {
  const nextHeaders = { ...headers };
  const apiMode = nextHeaders[NARP_API_MODE_HEADER] as HermesProviderRoute["apiMode"] | undefined;
  delete nextHeaders[NARP_API_MODE_HEADER];
  return {
    headers: nextHeaders,
    ...(apiMode ? { apiMode } : {}),
  };
}

function extractMessageText(message: NcpMessage): string {
  const text = message.parts
    .map((part) => {
      if (part.type === "text" || part.type === "reasoning" || part.type === "rich-text") {
        return part.text;
      }
      return "";
    })
    .join("\n")
    .trim();
  return text.length > 0 ? text : "[empty message]";
}

function splitIntoLineSegments(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/gu) ?? [];
}

function matchHermesInlineToolTrace(segment: string): HermesInlineToolTrace | null {
  const trimmed = segment.trim();
  if (!trimmed.startsWith("`") || !trimmed.endsWith("`")) {
    return null;
  }

  const body = trimmed.slice(1, -1).trim();
  for (const candidate of HERMES_INLINE_TOOL_TRACE_PATTERNS) {
    if (!body.startsWith(candidate.icon)) {
      continue;
    }
    const rawArgs = body.slice(candidate.icon.length).trim();
    if (!rawArgs) {
      return null;
    }
    return {
      toolName: candidate.toolName,
      args: candidate.buildArgs(rawArgs),
    };
  }

  return null;
}

function normalizeRole(role: NcpMessage["role"]): HermesOpenAIMessage["role"] {
  if (role === "assistant" || role === "system") {
    return role;
  }
  return "user";
}
