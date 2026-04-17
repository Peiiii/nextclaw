import type { ServerResponse } from "node:http";
import {
  buildAssistantOutputItems,
  writeReasoningOutputItemEvents,
} from "./codex-openai-responses-bridge-assistant-output.utils.js";
import {
  nextSequenceNumber,
  readArray,
  readNumber,
  readRecord,
  readString,
  writeSseEvent,
  type OpenAiChatCompletionResponse,
  type OpenResponsesOutputItem,
  type StreamSequenceState,
} from "./codex-openai-responses-bridge-shared.utils.js";

function buildOpenResponsesOutputItems(
  response: OpenAiChatCompletionResponse,
  responseId: string,
): OpenResponsesOutputItem[] {
  const message = response.choices?.[0]?.message;
  if (!message) {
    return [];
  }

  const outputItems = buildAssistantOutputItems({
    message,
    responseId,
  });

  const toolCalls = readArray(message.tool_calls);
  toolCalls.forEach((entry, index) => {
    const toolCall = readRecord(entry);
    const fn = readRecord(toolCall?.function);
    const name = readString(fn?.name);
    const argumentsText = readString(fn?.arguments) ?? "{}";
    if (!name) {
      return;
    }
    const callId =
      readString(toolCall?.id) ??
      `${responseId}:call:${index}`;
    outputItems.push({
      type: "function_call",
      id: `${responseId}:function:${index}`,
      call_id: callId,
      name,
      arguments: argumentsText,
      status: "completed",
    });
  });

  return outputItems;
}

function normalizeUsageValue(value: unknown): number | Record<string, unknown> | null {
  const numericValue = readNumber(value);
  if (numericValue !== undefined) {
    return Math.max(0, Math.trunc(numericValue));
  }
  const record = readRecord(value);
  if (!record) {
    return null;
  }
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    const normalizedEntry = normalizeUsageValue(entry);
    if (normalizedEntry !== null) {
      next[key] = normalizedEntry;
    }
  }
  return Object.keys(next).length > 0 ? next : null;
}

function normalizeUsageRecord(rawUsage: unknown): Record<string, unknown> {
  const usage = readRecord(rawUsage);
  if (!usage) {
    return {};
  }
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(usage)) {
    const normalizedValue = normalizeUsageValue(value);
    if (normalizedValue === null) {
      continue;
    }
    if (key === "prompt_tokens") {
      next.input_tokens = normalizedValue;
      continue;
    }
    if (key === "completion_tokens") {
      next.output_tokens = normalizedValue;
      continue;
    }
    if (key === "prompt_tokens_details") {
      next.input_tokens_details = normalizedValue;
      continue;
    }
    if (key === "completion_tokens_details") {
      next.output_tokens_details = normalizedValue;
      continue;
    }
    next[key] = normalizedValue;
  }
  return next;
}

function buildUsage(response: OpenAiChatCompletionResponse): Record<string, unknown> {
  const promptTokens = Math.max(0, Math.trunc(readNumber(response.usage?.prompt_tokens) ?? 0));
  const completionTokens = Math.max(
    0,
    Math.trunc(readNumber(response.usage?.completion_tokens) ?? 0),
  );
  const totalTokens = Math.max(
    0,
    Math.trunc(readNumber(response.usage?.total_tokens) ?? promptTokens + completionTokens),
  );
  return {
    ...normalizeUsageRecord(response.usage),
    input_tokens: promptTokens,
    output_tokens: completionTokens,
    total_tokens: totalTokens,
  };
}

function buildResponseResource(params: {
  responseId: string;
  model: string;
  outputItems: OpenResponsesOutputItem[];
  usage: Record<string, unknown>;
  status?: "in_progress" | "completed";
}): Record<string, unknown> {
  return {
    id: params.responseId,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: params.status ?? "completed",
    model: params.model,
    output: params.outputItems,
    usage: params.usage,
    error: null,
  };
}

function cloneRecord<T extends Record<string, unknown>>(value: T): T {
  return structuredClone(value) as T;
}

function buildInProgressOutputItem(item: OpenResponsesOutputItem): OpenResponsesOutputItem {
  const type = readString(item.type);
  if (type === "message") {
    return {
      ...cloneRecord(item),
      status: "in_progress",
      content: [],
    };
  }
  if (type === "function_call") {
    return {
      ...cloneRecord(item),
      status: "in_progress",
      arguments: "",
    };
  }
  return cloneRecord(item);
}

function writeMessageOutputItemEvents(params: {
  response: ServerResponse;
  item: OpenResponsesOutputItem;
  outputIndex: number;
  sequenceState: StreamSequenceState;
}): void {
  const itemId = readString(params.item.id);
  const content = readArray(params.item.content);
  const textPart = content.find((entry) => readString(readRecord(entry)?.type) === "output_text");
  const text = readString(readRecord(textPart)?.text) ?? "";
  writeSseEvent(params.response, "response.output_item.added", {
    type: "response.output_item.added",
    sequence_number: nextSequenceNumber(params.sequenceState),
    output_index: params.outputIndex,
    item: buildInProgressOutputItem(params.item),
  });

  if (itemId) {
    writeSseEvent(params.response, "response.content_part.added", {
      type: "response.content_part.added",
      sequence_number: nextSequenceNumber(params.sequenceState),
      output_index: params.outputIndex,
      item_id: itemId,
      content_index: 0,
      part: {
        type: "output_text",
        text: "",
        annotations: [],
      },
    });
    if (text) {
      writeSseEvent(params.response, "response.output_text.delta", {
        type: "response.output_text.delta",
        sequence_number: nextSequenceNumber(params.sequenceState),
        output_index: params.outputIndex,
        item_id: itemId,
        content_index: 0,
        delta: text,
      });
    }
    writeSseEvent(params.response, "response.output_text.done", {
      type: "response.output_text.done",
      sequence_number: nextSequenceNumber(params.sequenceState),
      output_index: params.outputIndex,
      item_id: itemId,
      content_index: 0,
      text,
    });
    writeSseEvent(params.response, "response.content_part.done", {
      type: "response.content_part.done",
      sequence_number: nextSequenceNumber(params.sequenceState),
      output_index: params.outputIndex,
      item_id: itemId,
      content_index: 0,
      part: {
        type: "output_text",
        text,
        annotations: [],
      },
    });
  }

  writeSseEvent(params.response, "response.output_item.done", {
    type: "response.output_item.done",
    sequence_number: nextSequenceNumber(params.sequenceState),
    output_index: params.outputIndex,
    item: params.item,
  });
}

function writeFunctionCallOutputItemEvents(params: {
  response: ServerResponse;
  item: OpenResponsesOutputItem;
  outputIndex: number;
  sequenceState: StreamSequenceState;
}): void {
  const itemId = readString(params.item.id);
  const argumentsText = readString(params.item.arguments) ?? "";
  writeSseEvent(params.response, "response.output_item.added", {
    type: "response.output_item.added",
    sequence_number: nextSequenceNumber(params.sequenceState),
    output_index: params.outputIndex,
    item: buildInProgressOutputItem(params.item),
  });
  if (itemId && argumentsText) {
    writeSseEvent(params.response, "response.function_call_arguments.delta", {
      type: "response.function_call_arguments.delta",
      sequence_number: nextSequenceNumber(params.sequenceState),
      output_index: params.outputIndex,
      item_id: itemId,
      delta: argumentsText,
    });
  }
  if (itemId) {
    writeSseEvent(params.response, "response.function_call_arguments.done", {
      type: "response.function_call_arguments.done",
      sequence_number: nextSequenceNumber(params.sequenceState),
      output_index: params.outputIndex,
      item_id: itemId,
      arguments: argumentsText,
    });
  }
  writeSseEvent(params.response, "response.output_item.done", {
    type: "response.output_item.done",
    sequence_number: nextSequenceNumber(params.sequenceState),
    output_index: params.outputIndex,
    item: params.item,
  });
}

function writeResponseOutputItemEvents(params: {
  response: ServerResponse;
  outputItems: OpenResponsesOutputItem[];
  sequenceState: StreamSequenceState;
}): void {
  params.outputItems.forEach((item, outputIndex) => {
    const type = readString(item.type);
    if (type === "reasoning") {
      writeReasoningOutputItemEvents({
        response: params.response,
        item,
        outputIndex,
        sequenceState: params.sequenceState,
      });
      return;
    }
    if (type === "message") {
      writeMessageOutputItemEvents({
        response: params.response,
        item,
        outputIndex,
        sequenceState: params.sequenceState,
      });
      return;
    }
    if (type === "function_call") {
      writeFunctionCallOutputItemEvents({
        response: params.response,
        item,
        outputIndex,
        sequenceState: params.sequenceState,
      });
      return;
    }
    writeSseEvent(params.response, "response.output_item.done", {
      type: "response.output_item.done",
      sequence_number: nextSequenceNumber(params.sequenceState),
      output_index: outputIndex,
      item,
    });
  });
}

export function writeStreamError(response: ServerResponse, message: string): void {
  response.statusCode = 200;
  response.setHeader("content-type", "text/event-stream; charset=utf-8");
  response.setHeader("cache-control", "no-cache, no-transform");
  response.setHeader("connection", "keep-alive");
  writeSseEvent(response, "error", {
    type: "error",
    error: {
      code: "invalid_request_error",
      message,
    },
  });
  response.end();
}

export function buildBridgeResponsePayload(params: {
  responseId: string;
  model: string;
  response: OpenAiChatCompletionResponse;
}): {
  outputItems: OpenResponsesOutputItem[];
  usage: Record<string, unknown>;
  responseResource: Record<string, unknown>;
} {
  const outputItems = buildOpenResponsesOutputItems(params.response, params.responseId);
  const usage = buildUsage(params.response);
  return {
    outputItems,
    usage,
    responseResource: buildResponseResource({
      responseId: params.responseId,
      model: params.model,
      outputItems,
      usage,
    }),
  };
}

export function writeResponsesStream(params: {
  response: ServerResponse;
  responseId: string;
  model: string;
  outputItems: OpenResponsesOutputItem[];
  responseResource: Record<string, unknown>;
}): void {
  const sequenceState: StreamSequenceState = {
    value: 0,
  };
  params.response.statusCode = 200;
  params.response.setHeader("content-type", "text/event-stream; charset=utf-8");
  params.response.setHeader("cache-control", "no-cache, no-transform");
  params.response.setHeader("connection", "keep-alive");
  writeSseEvent(params.response, "response.created", {
    type: "response.created",
    sequence_number: nextSequenceNumber(sequenceState),
    response: buildResponseResource({
      responseId: params.responseId,
      model: params.model,
      outputItems: [],
      usage: buildUsage({
        usage: {},
      }),
      status: "in_progress",
    }),
  });
  writeResponseOutputItemEvents({
    response: params.response,
    outputItems: params.outputItems,
    sequenceState,
  });
  writeSseEvent(params.response, "response.completed", {
    type: "response.completed",
    sequence_number: nextSequenceNumber(sequenceState),
    response: params.responseResource,
  });
  params.response.end();
}
